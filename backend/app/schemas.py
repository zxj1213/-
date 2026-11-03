# -*- coding: utf-8 -*-
"""Pydantic 请求/响应模型"""
from typing import List, Optional

from pydantic import BaseModel


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []


class ChatResponse(BaseModel):
    reply: str
    engine: str  # "llm" 或 "rules"


class PracticeResult(BaseModel):
    kp: str
    correct: int
    total: int
    minutes: int = 30


class ExamCheckInRequest(BaseModel):
    exam_id: str
    completed: bool = False
    actual_hours: float = 0
    results: List[PracticeResult] = []


class ReplanResponse(BaseModel):
    explanation: str
    estimated: int
    avg_mastery: int


class TaskCreate(BaseModel):
    title: str
    description: str = ""
    source: str = "手动添加"
    category: str = "作业"
    priority: str = "中"
    deadline: str = ""
    estimated_duration: int = 60
    course_name: str = ""


class ReviewGenerateRequest(BaseModel):
    date: str


class ReviewGenerateResponse(BaseModel):
    date: str
    study_hours: float
    completed_tasks: int
    total_tasks: int
    efficiency_score: int
    deviation_explanation: str
    suggestions: List[str]
