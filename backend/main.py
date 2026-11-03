# -*- coding: utf-8 -*-
"""
学迹 StudyFlow - FastAPI 后端入口
技术路线(图2)：Python + FastAPI / 大模型API + 规则算法 / 华为云RDS(MySQL) / 华为云Redis

运行方式：
    pip install -r requirements.txt
    uvicorn main:app --reload --port 8000
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, engine
from app.routers import ai, tasks, courses, exams, reviews


def create_app() -> FastAPI:
    app = FastAPI(
        title="学迹 StudyFlow API",
        version="1.0.0",
        description="AI自适应学习管家后端：根据真实学习结果动态调整计划",
    )

    # 跨域：允许前端 Vite 开发服务器访问
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 建表(生产环境建议改用 Alembic 迁移)
    Base.metadata.create_all(bind=engine)

    app.include_router(ai.router)
    app.include_router(tasks.router)
    app.include_router(courses.router)
    app.include_router(exams.router)
    app.include_router(reviews.router)

    @app.get("/api/health")
    def health():
        return {"status": "ok", "app": "studyflow", "llm_enabled": settings.LLM_ENABLED}

    return app


app = create_app()
