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
| POST | /api/ai/ocr | OCR 截图识别（多模态大模型接入点） |
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
- 未配置大模型时（`LLM_ENABLED=false`），AI 接口自动降级为内置规则引擎，保证可用
- 自适应引擎逻辑见 `app/services/adaptive.py`，与前端 `frontend/src/services/adaptive.js` 同源
