# -*- coding: utf-8 -*-
"""考试 Agent 路由：打卡 → 自适应引擎重排计划(核心创新接口)"""
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Exam, KnowledgePoint, SessionLog
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
        return {"error": "exam not found"}
    kps = {
        k.name: k.mastery
        for k in db.query(KnowledgePoint).filter(KnowledgePoint.course_id == exam.course_id).all()
    } or {"二叉树": 45, "图结构": 88, "排序": 62}
    days_left = max((datetime.strptime(exam.date[:10], "%Y-%m-%d") - datetime.now()).days, 3)
    return replan(exam.name, kps, exam.target_score, days_left)


@router.post("/check-in", response_model=ReplanResponse)
def check_in(req: ExamCheckInRequest, db: Session = Depends(get_db)):
    """
    每日打卡：记录真实练习结果 → 更新知识点掌握度 → 重排计划
    这是"根据真实学习结果改变决策"的后端实现
    """
    exam = db.get(Exam, req.exam_id)
    if not exam:
        return ReplanResponse(explanation="exam not found", estimated=0, avg_mastery=0)

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
    db.commit()

    # 3. 自适应引擎重排计划
    kps = {
        k.name: k.mastery
        for k in db.query(KnowledgePoint).filter(KnowledgePoint.course_id == exam.course_id).all()
    } or {"二叉树": 45, "图结构": 88, "排序": 62}
    days_left = max((datetime.strptime(exam.date[:10], "%Y-%m-%d") - datetime.now()).days, 3)
    result = replan(exam.name, kps, exam.target_score, days_left)

    return ReplanResponse(
        explanation=result["explanation"],
        estimated=result["estimated"],
        avg_mastery=result["avg"],
    )
