# -*- coding: utf-8 -*-
"""应用配置：环境变量驱动，默认值便于本地演示"""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # 数据库：默认 SQLite 便于演示，生产使用华为云 RDS (MySQL)
    DATABASE_URL: str = "sqlite:///./studyflow.db"
    # 缓存：留空则跳过 Redis
    REDIS_URL: str = ""
    # 大模型 API（OpenAI 兼容）
    LLM_BASE_URL: str = "https://api.openai.com/v1"
    LLM_API_KEY: str = ""
    LLM_MODEL: str = "gpt-4o-mini"
    LLM_ENABLED: bool = False

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
