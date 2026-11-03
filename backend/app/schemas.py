# -*- coding: utf-8 -*-
"""Pydantic 请求/响应模型"""
from typing import List, Optional, Literal
from datetime import date as Date

from pydantic import BaseModel, Field, model_validator


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=16000)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=16000)
    history: List[ChatMessage] = Field(default_factory=list, max_length=8)


class ChatResponse(BaseModel):
    reply: str
    engine: str  # "llm" 或 "rules"


class PracticeResult(BaseModel):
    kp: str
    correct: int = Field(ge=0)
    total: int = Field(gt=0, le=10000)
    minutes: int = Field(default=30, ge=0, le=1440)

    @model_validator(mode="after")
    def validate_score(self):
        if self.correct > self.total:
            raise ValueError("correct must not exceed total")
        return self


class ExamCheckInRequest(BaseModel):
    request_id: str = Field(min_length=8, max_length=64)
    exam_id: str
    completed: bool = False
    actual_hours: float = Field(default=0, ge=0, le=24, allow_inf_nan=False)
    results: List[PracticeResult] = []


class ReplanResponse(BaseModel):
    explanation: str
    estimated: int
    avg_mastery: int


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = ""
    source: str = "手动添加"
    category: str = "作业"
    priority: str = "中"
    deadline: str = ""
    estimated_duration: int = Field(default=60, ge=1, le=1440)
    course_name: str = ""


class ReviewGenerateRequest(BaseModel):
    date: Date


class ReviewGenerateResponse(BaseModel):
    date: str
    study_hours: float
    completed_tasks: int
    total_tasks: int
    efficiency_score: int
    deviation_explanation: str
    suggestions: List[str]
