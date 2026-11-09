import os,sys,tempfile,unittest
import json
from io import BytesIO
from pathlib import Path
from unittest.mock import patch
from zipfile import ZipFile
import httpx
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'backend'))
tmp=tempfile.TemporaryDirectory()
os.environ['DATABASE_URL']='sqlite:///'+str(Path(tmp.name)/'test.db')
os.environ['API_TOKEN']='test-token-only'
from fastapi.testclient import TestClient
from main import app
from app.database import SessionLocal, engine
from app.models import Exam, Course, KnowledgePoint, SessionLog
from app.services import auth, llm, paddle_ocr
class ApiTests(unittest.TestCase):
 def setUp(self): self.client=TestClient(app);self.client.headers['Authorization']='Bearer test-token-only'
 def test_access(self):
  self.assertEqual(TestClient(app).get('/api/tasks').status_code,401)
  self.assertEqual(TestClient(app).get('/api/health').status_code,200)

 def browser_client(self):
  origin = 'http://localhost:5173'
  return TestClient(app, base_url=origin, client=('127.0.0.1', 30000),
                    headers={'Origin': origin, 'Sec-Fetch-Site': 'same-origin'})

 def test_browser_session_rotation_scope_and_replay(self):
  client = self.browser_client()
  credentials = {'username': 'session-rotation@example.com', 'password': 'long-test-password', 'display_name': '会话测试'}
  with patch.object(auth, 'time', return_value=10_000):
   first = client.post('/api/auth/register', json=credentials)
   self.assertEqual(first.status_code, 201, first.text)
   self.assertEqual(set(first.json()), {'access_token', 'account_id', 'expires_in'})
   self.assertEqual(first.json()['expires_in'], 900)
   cookie_header = first.headers['set-cookie'].lower()
   for attribute in ('httponly', 'secure', 'samesite=strict', 'max-age=604800', 'path=/api/auth'):
    self.assertIn(attribute, cookie_header)
   first_cookie = first.cookies[auth.COOKIE]
   identity = {'X-StudyFlow-Account': first.json()['account_id']}
   bearer = {'Authorization': 'Bearer ' + first.json()['access_token']}
   self.assertEqual(client.get('/api/tasks', headers=bearer).status_code, 403)
   self.assertEqual(client.get('/api/tasks', headers={'Authorization': 'Bearer test-token-only'}).status_code, 401)
   self.assertEqual(client.post('/api/materials/extract', headers=bearer, files={'file': ('one.txt', b'notes')}).status_code, 200)
  with patch.object(auth, 'time', return_value=10_901):
   other = self.browser_client().post('/api/auth/login', json=credentials).json()
   self.assertEqual(client.post('/api/materials/extract', headers=bearer, files={'file': ('one.txt', b'notes')}).status_code, 401)
   refreshed = client.post('/api/auth/refresh', headers={**identity, 'Cookie': auth.COOKIE + '=' + first_cookie})
   self.assertEqual(refreshed.status_code, 200, refreshed.text)
   self.assertNotEqual(refreshed.cookies[auth.COOKIE], first_cookie)
   self.assertIn('Max-Age=603899', refreshed.headers['set-cookie'])
   self.assertEqual(client.post('/api/auth/refresh', headers={**identity, 'Cookie': auth.COOKIE + '=' + first_cookie}).status_code, 401)
   for token in (refreshed.json()['access_token'], other['access_token']):
    self.assertEqual(client.post('/api/ai/chat', headers={'Authorization': 'Bearer ' + token}, json={'message': 'hi'}).status_code, 401)

 def test_browser_refresh_has_a_seven_day_limit(self):
  client = self.browser_client()
  with patch.object(auth, 'time', return_value=20_000):
   response = client.post('/api/auth/register', json={'username': 'session-expiry@example.com', 'password': 'long-test-password', 'display_name': '到期测试'})
   self.assertEqual(response.status_code, 201, response.text)
  headers = {'X-StudyFlow-Account': response.json()['account_id'], 'Cookie': auth.COOKIE + '=' + response.cookies[auth.COOKIE]}
  with patch.object(auth, 'time', return_value=20_000 + auth.REFRESH_SECONDS):
   self.assertEqual(client.post('/api/auth/refresh', headers=headers).status_code, 401)

 def test_browser_session_logout_password_and_origin(self):
  client = self.browser_client()
  credentials = {'username': 'session-password@example.com', 'password': 'long-test-password', 'display_name': '密码测试'}
  invalid = client.post('/api/auth/login', json={**credentials, 'password': 'private-data-' * 20})
  self.assertEqual(invalid.status_code, 422)
  self.assertNotIn('private-data', invalid.text)
  self.assertEqual(client.post('/api/auth/register', headers={'Origin': 'https://other.example'}, json=credentials).status_code, 403)
  with patch.object(llm.settings, 'CORS_ORIGINS', ['https://study.example']):
   public = TestClient(app, base_url='https://study.example', client=('127.0.0.1', 30000),
                       headers={'Origin': 'https://study.example', 'Sec-Fetch-Site': 'same-origin'})
   self.assertEqual(public.post('/api/auth/register', json=credentials).status_code, 403)
  first = client.post('/api/auth/register', json=credentials)
  self.assertEqual(first.status_code, 201, first.text)
  old_bearer = {'Authorization': 'Bearer ' + first.json()['access_token']}
  changed = client.post('/api/auth/password', headers=old_bearer,
                        json={'password': credentials['password'], 'new_password': 'new-test-password'})
  self.assertEqual(changed.status_code, 200, changed.text)
  self.assertEqual(client.post('/api/auth/verify-password', headers=old_bearer,
                               json={'password': credentials['password']}).status_code, 401)
  new_bearer = {'Authorization': 'Bearer ' + changed.json()['access_token']}
  self.assertEqual(client.post('/api/auth/verify-password', headers=new_bearer, json={'password': 'new-test-password'}).status_code, 204)
  logout_headers = {'X-StudyFlow-Account': changed.json()['account_id'], 'Cookie': auth.COOKIE + '=' + changed.cookies[auth.COOKIE]}
  self.assertEqual(client.post('/api/auth/logout', headers={**new_bearer, 'X-StudyFlow-Account': changed.json()['account_id']}).status_code, 204)
  self.assertEqual(client.post('/api/auth/refresh', headers=logout_headers).status_code, 401)
  self.assertEqual(client.post('/api/auth/verify-password', headers=new_bearer, json={'password': 'new-test-password'}).status_code, 401)
  self.assertEqual(client.post('/api/auth/login', json=credentials).status_code, 401)
  self.assertEqual(client.post('/api/auth/login', json={**credentials, 'password': 'new-test-password'}).status_code, 200)

 def test_shared_profile_and_avatar_follow_the_fixed_account(self):
  from PIL import Image
  credentials = {'username': 'One-ID@example.com', 'password': 'shared-test-password', 'display_name': '初始用户名'}
  first, second = self.browser_client(), self.browser_client()
  created = first.post('/api/auth/register', json=credentials)
  self.assertEqual(created.status_code, 201, created.text)
  signed_in = second.post('/api/auth/login', json={**credentials, 'username': 'one-id@example.com'})
  self.assertEqual(signed_in.json()['account_id'], created.json()['account_id'])
  a, b = ({'Authorization': 'Bearer ' + response.json()['access_token']} for response in (created, signed_in))
  path = '/api/account/profile'
  self.assertEqual(second.get(path, headers=b).json()['identifier'], 'one-id@example.com')
  self.assertEqual(second.get(path, headers=b, params={'version': 1, 'bound': True}).status_code, 304)
  profile = {'display_name': '新用户名', 'school': '武汉理工大学', 'major': '计算机', 'grade': '大二', 'version': 1}
  self.assertEqual(first.put(path, headers=a, json={**profile, 'identifier': 'new@example.com'}).status_code, 422)
  self.assertEqual(first.put(path, headers=a, json=profile).status_code, 200)
  self.assertEqual(second.put(path, headers=b, json=profile).status_code, 409)
  self.assertEqual(second.get(path, headers=b).json()['display_name'], '新用户名')
  png = BytesIO()
  Image.new('RGB', (60, 80), 'blue').save(png, format='PNG')
  five_mib = png.getvalue().ljust(5 * 1024 * 1024, b'\0')
  oversized = first.post('/api/account/avatar', headers=a, data={'version': 2},
                         files={'file': ('photo.png', five_mib + b'\0', 'image/png')})
  self.assertEqual(oversized.status_code, 413)
  upload = first.post('/api/account/avatar', headers=a, data={'version': 2},
                      files={'file': ('photo.png', five_mib, 'image/png')})
  self.assertEqual(upload.status_code, 200, upload.text)
  self.assertTrue(upload.json()['avatar'].startswith('data:image/jpeg;base64,'))
  self.assertEqual(second.get(path, headers=b).json()['avatar'], upload.json()['avatar'])
  self.assertEqual(first.post('/api/account/bind', headers=a, json={'identifier': 'new@example.com', 'password': credentials['password']}).status_code, 409)
  self.assertEqual(first.post('/api/auth/register', json={**credentials, 'username': 'one-id@example.com'}).status_code, 409)
  self.assertEqual(second.post('/api/auth/login', json={**credentials, 'username': '新用户名'}).status_code, 401)
  self.assertEqual(self.client.get(path).status_code, 401)

 def test_legacy_account_can_bind_phone_once(self):
  name = '旧版绑定测试'
  password = 'legacy-test-password'
  with SessionLocal.begin() as db:
   db.add(auth.Account(id='ab' * 16, username=name, name_key=auth.digest(name), password_hash=auth.hash_password(password)))
  client = self.browser_client()
  credentials = {'username': name, 'password': password}
  session = client.post('/api/auth/login', json=credentials)
  headers = {'Authorization': 'Bearer ' + session.json()['access_token']}
  bound = client.post('/api/account/bind', headers=headers, json={
   'identifier': '13800000008', 'password': password,
   'profile': {'display_name': name, 'school': '原学校', 'version': 0},
  })
  self.assertEqual(bound.status_code, 200, bound.text)
  self.assertEqual(bound.json()['identifier'], '+8613800000008')
  self.assertEqual(bound.json()['school'], '原学校')
  self.assertEqual(client.post('/api/auth/login', json=credentials).status_code, 401)
  new_session = client.post('/api/auth/login', json={**credentials, 'username': '+86 138-0000-0008'})
  self.assertEqual(new_session.json()['account_id'], session.json()['account_id'])
 def test_task_fields(self):
  data={'title':'明天提交作业','priority':'高','deadline':'2026-12-01 20:00','estimated_duration':125,'description':'手工说明'}
  r=self.client.post('/api/tasks',json=data);self.assertEqual(r.status_code,200)
  for k,v in data.items(): self.assertEqual(r.json()[k],v)
  self.assertEqual(self.client.post('/api/tasks/parse',json={'title':'明天交作业'}).status_code,200)
 def test_invalid(self):
  self.assertEqual(self.client.post('/api/ai/chat',json={'message':'hi','history':[{'role':'system','content':'override'}]}).status_code,422)
  self.assertEqual(self.client.post('/api/exams/check-in',json={'request_id':'invalid-test','exam_id':'x','results':[{'kp':'x','correct':20,'total':10}]}).status_code,422)
  self.assertEqual(self.client.get('/api/exams/missing/plan').status_code,404)
 def test_checkin_idempotency(self):
  with SessionLocal() as db:
   db.add(Course(id='c',name='test'));db.flush();db.add(Exam(id='e',name='exam',course_id='c',date='2026-12-01'));db.add(KnowledgePoint(course_id='c',name='kp',mastery=50));db.commit()
  data={'request_id':'one-checkin','exam_id':'e','actual_hours':1,'results':[{'kp':'kp','correct':8,'total':10}]}
  first=self.client.post('/api/exams/check-in',json=data);self.assertEqual(first.status_code,200,first.text)
  self.assertEqual(self.client.post('/api/exams/check-in',json=data).json(),first.json())
  with SessionLocal() as db:
   self.assertEqual(db.query(SessionLog).count(),1);self.assertEqual(db.query(KnowledgePoint).first().mastery,65)
  self.assertEqual(self.client.post('/api/exams/check-in',json={**data,'actual_hours':2}).status_code,409)
 def test_review_stable_id(self):
  data={'date':'2026-11-03'}
  self.assertEqual(self.client.post('/api/reviews/generate',json=data).status_code,200)
  first=self.client.get('/api/reviews').json()[0]
  self.client.post('/api/reviews/generate',json=data)
  second=self.client.get('/api/reviews').json()[0]
  self.assertEqual(first['id'],second['id'])
  import json
  self.assertIsInstance(json.loads(second['suggestions']),list)
 def test_ocr_rejects(self):
  self.assertEqual(self.client.post('/api/ai/ocr',files={'file':('x.txt',b'hello','text/plain')}).status_code,415)
  self.assertEqual(self.client.post('/api/ai/ocr',files={'file':('x.png',b'x'*(5*1024*1024+1),'image/png')}).status_code,413)
  self.assertEqual(self.client.post('/api/ai/ocr',files={'file':('x.png',b'','image/png')}).status_code,422)

 def test_ocr_transcribes_and_returns_editable_drafts(self):
  def respond(request):
   payload = json.loads(request.content)
   image = payload['messages'][0]['content'][1]['image_url']['url']
   self.assertTrue(image.startswith('data:image/png;base64,'))
   content = json.dumps({
    'recognizedText': '线性代数作业与英语练习',
    'tasks': [
     {'title': '线性代数作业', 'deadline': '2026-12-01 20:00', 'contents': [str(i) for i in range(12)]},
     {'title': '英语练习', 'deadline': '2026-11-31 18:00', 'contents': []},
    ],
   })
   return httpx.Response(200, json={'choices': [{'message': {'content': content}}]})

  async_client = httpx.AsyncClient
  transport = httpx.MockTransport(respond)
  with patch.multiple(llm.settings, OCR_ENGINE='llm', LLM_ENABLED=True, LLM_API_KEY='test-vision-key'), \
       patch.object(llm.httpx, 'AsyncClient', side_effect=lambda **options: async_client(transport=transport, **options)):
   result = self.client.post('/api/ai/ocr', files={'file': ('x.png', b'test image bytes', 'image/png')})

  self.assertEqual(result.status_code, 200, result.text)
  body = result.json()
  self.assertEqual(body['recognizedText'], '线性代数作业与英语练习')
  first, second = body['tasks']
  self.assertEqual(first['deadline'], '2026-12-01 20:00')
  self.assertEqual(len(first['contents']), 10)
  self.assertEqual(first['contents'][-1], '9\n10\n11')
  self.assertEqual(second['deadline'], '')

 def test_ocr_returns_no_tasks_without_text_and_fails_when_model_is_disabled(self):
  self.assertEqual(llm.parse_ocr_response('{"recognizedText":"","tasks":[{"title":"inferred"}]}')['tasks'], [])
  with patch.multiple(llm.settings, OCR_ENGINE='llm', LLM_ENABLED=False):
   response = self.client.post('/api/ai/ocr', files={'file': ('x.webp', b'test image bytes', 'image/webp')})
  self.assertEqual(response.status_code, 503)

 def test_paddle_ocr_returns_task_drafts_with_explicit_dates(self):
  lines = [
   '任务一：数据结构作业',
   '截止时间：2026年12月1日20:00',
   '任务内容：完成第三章练习',
   '任务二：英语练习',
   '提交时间：周五之前',
   '要求：完成一套听力',
  ]
  with patch.object(llm.settings, 'OCR_ENGINE', 'paddleocr'), \
       patch.object(paddle_ocr, '_read_image', return_value=object()), \
       patch.object(paddle_ocr, '_get_engine') as engine:
   engine.return_value.predict.return_value = [{'rec_texts': lines}]
   response = self.client.post('/api/ai/ocr', files={'file': ('x.png', b'test image bytes', 'image/png')})

  self.assertEqual(response.status_code, 200, response.text)
  self.assertEqual(response.json(), {
   'engine': 'paddleocr',
   'recognizedText': '\n'.join(lines),
   'tasks': [
    {'title': '数据结构作业', 'deadline': '2026-12-01 20:00', 'contents': ['完成第三章练习']},
    {'title': '英语练习', 'deadline': '', 'contents': ['完成一套听力']},
   ],
  })
  self.assertEqual(paddle_ocr.extract_tasks('课程通知\n周五教学楼停电'), [])
  self.assertEqual(
   paddle_ocr.extract_tasks('数据结构作业：请于2026-12-01 20:00前完成第三章')[0]['deadline'],
   '2026-12-01 20:00',
  )

 def test_paddle_invalid_image_is_a_client_error(self):
  with patch.object(llm.settings, 'OCR_ENGINE', 'paddleocr'), \
       patch.object(paddle_ocr, '_read_image', side_effect=paddle_ocr.InvalidImage):
   response = self.client.post('/api/ai/ocr', files={'file': ('x.png', b'invalid', 'image/png')})
  self.assertEqual(response.status_code, 422)

 def test_material_extraction_requires_access_and_preserves_paragraphs(self):
  files = {'file': ('notes.md', '# 第一章\n\n仅第三行出现的关键词'.encode(), 'text/markdown')}
  self.assertEqual(TestClient(app).post('/api/materials/extract', files=files).status_code, 401)
  response = self.client.post('/api/materials/extract', files=files)
  self.assertEqual(response.status_code, 200, response.text)
  self.assertEqual(response.json()['chunks'], [
   {'kind': 'paragraph', 'position': 1, 'text': '# 第一章'},
   {'kind': 'paragraph', 'position': 3, 'text': '仅第三行出现的关键词'},
  ])
  for name, content, status in [('old.ppt', b'data', 415), ('broken.docx', b'data', 422), ('empty.txt', b'', 422)]:
   self.assertEqual(self.client.post('/api/materials/extract', files={'file': (name, content)}).status_code, status)

 def test_material_office_text_preserves_slide_and_paragraph_positions(self):
  word = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
  slide = 'http://schemas.openxmlformats.org/presentationml/2006/main'
  draw = 'http://schemas.openxmlformats.org/drawingml/2006/main'
  relation = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
  document = BytesIO()
  with ZipFile(document, 'w') as archive:
   archive.writestr('word/document.xml', f'<w:document xmlns:w="{word}"><w:body><w:p/><w:p><w:r><w:t>第二段</w:t></w:r></w:p></w:body></w:document>')
  result = self.client.post('/api/materials/extract', files={'file': ('notes.docx', document.getvalue())})
  self.assertEqual(result.json()['chunks'], [{'kind': 'paragraph', 'position': 2, 'text': '第二段'}])

  presentation = BytesIO()
  with ZipFile(presentation, 'w') as archive:
   archive.writestr('ppt/presentation.xml', f'<p:presentation xmlns:p="{slide}" xmlns:r="{relation}"><p:sldIdLst><p:sldId r:id="secondFile"/><p:sldId r:id="firstFile"/></p:sldIdLst></p:presentation>')
   archive.writestr('ppt/_rels/presentation.xml.rels', f'<Relationships><Relationship Id="firstFile" Type="{relation}/slide" Target="slides/slide1.xml"/><Relationship Id="secondFile" Type="{relation}/slide" Target="slides/slide2.xml"/></Relationships>')
   for file_number in [1, 2]:
    archive.writestr(f'ppt/slides/slide{file_number}.xml', f'<p:sld xmlns:p="{slide}" xmlns:a="{draw}"><a:p><a:r><a:t>文件编号 {file_number}</a:t></a:r></a:p></p:sld>')
  result = self.client.post('/api/materials/extract', files={'file': ('slides.pptx', presentation.getvalue())})
  self.assertEqual(result.json()['chunks'], [
   {'kind': 'slide', 'position': 1, 'text': '文件编号 2'},
   {'kind': 'slide', 'position': 2, 'text': '文件编号 1'},
  ])
if __name__=='__main__':
 try: unittest.main()
 finally:
  engine.dispose()
  tmp.cleanup()
