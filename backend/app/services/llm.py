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


async def ocr_with_llm(file_bytes: bytes, mime_type: str) -> str:
    """真实视觉识别；供应商或模型不支持图片时由路由明确返回不可用。"""
    import base64
    if not settings.LLM_ENABLED or not settings.LLM_API_KEY:
        raise RuntimeError("LLM not enabled")
    encoded = base64.b64encode(file_bytes).decode("ascii")
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            f"{settings.LLM_BASE_URL.rstrip('/')}/chat/completions",
            headers={"Authorization": f"Bearer {settings.LLM_API_KEY}"},
            json={"model": settings.LLM_MODEL, "messages": [{"role": "user", "content": [
                {"type": "text", "text": "请准确转录图片中的文字；无法辨认请注明，不要虚构任务。"},
                {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{encoded}"}}
            ]}], "max_tokens": 2000},
        )
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]
