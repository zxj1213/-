# -*- coding: utf-8 -*-
"""任务路由：增删改查 + AI 解析创建"""
import re
import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Task
from app.schemas import TaskCreate

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


def _parse(text: str) -> dict:
    """规则引擎：从自然语言提取任务信息(与前端 parseTaskFromText 同源)"""
    today = datetime.now()
    fmt = lambda d: d.strftime("%Y-%m-%d")

    priority = "中"
    if re.search(r"紧急|马上|立刻|尽快|来不及|截止今晚|明天截止", text):
        priority = "紧急"
    elif re.search(r"重要|优先|重点", text):
        priority = "高"
    elif re.search(r"有空|不急|随便|阅读|看完", text):
        priority = "低"

    category = "作业"
    if re.search(r"考试|复习|备考|四级|六级", text):
        category = "考试"
    elif re.search(r"项目|开发|小程序|代码", text):
        category = "项目"
    elif re.search(r"竞赛|比赛|报名", text):
        category = "竞赛"

    estimated = 60
    m = re.search(r"(\d+(?:\.\d+)?)\s*(?:个)?(?:小时|h|H)", text)
    if m:
        estimated = round(float(m.group(1)) * 60)

    if "今天" in text or "今晚" in text or "今日" in text:
        deadline = fmt(today) + " 23:59"
    elif "明天" in text or "明日" in text:
        deadline = fmt(today + timedelta(days=1)) + " 23:59"
    else:
        deadline = fmt(today) + " 23:59"

    return {
        "title": text[:40] + ("..." if len(text) > 40 else ""),
        "description": text,
        "source": "AI解析",
        "category": category,
        "priority": priority,
        "status": "待完成",
        "deadline": deadline,
        "estimated_duration": estimated,
        "course_name": "",
    }


@router.get("")
def list_tasks(db: Session = Depends(get_db)):
    return db.query(Task).order_by(Task.created_at.desc()).all()


@router.post("/parse")
def ai_parse(req: TaskCreate):
    """AI 解析任务描述(规则引擎实现，接入大模型后可替换为 LLM 结构化输出)"""
    parsed = _parse(req.title or req.description)
    return parsed


@router.post("")
def create_task(req: TaskCreate, db: Session = Depends(get_db)):
    parsed = req.model_dump()
    parsed.update({"id": uuid.uuid4().hex})
    task = Task(**parsed)
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.delete("/{task_id}")
def delete_task(task_id: str, db: Session = Depends(get_db)):
    task = db.get(Task, task_id)
    if task:
        db.delete(task)
        db.commit()
    return {"ok": True}
