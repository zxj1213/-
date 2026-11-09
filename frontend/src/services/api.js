/**
 * 学迹 StudyFlow - API 客户端
 * 图2技术路线：前端 Vue3 + Element Plus / 后端 Python FastAPI / 大模型API + 提示词及Skills
 *
 * 当 FastAPI 后端在 http://127.0.0.1:8000 运行时(需本机安装 Python)，
 * AI 对话会优先调用真实大模型接口；后端不可用时自动降级为前端规则引擎，
 * 保证演示环境离线可用。
 */
import axios from 'axios'
import { generateRuleReply } from './ai'

const http = axios.create({
  baseURL: '/api',
  timeout: 35000
})

const authHttp = axios.create({ baseURL: '/api/auth', timeout: 10000 })
let accountId = null
let accessToken = ''
let accessExpiresAt = 0
let refreshInFlight
let onExpired

function withCookieLock(callback) {
  return globalThis.navigator?.locks?.request('studyflow-session-cookie', callback) ?? callback()
}

export function setSessionAccount(id) {
  if (accountId === id) return
  accountId = id
  accessToken = ''
  accessExpiresAt = 0
}

export function setSessionExpiredHandler(handler) {
  onExpired = handler
}

function acceptSession(data) {
  if (!/^[a-f0-9]{32}$/.test(data?.account_id || '') || typeof data.access_token !== 'string' ||
      !data.access_token || !Number.isFinite(data.expires_in) || data.expires_in <= 0) {
    throw new Error('Invalid session response')
  }
  setSessionAccount(data.account_id)
  accessToken = data.access_token
  accessExpiresAt = Date.now() + data.expires_in * 1000
  return data.account_id
}

export function signIn(username, password) {
  return withCookieLock(async () => {
    const { data } = await authHttp.post('/login', { username, password })
    return acceptSession(data)
  })
}

export function registerAccount(username, password, displayName, initialProfile = {}) {
  return withCookieLock(async () => {
    const { data } = await authHttp.post('/register', { ...initialProfile, username, password, display_name: displayName })
    return acceptSession(data)
  })
}

export async function getAccountProfile(version, bound) {
  const response = await http.get('/account/profile', {
    params: { version, bound }, validateStatus: status => status === 200 || status === 304
  })
  return response.status === 200 ? response.data : null
}

export async function updateAccountProfile(profile) {
  return (await http.put('/account/profile', profile)).data
}

export async function uploadAccountAvatar(file, version) {
  const form = new FormData()
  form.append('file', file)
  form.append('version', version)
  return (await http.post('/account/avatar', form)).data
}

export async function bindAccountContact(identifier, password, profile) {
  return (await http.post('/account/bind', { identifier, password, profile })).data
}

export function refreshSession() {
  const owner = accountId
  if (!owner) return Promise.resolve('')
  if (refreshInFlight?.owner === owner) return refreshInFlight.promise
  const operation = { owner }
  operation.promise = withCookieLock(async () => {
    if (owner !== accountId) return ''
    try {
      const { data } = await authHttp.post('/refresh', null, { headers: { 'X-StudyFlow-Account': owner } })
      if (owner !== accountId || data.account_id !== owner) return ''
      acceptSession(data)
      return accessToken
    } catch (error) {
      if (error.response?.status === 401 && accountId === owner) {
        setSessionAccount(null)
        onExpired?.(owner)
      }
      throw error
    }
  }).finally(() => {
    if (refreshInFlight === operation) refreshInFlight = undefined
  })
  refreshInFlight = operation
  return operation.promise
}

export function signOut(id = accountId) {
  if (!id) return Promise.resolve()
  return withCookieLock(async () => {
    const headers = { 'X-StudyFlow-Account': id }
    if (id === accountId && accessToken) headers.Authorization = 'Bearer ' + accessToken
    await authHttp.post('/logout', null, { headers })
    if (accountId === id) setSessionAccount(null)
  })
}

export function verifyServerPassword(password) {
  return http.post('/auth/verify-password', { password })
}

