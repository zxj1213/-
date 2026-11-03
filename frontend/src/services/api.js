/**
 * 学迹 StudyFlow - API 客户端
 * 图2技术路线：前端 Vue3 + Element Plus / 后端 Python FastAPI / 大模型API + 提示词及Skills
 *
 * 当 FastAPI 后端在 http://127.0.0.1:8000 运行时(需本机安装 Python)，
 * AI 对话会优先调用真实大模型接口；后端不可用时自动降级为前端规则引擎，
 * 保证演示环境离线可用。
 */
import axios from 'axios'
import { generateRuleReply, simulateOcr } from './ai'

const http = axios.create({
  baseURL: '/api',
  timeout: 8000
})

let backendAvailable = false

/** 探测后端是否可用 */
export async function checkBackend() {
  try {
    const res = await axios.get('/api/health', { timeout: 2000 })
    backendAvailable = res.status === 200
  } catch (e) {
    backendAvailable = false
  }
  return backendAvailable
}

export function isBackendAvailable() {
  return backendAvailable
}

/** AI 对话：优先大模型 API(经后端)，失败降级规则引擎 */
export async function chatWithAI(message, ctx, history = []) {
  try {
    const res = await http.post('/ai/chat', {
      message,
      history: history.slice(-8).map(m => ({ role: m.role, content: m.content }))
    })
    if (res.data && res.data.reply) {
      backendAvailable = true
      return { reply: res.data.reply, engine: 'llm' }
    }
    throw new Error('empty reply')
  } catch (e) {
    backendAvailable = false
    return { reply: generateRuleReply(message, ctx), engine: 'rules' }
  }
}

/** OCR 识别：后端可用时上传图片，否则模拟识别 */
export async function ocrRecognize(file, fileName) {
  try {
    const form = new FormData()
    form.append('file', file)
    const res = await http.post('/ai/ocr', form)
    backendAvailable = true
    return res.data
  } catch (e) {
    backendAvailable = false
    // 演示模式：模拟识别结果
    return simulateOcr(fileName)
  }
}
