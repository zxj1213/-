# 学迹 StudyFlow — FastAPI 后端

对应提案技术路线：Python + FastAPI / 大模型API + 规则算法 / 华为云RDS(MySQL) / 华为云Redis

## 运行

```bash
pip install -r requirements.txt   # 建议 Python 3.10+
cp .env.example .env              # 按需配置
uvicorn main:app --reload --port 8000
```

接口文档：启动后访问 http://127.0.0.1:8000/docs (Swagger UI)

## 接口一览

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | /api/health | 健康检查（前端用于探测后端在线） |
| POST | /api/ai/chat | AI 对话：大模型优先，失败降级规则引擎 |
| POST | /api/ai/ocr | OCR 截图识别，返回原文和待确认任务 |
| POST | /api/materials/extract | 提取资料正文，返回 PDF 页码、幻灯片编号或段落编号 |
| GET/POST | /api/tasks | 任务列表 / 创建 |
| POST | /api/tasks/parse | AI 解析任务描述（规则引擎） |
| GET | /api/courses | 课程列表 |
| GET | /api/courses/{id}/kps | 知识点掌握度 |
| GET | /api/courses/{id}/recommendations | AI 学习推荐 |
| GET | /api/exams | 考试列表 |
| GET | /api/exams/{id}/plan | 生成备考计划 |
| POST | /api/exams/check-in | **每日打卡 → 自适应引擎重排计划（核心创新）** |
| GET | /api/reviews | 复盘列表 |
| POST | /api/reviews/generate | 基于真实数据生成每日复盘 |

## 说明

- 未配置数据库时自动使用本地 SQLite（`studyflow.db`），配置 `DATABASE_URL` 后切换华为云 RDS (MySQL)
- AI 对话在模型不可用时降级为内置规则引擎。
- 自适应引擎逻辑见 `app/services/adaptive.py`，与前端 `frontend/src/services/adaptive.js` 同源

## 截图 OCR

默认使用 [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR) 的 PP-OCRv5 轻量模型在后端 CPU 上转录图片。任务草稿从原文中的名称、截止时间和内容提取。日期或时间不明确时请在预览中补齐。

在 `backend` 目录为后端环境安装 OCR 依赖并下载模型。建议使用 Python 3.12。

```bash
python -m pip install -r requirements-ocr.txt
python -c "from app.services.paddle_ocr import warm_up; warm_up()"
```

第一次初始化需要下载模型。之后识别在本地运行。使用普通学迹账号登录后即可调用 OCR。

使用原有的云端视觉识别时，设置 `OCR_ENGINE=llm`、`LLM_ENABLED=true`，并配置支持图片输入的 `LLM_MODEL` 和有效的 `LLM_API_KEY`。

## 知识库资料

支持 PDF、PPTX、DOCX、TXT 和 Markdown。每份最大 10 MiB，PDF 最多 200 页，其中最多 15 张无文字层的页面由本地 PaddleOCR 处理。安装 OCR 依赖及模型后才能处理扫描页。

上传接口使用学迹账号会话。后端只提取正文并返回来源位置，文件及索引由前端保存在当前浏览器的 IndexedDB 中，按网站地址和账号区分。

## 登录会话

网页通过 `/api/auth/login`、`/api/auth/refresh` 和 `/api/auth/logout` 管理会话。访问令牌有效期为 15 分钟，保存在浏览器内存。续期凭据保存在 HttpOnly、Secure、SameSite=Strict Cookie 中，每次使用后轮换。自登录起满 7 天需重新验证密码。服务端数据库只保存凭据的摘要。

本地开发使用 `http://localhost:5173`。对外部署时须使用 HTTPS，将网页的完整 Origin 加入 `CORS_ORIGINS`，并在反向代理保留原始 Host。默认仅允许本机创建服务账号。需要公开注册时，配置 `AUTH_PUBLIC_REGISTRATION=true`。

`LLM_API_KEY` 由后端环境变量或本地 `.env` 提供，换钥后重启后端。`API_TOKEN` 是可选的非浏览器服务间凭据。

## 统一账号和个人资料

新注册选择一个手机号或邮箱作为固定登录账号。已有服务账号可先用原登录名进入，再凭当前密码绑定一次。手机号和邮箱目前用于账号标识和密码登录。

个人资料按服务端账号 ID 保存。连接同一后端的客户端共享用户名、学校、专业、年级和头像。版本检查用于防止覆盖另一端已保存的修改。头像原图支持 JPEG、PNG、WebP，最大 5 MiB。浏览器在用户确认裁剪后上传 256 × 256 的头像。任务和知识库原件继续使用各浏览器的本地存储。
