# -*- coding: utf-8 -*-
"""考试 Agent 路由：打卡 → 自适应引擎重排计划(核心创新接口)"""
import uuid
import json
import hashlib
from sqlalchemy.exc import IntegrityError
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Exam, KnowledgePoint, SessionLog, CheckInReceipt
from app.schemas import ExamCheckInRequest, ReplanResponse
from app.services.adaptive import record_practice, replan

router = APIRouter(prefix="/api/exams", tags=["exams"])


@router.get("")
def list_exams(db: Session = Depends(get_db)):
    return db.query(Exam).all()


@router.get("/{exam_id}/plan")
def get_plan(exam_id: str, db: Session = Depends(get_db)):
    """生成/返回备考计划(基于当前知识点掌握度)"""
    exam = db.get(Exam, exam_id)
    if not exam:
        raise HTTPException(404, "exam not found")
    kps = {
        k.name: k.mastery
        for k in db.query(KnowledgePoint).filter(KnowledgePoint.course_id == exam.course_id).all()
    }
    days_left = remaining_days(exam.date)
    return replan(exam.name, kps, exam.target_score, days_left)


@router.post("/check-in", response_model=ReplanResponse)
def check_in(req: ExamCheckInRequest, db: Session = Depends(get_db)):
    """
    每日打卡：记录真实练习结果 → 更新知识点掌握度 → 重排计划
    这是"根据真实学习结果改变决策"的后端实现
    """
    digest = hashlib.sha256(req.model_dump_json().encode()).hexdigest()
    receipt = db.get(CheckInReceipt, req.request_id)
    if receipt:
        if receipt.request_hash != digest:
            raise HTTPException(409, "request_id already used for another payload")
        return ReplanResponse.model_validate_json(receipt.response)
    exam = db.get(Exam, req.exam_id)
    if not exam:
        raise HTTPException(404, "exam not found")

    days_left = remaining_days(exam.date)

    # 1. 更新知识点掌握度
    for r in req.results:
        kp = (
            db.query(KnowledgePoint)
            .filter(
                KnowledgePoint.course_id == exam.course_id,
                KnowledgePoint.name == r.kp,
            )
            .first()
        )
        if kp:
            kp.mastery = record_practice(kp.mastery, r.correct, r.total)

    # 2. 记录专注时长
    db.add(SessionLog(
        id=uuid.uuid4().hex,
        date=datetime.now().strftime("%Y-%m-%d"),
        course_id=exam.course_id,
        course_name=exam.course_name,
        minutes=int(req.actual_hours * 60),
    ))
    db.flush()

    # 3. 自适应引擎重排计划
    kps = {
        k.name: k.mastery
        for k in db.query(KnowledgePoint).filter(KnowledgePoint.course_id == exam.course_id).all()
    }
    days_left = remaining_days(exam.date)
    result = replan(exam.name, kps, exam.target_score, days_left)

    response = ReplanResponse(
        explanation=result["explanation"],
        estimated=result["estimated"],
        avg_mastery=result["avg"],
    )
    db.add(CheckInReceipt(id=req.request_id, request_hash=digest, response=response.model_dump_json()))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "check-in conflict; retry with the same request_id")
    return response


def remaining_days(value):
    try:
        return max(0, (datetime.strptime(value[:10], "%Y-%m-%d").date() - datetime.now().date()).days)
    except (ValueError, TypeError):
        raise HTTPException(422, "invalid exam date")
