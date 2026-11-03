# -*- coding: utf-8 -*-
"""每日复盘路由：汇总真实数据生成复盘"""
import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import DailyReview, SessionLog, Task
from app.schemas import ReviewGenerateRequest, ReviewGenerateResponse

router = APIRouter(prefix="/api/reviews", tags=["reviews"])


@router.get("")
def list_reviews(db: Session = Depends(get_db)):
    return db.query(DailyReview).order_by(DailyReview.date.desc()).limit(7).all()


@router.post("/generate", response_model=ReviewGenerateResponse)
def generate(req: ReviewGenerateRequest, db: Session = Depends(get_db)):
    """基于真实任务/专注数据生成每日复盘"""
    date = req.date or datetime.now().strftime("%Y-%m-%d")

    total_tasks = db.query(Task).count()
    done_tasks = db.query(Task).filter(Task.status == "已完成").count()

    minutes = (
        db.query(func.coalesce(func.sum(SessionLog.minutes), 0))
        .filter(SessionLog.date == date)
        .scalar()
    )
    study_hours = round(minutes / 60, 1)

    planned_hours = 5.0
    efficiency = min(100, round(study_hours / planned_hours * 70 +
                                (done_tasks / total_tasks * 30 if total_tasks else 30)))

    explanation = (
        f"今日实际学习 {study_hours}h，低于计划 {planned_hours}h。"
        "主要原因是任务安排与真实学习效率存在偏差，部分章节练习耗时超出预期。"
        if study_hours < planned_hours
        else f"今日完成学习 {study_hours}h，与计划基本一致。学习节奏稳定。"
    )

    suggestions = [
        "明日优先补上未完成的章节进度",
        "编程作业建议预留20%缓冲时间应对调试",
    ]

    review = DailyReview(
        id=uuid.uuid4().hex,
        date=date,
        study_hours=study_hours,
        completed_tasks=done_tasks,
        total_tasks=total_tasks,
        efficiency_score=efficiency,
        deviation_explanation=explanation,
        suggestions=str(suggestions),
    )
    existing = db.query(DailyReview).filter(DailyReview.date == date).first()
    if existing:
        for k, v in review.__dict__.items():
            if not k.startswith("_"):
                setattr(existing, k, v)
    else:
        db.add(review)
    db.commit()

    return ReviewGenerateResponse(
        date=date,
        study_hours=study_hours,
        completed_tasks=done_tasks,
        total_tasks=total_tasks,
        efficiency_score=efficiency,
        deviation_explanation=explanation,
        suggestions=suggestions,
    )