export async function changeServerPassword(password, newPassword) {
  // Refresh before taking the cookie lock so the request interceptor cannot deadlock.
  if (!accessToken || accessExpiresAt <= Date.now() + 5000) await refreshSession()
  return withCookieLock(async () => {
    const owner = accountId
    const { data } = await http.post('/auth/password', { password, new_password: newPassword }, { skipSessionRefresh: true })
    if (accountId === owner) acceptSession(data)
  })
}

http.interceptors.request.use(async config => {
  const owner = config.sessionRetried ? config.sessionOwner : accountId
  if (!config.skipSessionRefresh && owner && owner === accountId && accessExpiresAt <= Date.now() + 5000) await refreshSession()
  if (owner !== accountId) throw new axios.CanceledError('Account changed')
  if (accessToken) config.headers.Authorization = 'Bearer ' + accessToken
  else delete config.headers.Authorization
  config.sessionOwner = owner
  return config
})

http.interceptors.response.use(undefined, async error => {
  const { config, response } = error
  if (!config || response?.status !== 401 || !accountId || config.sessionOwner !== accountId
      || config.sessionRetried || config.skipSessionRefresh || config.signal?.aborted) throw error
  if (config.headers.Authorization === 'Bearer ' + accessToken) await refreshSession()
  if (!accountId || config.sessionOwner !== accountId) throw error
  return http.request({ ...config, sessionRetried: true })
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
      history: history.filter((m, i) => !(i === history.length - 1 && m.role === 'user' && m.content === message)).slice(-8).map(m => ({ role: m.role, content: m.content }))
    })
    if (res.data && res.data.reply) {
      backendAvailable = true
      return { reply: res.data.reply, engine: res.data.engine === 'llm' ? 'llm' : 'rules' }
    }
    throw new Error('empty reply')
  } catch (e) {
    backendAvailable = false
    return { reply: generateRuleReply(message, ctx), engine: 'rules' }
  }
}

const ocrErrors = {
  401: '请登录已绑定后端的学迹账号后使用 OCR。',
  413: '图片超过 5 MiB，请缩小图片后重试。',
  415: '图片格式不受支持，请选择 PNG、JPEG 或 WebP。',
  422: '图片无法读取或分辨率过高，请更换图片后重试。',
  503: 'OCR 引擎暂不可用，请检查后端模型配置或稍后重试。'
}

/** 上传截图，返回原文和待确认任务。 */
export async function ocrRecognize(file, signal) {
  const form = new FormData()
  form.append('file', file)
  let result
  try {
    const response = await http.post('/ai/ocr', form, { signal })
    result = response.data
  } catch (e) {
    if (signal?.aborted) throw e
    if (e.code === 'ECONNABORTED') throw new Error('图片识别超时，请重试。')
    throw new Error(ocrErrors[e.response?.status] || '无法连接 OCR 服务，请确认后端已启动后重试。')
  }
  if (typeof result?.recognizedText !== 'string' || !Array.isArray(result.tasks) || !result.tasks.every(task =>
    typeof task?.title === 'string' && typeof task.deadline === 'string' &&
    Array.isArray(task.contents) && task.contents.length <= 10 && task.contents.every(content => typeof content === 'string')
  )) {
    throw new Error('识别服务返回了无法读取的结果，请重试。')
  }
  return result
}

export async function extractMaterial(file, signal) {
  const form = new FormData()
  form.append('file', file)
  try {
    const { data } = await http.post('/materials/extract', form, { signal, timeout: 120000 })
    if (typeof data?.type !== 'string' || !Array.isArray(data.chunks) || !data.chunks.length || !data.chunks.every(chunk =>
      ['page', 'slide', 'paragraph'].includes(chunk?.kind) &&
      Number.isInteger(chunk.position) && chunk.position > 0 && typeof chunk.text === 'string'
    )) {
      throw new Error('资料解析结果无法读取')
    }
    return data
  } catch (error) {
    if (signal.aborted) throw error
    if (error.response?.status === 401) {
      throw new Error('请登录已绑定后端的学迹账号后上传资料。')
    }
    if (error.code === 'ECONNABORTED') throw new Error('解析超时，请拆分文件后重试。')
    const detail = error.response?.data?.detail
    throw new Error(typeof detail === 'string' ? detail : '无法完成解析，请检查后端服务后重试。')
  }
}
