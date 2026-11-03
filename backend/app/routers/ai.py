# -*- coding: utf-8 -*-
"""AI 路由：对话(大模型+规则降级) / OCR"""
from fastapi import APIRouter, File, UploadFile, HTTPException
import logging
logger = logging.getLogger(__name__)

from app.schemas import ChatRequest, ChatResponse
from app.services import llm

router = APIRouter(prefix="/api/ai", tags=["ai"])

# ---------------- 规则引擎降级回复(与前端 rules 引擎同源) ----------------

def rule_reply(message: str) -> str:
    text = message.lower()
    if any(k in text for k in ["你好", "hi", "hello", "在吗"]):
        return ("你好呀！👋 我是学迹AI学习管家～\n\n"
                "我能根据你的真实学习结果动态调整学习计划，"
                "而不是只生成一张漂亮的计划表。需要帮你看看今天的安排吗？")
    if "二叉树" in text:
        return ("关于二叉树：\n\n📉 最近一次练习正确率 45%，掌握度处于低位。\n\n"
                "我的决策：\n• 暂停二叉树相关的新知识推进\n"
                "• 安排 40 分钟针对性练习：遍历算法 + 树的性质题\n"
                "• 正确率回升到 60% 以上后再恢复章节学习")
    if any(k in text for k in ["考试", "复习", "备考"]):
        return ("📚 备考建议：\n\n• 优先复习薄弱章节，别平均用力\n"
                "• 练习正确率低于60%的知识点会自动触发针对性练习\n"
                "• 每天保持2-3小时专注学习，考前一周进入冲刺模式")
    if any(k in text for k in ["竞赛", "保研", "就业"]):
        return ("从你的学业画像看：\n\n🎓 保研：清华大学计算机系(匹配75%，需补科研论文+英语六级)\n"
                "🏆 竞赛：华为云AI创新应用大赛(匹配90%)\n"
                "💼 就业：字节跳动后端(匹配60%，需补Go语言、分布式系统)\n\n"
                "去「学业规划」页面可查看详细能力缺口分析～")
    return ("收到你的问题！🤔 我是学迹AI学习管家，可以帮你：\n"
            "• 解析任务安排\n• 动态调整学习计划\n• 分析薄弱知识点\n"
            "换个方式描述问题，我会更精准回答～")


@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    """AI 对话：优先大模型，失败降级规则引擎"""
    try:
        reply = await llm.chat_with_llm(req.message, [m.model_dump() for m in req.history])
        return ChatResponse(reply=reply, engine="llm")
    except Exception as exc:
        logger.warning("chat fallback: %s", type(exc).__name__)
        return ChatResponse(reply=rule_reply(req.message), engine="rules")


@router.post("/ocr")
async def ocr(file: UploadFile = File(...)):
    """OCR 识别截图：接入视觉大模型；未启用时返回规则占位结果"""
    if file.content_type not in {"image/png", "image/jpeg", "image/webp"}:
        raise HTTPException(415, "Only PNG, JPEG and WebP images are supported")
    data = await file.read(5 * 1024 * 1024 + 1)
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(413, "Image exceeds 5 MiB")
    try:
        text = await llm.ocr_with_llm(data, file.content_type)
    except Exception as exc:
        logger.warning("ocr unavailable: %s", type(exc).__name__)
        raise HTTPException(503, "OCR unavailable; no tasks were extracted")
    return {"recognizedText": text, "tasks": [], "engine": "llm"}
