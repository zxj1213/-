# -*- coding: utf-8 -*-
"""课程与知识点路由"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Course, KnowledgePoint

router = APIRouter(prefix="/api/courses", tags=["courses"])


@router.get("")
def list_courses(db: Session = Depends(get_db)):
    return db.query(Course).all()


@router.get("/{course_id}/kps")
def list_kps(course_id: str, db: Session = Depends(get_db)):
    """课程知识点掌握度列表(自适应引擎数据源)"""
    kps = (
        db.query(KnowledgePoint)
        .filter(KnowledgePoint.course_id == course_id)
        .order_by(KnowledgePoint.mastery.asc())
        .all()
    )
    return [{"name": k.name, "mastery": k.mastery} for k in kps]


@router.get("/{course_id}/recommendations")
def recommendations(course_id: str, db: Session = Depends(get_db)):
    """AI 学习推荐：基于真实练习结果生成"""
    kps = (
        db.query(KnowledgePoint)
        .filter(KnowledgePoint.course_id == course_id)
        .all()
    )
    from app.services.adaptive import MASTERED_THRESHOLD, WEAK_THRESHOLD

    recs = []
    for k in kps:
        if k.mastery < WEAK_THRESHOLD:
            recs.append({
                "title": f"「{k.name}」掌握度 {k.mastery}%",
                "desc": "已自动减少新知识学习，安排 40 分钟针对性练习",
                "reason": "薄弱知识点",
                "severity": "weak",
            })
        elif k.mastery >= MASTERED_THRESHOLD:
            recs.append({
                "title": f"「{k.name}」已掌握 ({k.mastery}%)",
                "desc": "可以开始学习下一章节的新内容了",
                "reason": "已掌握推进",
                "severity": "good",
            })
    return recs
