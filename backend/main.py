# -*- coding: utf-8 -*-
"""
学迹 StudyFlow - FastAPI 后端入口
技术路线(图2)：Python + FastAPI / 大模型API + 规则算法 / 华为云RDS(MySQL) / 华为云Redis

运行方式：
    pip install -r requirements.txt
    uvicorn main:app --reload --port 8000
"""
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
import secrets
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
        allow_origins=settings.CORS_ORIGINS,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 建表(生产环境建议改用 Alembic 迁移)
    Base.metadata.create_all(bind=engine)

    @app.middleware("http")
    async def require_access(request: Request, call_next):
        # 未配置访问凭据时仅开放健康检查，避免意外发布无保护的数据库和付费接口。
        if request.url.path.startswith("/api/") and request.url.path != "/api/health" and request.method != "OPTIONS":
            token = request.headers.get("Authorization", "").removeprefix("Bearer ")
            if not settings.API_TOKEN or not secrets.compare_digest(token, settings.API_TOKEN):
                return JSONResponse(status_code=401, content={"detail": "API access token required"})
        return await call_next(request)

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
