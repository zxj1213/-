# -*- coding: utf-8 -*-
"""
大模型 API 接入层(OpenAI 兼容协议)
图2技术路线：大模型API + 提示词及 Skills；第一版不训练模型，
通过大模型与规则算法配合完成核心功能。大模型不可用时自动降级规则引擎。
"""
import httpx

from app.config import settings

# 提示词即 Skills：通过系统提示词定义学迹的核心能力边界
SYSTEM_PROMPT = """你是「学迹 StudyFlow」的 AI 学习管家，核心能力：
1. 解析任务描述，提取截止时间、优先级、预计耗时
2. 根据真实练习结果(正确率)动态调整学习计划：
   - 知识点掌握度低于 60%：自动减少新知识学习，安排针对性练习
   - 掌握度达到 85%：推进下一章节
3. 每次调整计划时必须说明决策依据，让调整"有说服力"
回答使用中文，简洁友好。"""


async def chat_with_llm(message: str, history: list) -> str:
    """调用 OpenAI 兼容的大模型接口，失败抛出异常由调用方降级"""
    if not settings.LLM_ENABLED or not settings.LLM_API_KEY:
        raise RuntimeError("LLM not enabled")

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for msg in history[-8:]:
        messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})
    messages.append({"role": "user", "content": message})

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{settings.LLM_BASE_URL}/chat/completions",
            headers={"Authorization": f"Bearer {settings.LLM_API_KEY}"},
            json={"model": settings.LLM_MODEL, "messages": messages, "temperature": 0.7},
        )
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]


async def ocr_with_llm(file_bytes: bytes, filename: str) -> str:
    """视觉大模型 OCR：识别截图中的任务信息(简化演示实现)"""
    if not settings.LLM_ENABLED:
        raise RuntimeError("LLM not enabled")
    # 实际项目中：图片转 base64 后调用多模态大模型，
    # 提示词要求输出 JSON 任务列表。
    # 这里返回占位文本，接入真实多模态接口后替换。
    return f"[OCR占位] 已接收图片 {filename} ({len(file_bytes)} bytes)，接入多模态大模型后返回识别结果"
