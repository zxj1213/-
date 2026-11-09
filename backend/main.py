# -*- coding: utf-8 -*-
"""
学迹 StudyFlow - FastAPI 后端入口
技术路线(图2)：Python + FastAPI / 大模型API + 规则算法 / 华为云RDS(MySQL) / 华为云Redis

运行方式：
    pip install -r requirements.txt
    uvicorn main:app --reload --port 8000
"""
from fastapi import FastAPI, Request
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
import secrets
from fastapi.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool

from app.config import settings
from app.database import Base, engine
from app.routers import account, ai, auth as auth_routes, tasks, courses, exams, reviews, materials
from app.services import auth


USER_API_PATHS = {
    "/api/ai/chat", "/api/ai/ocr", "/api/materials/extract",
    "/api/auth/password", "/api/auth/verify-password",
}


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

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError):
        if request.url.path.startswith(("/api/auth/", "/api/account/")):
            auth_routes.logger.warning("auth_invalid_payload")
            return JSONResponse(status_code=422, content={"detail": "Invalid authentication input"})
        return await request_validation_exception_handler(request, exc)

    @app.middleware("http")
    async def require_access(request: Request, call_next):
        path = request.url.path
        if (path.startswith("/api/") and path != "/api/health" and request.method != "OPTIONS"
                and path not in auth_routes.public_paths):
            bearer, _, token = request.headers.get("Authorization", "").partition(" ")
            token = token if bearer.lower() == "bearer" else ""
            user_id = await run_in_threadpool(auth.resolve_access, token)
            if user_id:
                if request.method not in account.user_methods.get(path, set()) and (request.method != "POST" or path not in USER_API_PATHS):
                    return JSONResponse(status_code=403, content={"detail": "Endpoint requires service credentials"})
                request.state.auth_user_id = user_id
            else:
                # The legacy key is reserved for existing non-browser service integrations.
                trusted_service = (not path.startswith(("/api/auth/", "/api/account/")) and settings.API_TOKEN
                    and "origin" not in request.headers and "sec-fetch-site" not in request.headers
                    and secrets.compare_digest(token.encode(), settings.API_TOKEN.encode()))
                if not trusted_service:
                    return JSONResponse(status_code=401, content={"detail": "Authentication required"})
        response = await call_next(request)
        if path.startswith(("/api/auth/", "/api/account/")):
            response.headers["Cache-Control"] = "no-store"
        return response

    app.include_router(ai.router)
    app.include_router(auth_routes.router)
    app.include_router(account.router)
    app.include_router(tasks.router)
    app.include_router(courses.router)
    app.include_router(exams.router)
    app.include_router(reviews.router)
    app.include_router(materials.router)

    @app.get("/api/health")
    def health():
        return {"status": "ok", "app": "studyflow", "llm_enabled": settings.LLM_ENABLED}

    return app


app = create_app()
