# -*- coding: utf-8 -*-
"""数据库模型：任务 / 课程 / 考试 / 知识点掌握度 / 专注记录 / 每日复盘"""
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class Task(Base):
    __tablename__ = "tasks"

    id = Column(String(64), primary_key=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, default="")
    source = Column(String(20), default="手动添加")
    category = Column(String(20), default="作业")
    priority = Column(String(10), default="中")
    status = Column(String(10), default="待完成")
    deadline = Column(String(20), default="")
    estimated_duration = Column(Integer, default=60)
    course_name = Column(String(50), default="")
    sub_tasks = Column(Text, default="[]")  # JSON 字符串
    created_at = Column(String(20), default=lambda: datetime.now().strftime("%Y-%m-%d %H:%M"))
    updated_at = Column(String(20), default=lambda: datetime.now().strftime("%Y-%m-%d %H:%M"))


class Course(Base):
    __tablename__ = "courses"

    id = Column(String(64), primary_key=True)
    code = Column(String(20), default="")
    name = Column(String(50), nullable=False)
    english_name = Column(String(100), default="")
    type = Column(String(10), default="必修")
    credits = Column(Integer, default=3)
    teacher = Column(String(30), default="")
    exam_date = Column(String(20), default="")


class Exam(Base):
    __tablename__ = "exams"

    id = Column(String(64), primary_key=True)
    name = Column(String(100), nullable=False)
    course_name = Column(String(50), default="")
    course_id = Column(String(64), ForeignKey("courses.id"), default="")
    date = Column(String(20), default="")
    duration = Column(Integer, default=120)
    target_score = Column(Integer, default=85)
    mastery_level = Column(Integer, default=60)


class KnowledgePoint(Base):
    """知识点掌握度：自适应学习引擎的数据基础"""

    __tablename__ = "knowledge_points"

    id = Column(Integer, primary_key=True, autoincrement=True)
    course_id = Column(String(64), ForeignKey("courses.id"), index=True)
    name = Column(String(50), nullable=False)
    mastery = Column(Integer, default=50)
    practice_records = Column(Text, default="[]")  # JSON: [{date, correct, total, rate}]
    updated_at = Column(String(20), default=lambda: datetime.now().strftime("%Y-%m-%d %H:%M"))

    course = relationship("Course")


class SessionLog(Base):
    """Study Session 专注记录"""

    __tablename__ = "session_logs"

    id = Column(String(64), primary_key=True)
    date = Column(String(20), index=True)
    course_id = Column(String(64), default="")
    course_name = Column(String(50), default="")
    minutes = Column(Integer, default=0)
    kp = Column(String(50), default="")
    correct = Column(Integer, default=0)
    total = Column(Integer, default=0)
    task_completed = Column(Boolean, default=False)


class DailyReview(Base):
    __tablename__ = "daily_reviews"

    id = Column(String(64), primary_key=True)
    date = Column(String(20), index=True)
    study_hours = Column(Float, default=0)
    completed_tasks = Column(Integer, default=0)
    total_tasks = Column(Integer, default=0)
    efficiency_score = Column(Integer, default=0)
    deviation_explanation = Column(Text, default="")
    suggestions = Column(Text, default="[]")
    user_confirmed = Column(Boolean, default=False)
