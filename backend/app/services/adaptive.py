# -*- coding: utf-8 -*-
"""
自适应学习引擎(核心创新) - Python 版
与前端 frontend/src/services/adaptive.js 逻辑一致。

核心理念(图2)：根据真实学习结果动态改变决策，
而不是仅仅生成一张漂亮的计划表。

规则：
- 知识点掌握度 < 60%  → 暂停推进新知识，自动插入"针对性练习"
- 掌握度 60%-85%     → 轻量复习 + 正常推进
- 掌握度 ≥ 85%       → 判定已掌握，可进入下一新章节
"""
import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional

WEAK_THRESHOLD = 60
MASTERED_THRESHOLD = 85


def record_practice(mastery: int, correct: int, total: int) -> int:
    """加权平滑更新掌握度：新掌握度 = 旧掌握度*0.5 + 正确率*0.5"""
    if total <= 0:
        return mastery
    rate = round(correct / total * 100)
    return round(mastery * 0.5 + rate * 0.5)


def avg_mastery(kps: Dict[str, int]) -> int:
    if not kps:
        return 0
    return round(sum(kps.values()) / len(kps))


def weak_points(kps: Dict[str, int]) -> List[str]:
    """低于阈值的知识点(按掌握度升序)"""
    return [name for name, m in sorted(kps.items(), key=lambda x: x[1]) if m < WEAK_THRESHOLD]


def replan(
    exam_name: str,
    kps: Dict[str, int],
    target_score: int,
    days_left: int,
    today: Optional[datetime] = None,
) -> Dict:
    """
    根据真实练习结果重排备考计划，返回：
    { plans, explanation, estimated, avg }
    """
    today = today or datetime.now()
    weak = weak_points(kps)
    avg = avg_mastery(kps)
    days_left = max(days_left, 3)

    plans = []
    for i in range(days_left):
        d = today + timedelta(days=i)
        is_today = i == 0
        chapters = []
        practice_tasks = []

        if is_today and weak:
            # 今日：薄弱知识点针对性练习优先，新知识自动让位
            phase = "practice"
            for kp in weak[:3]:
                chapters.append({
                    "name": f"针对性练习：{kp}",
                    "key_points": ["回顾核心概念", "错题重做", "变式训练"],
                    "estimated_minutes": 40,
                    "targeted": True,
                })
        elif i < 5:
            phase = "chapter"
            chapters.append({
                "name": f"第{i + 1}章 重点内容",
                "key_points": ["核心概念", "算法实现", "复杂度分析"],
                "estimated_minutes": 90,
                "targeted": False,
            })
        elif i < days_left - 3:
            phase = "practice"
            practice_tasks.append({"type": "习题", "count": 10, "estimated_minutes": 60})
        else:
            phase = "sprint"
            practice_tasks.append({"type": "往年真题", "count": 20, "estimated_minutes": 90})

        plans.append({
            "date": d.strftime("%Y-%m-%d"),
            "day_number": i + 1,
            "phase": phase,
            "chapters": chapters,
            "practice_tasks": practice_tasks,
            "targeted_today": is_today and bool(weak),
        })

    # 决策解释：让 AI 的调整"有说服力"
    lines = []
    if weak:
        names = "、".join(f"「{w}」({kps[w]}%)" for w in weak[:3])
        lines.append(f"检测到 {names} 掌握度低于 {WEAK_THRESHOLD}% 阈值")
        lines.append("→ 今日自动减少新知识学习，改为针对性练习(各 40 分钟)")
        lines.append(f"→ 待正确率回升至 {WEAK_THRESHOLD}% 以上再恢复章节推进")
    else:
        lines.append(f"全部知识点掌握度均不低于 {WEAK_THRESHOLD}%，可正常推进新章节")
    if avg >= MASTERED_THRESHOLD:
        lines.append(f"平均掌握度 {avg}%，已达到掌握水平，建议提前进入刷题阶段")

    estimated = round(avg * 0.75 + 25)
    lines.append(f"按当前趋势预估成绩 {estimated}-{min(estimated + 8, 100)} 分(目标 {target_score} 分)")

    return {
        "exam_name": exam_name,
        "plans": plans,
        "explanation": "\n".join(lines),
        "estimated": estimated,
        "avg": avg,
    }
