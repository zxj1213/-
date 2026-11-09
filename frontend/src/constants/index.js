/**
 * 学迹 StudyFlow - 应用常量
 * 配色沿用学途(Study_Path)学术蓝设计体系
 */

export const AppConstants = {
  APP_NAME: '学迹',
  APP_NAME_EN: 'StudyFlow',
  APP_VERSION: '1.0.0',
  APP_DESCRIPTION: 'AI自适应学习管家'
}

export const ColorConstants = {
  PRIMARY: '#1E88E5',
  PRIMARY_LIGHT: '#64B5F6',
  PRIMARY_DARK: '#1565C0',
  SECONDARY: '#26A69A',
  SECONDARY_LIGHT: '#80CBC4',
  SUCCESS: '#4CAF50',
  WARNING: '#FF9800',
  ERROR: '#F44336',
  INFO: '#2196F3'
}

export const StorageConstants = {
  KEY_APP_STATE: 'studyflow_app_state_v1', // 旧版单用户状态(迁移用)
  KEY_USERS: 'studyflow_users',            // 本地账号表(演示)
  KEY_CURRENT_USER: 'studyflow_current_user',
  stateKeyOf: (userId) => `studyflow_state_${userId}`
}

/** 分钟格式化：90 -> 1小时30分钟 */
export function formatMinutes(min) {
  if (!min && min !== 0) return '—'
  min = Math.round(min)
  if (min >= 60) {
    const h = Math.floor(min / 60)
    const m = min % 60
    return m ? `${h}小时${m}分钟` : `${h}小时`
  }
  return `${min}分钟`
}

export const TabMeta = {
  '/': { title: '首页', label: '首页', icon: 'HomeFilled' },
  '/tasks': { title: 'AI任务', label: '任务', icon: 'List' },
  '/plan': { title: '学业规划', label: '学业', icon: 'Reading' },
  '/exam': { title: '考试Agent', label: '备考', icon: 'EditPen' },
  '/review': { title: '每日复盘', label: '复盘', icon: 'DataAnalysis' },
  '/me': { title: '个人中心', label: '我的', icon: 'User' }
}

export const TABS = [
  { path: '/', label: '首页', icon: 'HomeFilled' },
  { path: '/tasks', label: '任务', icon: 'List' },
  { path: '/plan', label: '学业', icon: 'Reading' },
  { path: '/exam', label: '备考', icon: 'EditPen' },
  { path: '/review', label: '复盘', icon: 'DataAnalysis' },
  { path: '/me', label: '我的', icon: 'User' }
]

export const PersonalSections = [
  { id: 'profile', label: '个人资料', icon: 'User' },
  { id: 'widgets', label: '桌面服务卡片', icon: 'Monitor' },
  { id: 'devices', label: '设备展示（演示）', icon: 'Iphone' },
  { id: 'account', label: '账号与数据', icon: 'Key' },
  { id: 'settings', label: '设置', icon: 'Setting' },
  { id: 'library', label: '本地资料库（演示）', icon: 'FolderOpened' },
  { id: 'about', label: '关于', icon: 'InfoFilled' }
]

// 日期工具
export function pad(n) {
  return String(n).padStart(2, '0')
}

export function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function nowStr() {
  const d = new Date()
  return `${todayStr()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function daysBetween(fromStr, toStr) {
  const a = new Date(fromStr + 'T00:00:00')
  const b = new Date(toStr + 'T00:00:00')
  return Math.round((b - a) / 86400000)
}

export function formatDateCN(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return `${d.getMonth() + 1}月${d.getDate()}日 ${weekdays[d.getDay()]}`
}

export function relativeTime(dateStr) {
  const d = daysBetween(todayStr(), dateStr.split(' ')[0])
  if (d === 0) return '今天'
  if (d === 1) return '明天'
  if (d === -1) return '昨天'
  if (d > 1) return `${d}天后`
  return `${-d}天前`
}

export function countdown(dateStr) {
  const d = daysBetween(todayStr(), dateStr.split(' ')[0])
  return d >= 0 ? `还有${d}天` : '已结束'
}

export function generateId() {
  return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8)
}

/** 本地截止时间：日期格式按当天结束处理，日期时间保留用户选择的时分。 */
export function taskDeadlineTime(deadline) {
  if (typeof deadline !== 'string' || !deadline.trim()) return NaN
  const value = deadline.trim()
  return new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T23:59:59` : value.replace(' ', 'T')).getTime()
}

/** 按剩余实际时长划分优先级；逾期任务仍为紧急。 */
export function getTaskPriority(deadline, now = Date.now()) {
  const remaining = taskDeadlineTime(deadline) - now
  if (!Number.isFinite(remaining)) return '低'
  if (remaining <= 86400000) return '紧急'
  if (remaining <= 3 * 86400000) return '高'
  if (remaining <= 7 * 86400000) return '中'
  return '低'
}
