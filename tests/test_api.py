import os,sys,tempfile,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'backend'))
tmp=tempfile.TemporaryDirectory()
os.environ['DATABASE_URL']='sqlite:///'+str(Path(tmp.name)/'test.db')
os.environ['API_TOKEN']='test-token-only'
from fastapi.testclient import TestClient
from main import app
from app.database import SessionLocal, engine
from app.models import Exam, Course, KnowledgePoint, SessionLog
class ApiTests(unittest.TestCase):
 def setUp(self): self.client=TestClient(app);self.client.headers['Authorization']='Bearer test-token-only'
 def test_access(self):
  self.assertEqual(TestClient(app).get('/api/tasks').status_code,401)
  self.assertEqual(TestClient(app).get('/api/health').status_code,200)
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
if __name__=='__main__':
 try: unittest.main()
 finally:
  engine.dispose()
  tmp.cleanup()
