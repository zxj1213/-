/**
 * 学迹 StudyFlow - 全局状态中心 (Pinia) v2
 * - 数据按用户隔离持久化到 localStorage(模拟跨端数据层)
 * - 专注会话使用真实时间戳，刷新后可从上次状态恢复
 * - 计划调整保留历史快照，支持确认/恢复
 */
import { ElMessage } from 'element-plus'
import { defineStore } from 'pinia'
import { StorageConstants, todayStr, nowStr, addDays, generateId, getTaskPriority } from '../constants'
import * as mock from '../mock/data'
import {
  recordPractice, recordPracticeBatch, generateRecommendations, replanByResults
} from '../services/adaptive'

const MIN_PASSWORD_LENGTH = 4

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj))
}

/** 轻量哈希(仅演示用，真实项目必须在服务端做密码哈希) */
function demoHash(str) {
  let h = 5381
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0
  return 'h' + Math.abs(h).toString(36)
}

/** 旧版本地状态归一化：补齐新字段、合并新增知识点 */
function normalizeState(data) {
  const d = data || {}
  const defaults = {
    initialized: false,
    authState: null,
    userInfo: null,
    settings: null,
    widgetConfig: null,
    tasks: [],
    taskPriorityNow: Date.now(),
    chatMessages: [],
    todayAgenda: null,
    courses: [],
    trainingPlan: null,
    portrait: null,
    competitions: [],
    knowledgeDocs: [],
    aiMemories: [],
    exams: [],
    studyPlans: {},
    scoreEstimates: {},
    studyProgress: {},
    planHistory: {},
    reviews: [],
    kpMastery: {},
    sessionLogs: [],
    activeSession: null
  }
  const state = { ...defaults, ...d }
  if (state.authState) state.authState.privateLibraryEncrypted = false
  if (state.settings) state.settings.autoSync = false

  // 任务补齐 actualMinutes
  state.tasks = (state.tasks || []).map(t => ({ actualMinutes: 0, ...t, priority: getTaskPriority(t.deadline) }))

  // 考试补齐每日预算
  state.exams = (state.exams || []).map(e => ({ dailyMinutes: 90, ...e }))

  // 合并新增知识点(如线索二叉树/哈夫曼树)，旧数据也能获得
  const mockKps = mock.getMockKnowledgePoints()
  for (const [courseId, kps] of Object.entries(mockKps)) {
    if (!state.kpMastery[courseId]) state.kpMastery[courseId] = {}
    for (const [name, kp] of Object.entries(kps)) {
      if (!state.kpMastery[courseId][name]) {
        state.kpMastery[courseId][name] = kp
      }
    }
  }

  // 旧版知识点补 assessed 标记
  for (const courseId of Object.keys(state.kpMastery)) {
    for (const [name, kp] of Object.entries(state.kpMastery[courseId])) {
      if (kp && kp.assessed === undefined) kp.assessed = true
    }
  }

  return state
}

export const useAppStore = defineStore('app', {
  state: () => normalizeState(null),

  getters: {
    pendingTasks: (s) => s.tasks.filter(t => t.status !== '已完成'),
    todayTasks: (s) => s.tasks.filter(t => t.status !== '已完成'),
    currentUserId: (s) => s.authState?.currentUserId || null,
    currentUserName: (s) => s.authState?.currentUserName || '',
    avgKpMastery: (s) => (courseId) => {
      const kps = Object.values(s.kpMastery[courseId] || {}).filter(k => k.mastery != null)
      if (!kps.length) return 0
      return Math.round(kps.reduce((a, b) => a + b.mastery, 0) / kps.length)
    },
    recommendations: (s) => generateRecommendations({
      kpMastery: s.kpMastery,
      courses: s.courses,
      exams: s.exams,
      tasks: s.tasks
    })
  },

  actions: {
    // ==================== 账号体系 ====================
    _readUsers() {
      try {
        return JSON.parse(localStorage.getItem(StorageConstants.KEY_USERS) || '[]')
      } catch (e) {
        return []
      }
    },

    _writeUsers(users) {
      localStorage.setItem(StorageConstants.KEY_USERS, JSON.stringify(users))
    },

    /** 初始化：恢复当前账号状态 */
    init() {
      if (this.initialized) return
      this.initialized = true
      const currentId = localStorage.getItem(StorageConstants.KEY_CURRENT_USER)
      if (currentId) {
        const user = this._readUsers().find(u => u.id === currentId)
        if (user) {
          this._loadUserState(user)
          this.applyTheme()
          return
        }
      }
      // 未登录：应用主题仍生效
      this.applyTheme()
    },

    _loadUserState(user) {
      const key = StorageConstants.stateKeyOf(user.id)
      let saved = null
      try {
        saved = JSON.parse(localStorage.getItem(key) || 'null')
      } catch (e) { /* 数据损坏重新加载 */ }

      if (saved) {
        Object.assign(this.$state, normalizeState(saved))
      } else {
        // 新账号：加载演示数据；旧版单用户数据自动迁移给第一个账号
        const legacy = localStorage.getItem(StorageConstants.KEY_APP_STATE)
        if (legacy) {
          try {
            Object.assign(this.$state, normalizeState(JSON.parse(legacy)))
            localStorage.removeItem(StorageConstants.KEY_APP_STATE)
          } catch (e) {
            this.loadMockData()
          }
        } else {
          this.loadMockData()
        }
      }
      if (!this.authState) this.authState = { isAuthenticated: true }
      this.authState.currentUserId = user.id
      this.authState.currentUserName = user.name
      this.authState.serverAccountId = user.serverId || null
      const cachedName = user.serverId && this.userInfo?.profileVersion > 0 ? this.userInfo.name : user.name
      this.userInfo = { ...(this.userInfo || {}), id: user.id, name: cachedName }
      this.save()
    },

    /** 登录/注册(本地演示账号)：同名+密码匹配=登录；新名字=自动注册 */
    login(name, password) {
      name = (name || '').trim()
      if (!name || !password) return { ok: false, msg: '请输入用户名和密码' }
      if (password.length < MIN_PASSWORD_LENGTH) return { ok: false, msg: `密码至少 ${MIN_PASSWORD_LENGTH} 位` }

      const users = this._readUsers()
      let user = users.find(u => u.name === name)
      const registered = !user
      if (user) {
        if (user.hash !== demoHash(password)) return { ok: false, msg: '密码错误' }
      } else {
        user = { id: generateId(), name, hash: demoHash(password), createdAt: nowStr() }
        users.push(user)
        this._writeUsers(users)
      }

      localStorage.setItem(StorageConstants.KEY_CURRENT_USER, user.id)
      this._loadUserState(user)
      this.applyTheme()
      return { ok: true, msg: '欢迎回来，' + user.name, registered }
    },

    connectServerAccount(name, serverId, { reuseLocal = true, localId } = {}) {
      const users = this._readUsers()
      let user = users.find(item => item.serverId === serverId)
      if (!user && (reuseLocal || localId)) user = users.find(item => localId ? item.id === localId : item.name === name)
      if (user?.serverId && user.serverId !== serverId) throw new Error('本地记录已绑定其他服务账号')
      if (!user) {
        user = { id: generateId(), name, createdAt: nowStr() }
        users.push(user)
      }
      user.serverId = serverId
      delete user.hash
      this._writeUsers(users)
      localStorage.setItem(StorageConstants.KEY_CURRENT_USER, user.id)
      this._loadUserState(user)
      this.applyTheme()
    },

    applyAccountProfile(profile) {
      if (!profile || profile.account_id !== this.authState?.serverAccountId ||
          profile.version < (this.userInfo?.profileVersion || 0)) return
      const cached = this.userInfo || {}
      const fields = profile.version > 0 ? {
        name: profile.display_name, school: profile.school, major: profile.major, grade: profile.grade,
        avatar: profile.avatar
      } : { name: profile.display_name }
      this.userInfo = { ...cached, ...fields, accountIdentifier: profile.identifier || cached.accountIdentifier || '',
        bindingKind: profile.binding_kind || cached.bindingKind || '', profileVersion: profile.version }
      this.save()
    },

    matchesLegacyPassword(user, password) {
      return !!user?.hash && user.hash === demoHash(password)
    },

    changePassword(currentPassword, newPassword) {
      const users = this._readUsers()
      const user = users.find(u => u.id === this.currentUserId)
      if (!user) return { ok: false, msg: '请先登录再修改密码' }
      if (typeof currentPassword !== 'string' || !currentPassword || user.hash !== demoHash(currentPassword)) {
        return { ok: false, msg: '当前密码不正确' }
      }
      if (typeof newPassword !== 'string' || newPassword.length < MIN_PASSWORD_LENGTH) {
        return { ok: false, msg: `新密码至少 ${MIN_PASSWORD_LENGTH} 位` }
      }
      const newHash = demoHash(newPassword)
      if (newHash === user.hash) return { ok: false, msg: '请设置与当前密码不同的新密码' }

      user.hash = newHash
      try {
        this._writeUsers(users)
      } catch {
        return { ok: false, msg: '密码保存失败，请检查浏览器存储设置后重试' }
      }
      return { ok: true }
    },

    /** 退出登录：持久化当前状态并回到登录页 */
    logout() {
      this.save()
      if (localStorage.getItem(StorageConstants.KEY_CURRENT_USER) === this.currentUserId) {
        localStorage.removeItem(StorageConstants.KEY_CURRENT_USER)
      }
      Object.assign(this.$state, normalizeState(null))
      this.initialized = true
      this.applyTheme()
    },

    /** 导出当前账号数据(JSON 下载) */
    exportData() {
      const blob = new Blob([JSON.stringify(this.$state, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `studyflow_backup_${todayStr()}.json`
      a.click()
      URL.revokeObjectURL(url)
    },

    /** 删除当前账号全部数据 */
    deleteData() {
      const id = this.currentUserId
      if (id) {
        localStorage.removeItem(StorageConstants.stateKeyOf(id))
        const users = this._readUsers().filter(u => u.id !== id)
        this._writeUsers(users)
        if (localStorage.getItem(StorageConstants.KEY_CURRENT_USER) === id) {
          localStorage.removeItem(StorageConstants.KEY_CURRENT_USER)
        }
      }
      Object.assign(this.$state, normalizeState(null))
    },

    // ==================== 数据加载/持久化 ====================
    loadMockData() {
      this.userInfo = {
        id: '', name: '', avatar: '', school: '', major: '', studentId: '',
        email: '', phone: '', grade: '', enrollmentYear: null, expectedGraduationYear: null
      }
      this.settings = mock.getMockAppSettings()
      this.authState = { isAuthenticated: true, privateLibraryEncrypted: false }
      this.widgetConfig = mock.getMockWidgetConfig()
      this.tasks = mock.getMockTasks()
      this.refreshTaskPriorities()
      this.chatMessages = mock.getMockChatMessages()
      this.todayAgenda = mock.getMockTodayAgenda()
      this.courses = mock.getMockCourses()
      this.trainingPlan = mock.getMockTrainingPlan()
      this.portrait = mock.getMockAcademicPortrait()
      this.competitions = mock.getMockCompetitions()
      this.knowledgeDocs = mock.getMockKnowledgeDocs()
      this.aiMemories = mock.getMockAIMemories()
      this.exams = mock.getMockExams()
      this.kpMastery = mock.getMockKnowledgePoints()
      this.sessionLogs = mock.getMockSessionLogs()
      this.studyPlans = {}
      this.scoreEstimates = {}
      this.studyProgress = {}
      this.planHistory = {}
      this.activeSession = null
      for (const exam of this.exams) {
        this.studyPlans[exam.id] = mock.getMockStudyPlan(exam.id)
        this.scoreEstimates[exam.id] = mock.getMockScoreEstimate(exam.id)
        this.studyProgress[exam.id] = mock.getMockStudyProgress(exam.id)
      }
      this.reviews = this.buildWeekReviews()
      this.save()
    },

    /** 重置演示数据(保留当前账号) */
    resetData() {
      const uid = this.currentUserId
      const uname = this.currentUserName
      const serverAccountId = this.authState?.serverAccountId
      const profile = this.userInfo ? { ...this.userInfo } : null
      localStorage.removeItem(uid ? StorageConstants.stateKeyOf(uid) : StorageConstants.KEY_APP_STATE)
      this.loadMockData()
      if (uid) {
        this.authState.currentUserId = uid
        this.authState.currentUserName = uname
        this.authState.serverAccountId = serverAccountId || null
        this.userInfo = { ...profile, id: uid, name: profile?.name || uname }
      }
      this.save()
    },

    save() {
      const id = this.currentUserId
      if (!id) return
      try {
        localStorage.setItem(StorageConstants.stateKeyOf(id), JSON.stringify(this.$state))
      } catch (e) { ElMessage.error('保存失败：浏览器存储不足或不可用，请立即导出备份。'); return false }
    },

    applyTheme() {
      const theme = this.settings?.theme || 'light'
      const dark = theme === 'dark' ||
        (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)
      document.documentElement.classList.toggle('dark', dark)
      document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
      const sizeMap = { small: '0.92', medium: '1', large: '1.1' }
      // 固定布局基准，仅缩放文字；字号不再改变 rem 布局和控件尺寸。
      document.documentElement.style.fontSize = '16px'
      document.documentElement.style.setProperty('--font-scale', sizeMap[this.settings?.fontSize] || '1')
    },

    // ==================== 用户与设置 ====================
    updateProfile(data) {
      if (!this.currentUserId) return false
      const profile = { ...(this.userInfo || {}) }
      for (const key of ['school', 'major', 'email']) {
        if (typeof data[key] === 'string') profile[key] = data[key].trim()
      }
      if (['', '大一', '大二', '大三', '大四'].includes(data.grade)) profile.grade = data.grade
      profile.id = this.currentUserId
      profile.name = this.currentUserName
      this.userInfo = profile
      return this.save() !== false
    },

    updateSettings(patch) {
      Object.assign(this.settings, patch)
      this.applyTheme()
      this.save()
    },

    verifyLocalPassword(password) {
      return this._readUsers().find(u => u.id === this.currentUserId)?.hash === demoHash(password)
    },

    unlockPrivateLibrary() {
      this.authState.isAuthenticated = true
      this.authState.lastAuthTime = nowStr()
      this.save()
    },

    // ==================== 任务(单一状态源) ====================
    refreshTaskPriorities(now = Date.now()) {
      this.taskPriorityNow = now
      for (const task of this.tasks) task.priority = getTaskPriority(task.deadline, now)
    },

    addTask(task) {
      const t = {
        id: generateId(), createdAt: nowStr(), updatedAt: nowStr(),
        actualMinutes: 0, ...task, priority: getTaskPriority(task.deadline)
      }
      this.tasks.unshift(t)
      this.save()
      return t
    },

    /** 统一的任务完成状态切换：勾选框与"完成"按钮共用 */
    toggleTask(taskId) {
      const task = this.tasks.find(t => t.id === taskId)
      if (!task) return
      if (task.status === '已完成') {
        task.status = '待完成'
        task.completedAt = null
        task.subTasks?.forEach(s => (s.completed = false))
      } else {
        task.status = '已完成'
        task.completedAt = nowStr()
        task.subTasks?.forEach(s => (s.completed = true))
      }
      task.updatedAt = nowStr()
      this.save()
    },

    toggleSubTask(taskId, subId) {
      const task = this.tasks.find(t => t.id === taskId)
      if (!task) return
      const sub = task.subTasks?.find(s => s.id === subId)
      if (sub) {
        sub.completed = !sub.completed
        const done = task.subTasks.filter(s => s.completed).length
        task.status = done === 0 ? '待完成' : done === task.subTasks.length ? '已完成' : '进行中'
        task.completedAt = task.status === '已完成' ? nowStr() : null
        task.updatedAt = nowStr()
        this.save()
      }
    },

    completeTask(taskId) {
      const task = this.tasks.find(t => t.id === taskId)
      if (task) {
        task.status = '已完成'
        task.completedAt = nowStr()
        task.subTasks?.forEach(s => (s.completed = true))
        task.updatedAt = nowStr()
        this.save()
      }
    },

    // ==================== AI 对话 ====================
    pushChatMessage(msg) {
      this.chatMessages.push(msg)
      this.save()
    },

    // ==================== 知识点与自适应引擎 ====================
    recordPractice(courseId, kp, correct, total, minutes) {
      const courseKps = this.kpMastery[courseId] || {}
      const state = courseKps[kp]
      if (!state) return null
      courseKps[kp] = recordPractice(state, correct, total, minutes)
      this.kpMastery[courseId] = courseKps
      this.save()
      return courseKps[kp].mastery
    },

    recordPracticeBatch(courseId, results) {
      this.kpMastery[courseId] = recordPracticeBatch(this.kpMastery[courseId] || {}, results)
      this.save()
    },

    /** 资料解析管线(B2)：确认后的知识点写入课程，标记待评估 */
    addKnowledgePoints(courseId, kpList) {
      const courseKps = this.kpMastery[courseId] || {}
      for (const kp of kpList) {
        if (!courseKps[kp.name]) {
          courseKps[kp.name] = {
            mastery: null,
            assessed: false,
            source: kp.source || '课程资料解析',
            records: []
          }
        }
      }
      this.kpMastery[courseId] = courseKps
      this.save()
    },

    /** 测验提交(B4)：按题目关联知识点记录，返回各知识点统计 */
    submitQuiz(courseId, answers) {
      // answers: [{ kp, correct }]  每题一次作答
      const stats = {}
      for (const a of answers) {
        if (!stats[a.kp]) stats[a.kp] = { correct: 0, total: 0 }
        stats[a.kp].total += 1
        if (a.correct) stats[a.kp].correct += 1
      }
      const results = Object.entries(stats).map(([kp, s]) => ({
        kp, correct: s.correct, total: s.total, minutes: 10
      }))
      this.recordPracticeBatch(courseId, results)

      const after = {}
      for (const [kp, s] of Object.entries(stats)) {
        const rate = Math.round((s.correct / s.total) * 100)
        after[kp] = {
          correct: s.correct,
          total: s.total,
          rate,
          mastery: this.kpMastery[courseId]?.[kp]?.mastery ?? null
        }
      }
      return after
    },

    // ==================== 专注会话(真实时间戳) ====================
    startSession({ taskId, taskTitle, courseId, courseName, kp, targetMinutes }) {
      this.activeSession = {
        sessionId: generateId(),
        taskId,
        taskTitle,
        courseId,
        courseName,
        kp: kp || '',
        targetMinutes,
        accumulatedSeconds: 0,
        lastTick: Date.now(),
        startedAt: nowStr(),
        status: 'running'
      }
      this.save()
      return this.activeSession
    },

    /** 组件每秒把最新累计秒数回写(挂起/结束/切换时也会调用) */
    updateSessionSeconds(accumulatedSeconds) {
      if (!this.activeSession) return
      this.activeSession.accumulatedSeconds = accumulatedSeconds
      this.activeSession.lastTick = Date.now()
    },

    pauseSession(accumulatedSeconds) {
      if (!this.activeSession) return
      this.activeSession.accumulatedSeconds = accumulatedSeconds
      this.activeSession.status = 'paused'
      this.save()
    },

    resumeSession() {
      if (!this.activeSession) return
      this.activeSession.status = 'running'
      this.activeSession.lastTick = Date.now()
      this.save()
    },

    /** 结束会话：写入归属任务的真实用时与练习结果 */
    endSession({ completed, correctRate }) {
      const s = this.activeSession
      if (!s) return null
      const minutes = Math.max(1, Math.round(s.accumulatedSeconds / 60))
      const total = 20
      const hasResult = typeof correctRate === 'number' && Number.isFinite(correctRate) && correctRate >= 0 && correctRate <= 100
      const correct = hasResult ? Math.round((correctRate / 100) * total) : null
      if (hasResult && s.courseId && s.kp) this.recordPractice(s.courseId, s.kp, correct, total, minutes)

      this.addSessionLog({
        date: todayStr(),
        taskId: s.taskId,
        courseName: s.courseName,
        courseId: s.courseId,
        minutes,
        taskTitle: s.taskTitle,
        taskCompleted: completed,
        correctRate,
        correct,
        total: hasResult ? total : null,
        kp: s.kp
      })

      // 任务归属的专注时长累计(不重复记账：会话结束时只写一次)
      const task = this.tasks.find(t => t.id === s.taskId)
      if (task) {
        task.actualMinutes = (task.actualMinutes || 0) + minutes
        if (completed) {
          task.status = '已完成'
        task.completedAt = nowStr()
          task.subTasks?.forEach(st => (st.completed = true))
        }
        task.updatedAt = nowStr()
      }

      this.activeSession = null
      this.save()
      return minutes
    },

    addSessionLog(log) {
      this.sessionLogs.unshift({ id: generateId(), ...log })
      this.save()
    },

    // ==================== 考试 Agent ====================
    updateExam(examId, patch) {
      const exam = this.exams.find(e => e.id === examId)
      if (!exam) return
      Object.assign(exam, patch)
      // 考试日期变化后刷新进度
      if (patch.date) {
        const prog = this.studyProgress[examId]
        if (prog) {
          prog.daysLeft = Math.max(Math.ceil((new Date(patch.date.slice(0, 10) + 'T00:00:00') - new Date(todayStr() + 'T00:00:00')) / 86400000), 0)
        }
      }
      this.save()
    },

    /** 快照当前计划(调整前)供对比/回退 */
    snapshotPlans(examId) {
      this.planHistory[examId] = {
        prev: deepClone(this.studyPlans[examId] || []),
        next: null,
        explanation: '',
        at: nowStr(),
        confirmed: false
      }
    },

    /** 确认 AI 调整(B1 用户控制) */
    confirmPlanAdjust(examId) {
      const h = this.planHistory[examId]
      if (h) {
        h.confirmed = true
        this.save()
      }
    },

    /** 恢复原计划(B1 拒绝/回退) */
    rollbackPlan(examId) {
      const h = this.planHistory[examId]
      if (h && h.prev) {
        this.studyPlans[examId] = h.prev
        this.planHistory[examId] = null
        this.save()
      }
    },

    /** 每日完成情况打卡 → 自适应引擎重排计划(核心创新) */
    checkInExamDay(examId, payload) {
      const exam = this.exams.find(e => e.id === examId)
      if (!exam) return null
      const { completed, results, actualHours } = payload

      if (results && results.length && exam.courseId) {
        this.recordPracticeBatch(exam.courseId, results)
      }

      const plans = this.studyPlans[examId] || []
      const today = plans.find(p => p.date === todayStr())
      if (today && !today.locked) {
        today.completed = completed
        today.completedHours = actualHours ?? 0
        today.selfEvaluation = completed ? 80 : 50
      }

      const result = this._replan(exam, payload)
      this.save()
      return result
    },

    /** 手动重新规划(不记录练习结果) */
    replanExam(examId) {
      const exam = this.exams.find(e => e.id === examId)
      if (!exam) return null
      const result = this._replan(exam, null)
      this.save()
      return result
    },

    /** 内部：自适应引擎重排 + 快照历史 + 更新预估/进度 */
    _replan(exam, payload) {
      const course = this.courses.find(c => c.id === exam.courseId)
      const daysLeft = Math.max(
        Math.ceil((new Date(exam.date.slice(0, 10) + 'T00:00:00') - new Date(todayStr() + 'T00:00:00')) / 86400000), 0)

      // 调整前快照(仅保留最近一次，用于对比展示与回退)
      this.snapshotPlans(exam.id)

      const result = replanByResults({
        exam,
        course,
        kpMastery: this.kpMastery,
        daysLeft,
        targetScore: exam.targetScore,
        prevPlans: this.studyPlans[exam.id] || []
      })
      this.studyPlans[exam.id] = result.plans

      const h = this.planHistory[exam.id]
      if (h) {
        h.next = deepClone(result.plans)
        h.explanation = result.explanation
      }

      const est = this.scoreEstimates[exam.id]
      if (est) {
        est.estimatedDate = todayStr()
        est.currentMinScore = Math.max(0, result.estimated - 6)
        est.currentMaxScore = Math.min(100, result.estimated + 8)
        est.weakAreas = result.plans[0]?.chapters
          .filter(c => c.targeted)
          .map(c => c.name.replace('针对性练习：', '')) || est.weakAreas
        est.trendDescription = result.explanation.replace(/\n/g, '，')
      }
      const prog = this.studyProgress[exam.id]
      if (prog) {
        const plans = this.studyPlans[exam.id] || []
        const doneCount = plans.filter(p => p.completed).length
        prog.daysLeft = daysLeft
        prog.daysCompleted = doneCount
        prog.overallCompletion = plans.length ? Math.round((doneCount / plans.length) * 100) : 0
        prog.averageCorrectRate = result.avg
      }
      return result
    },

    togglePlanLock(examId, planId) {
      const plan = (this.studyPlans[examId] || []).find(p => p.id === planId)
      if (plan) {
        plan.locked = !plan.locked
        this.save()
      }
    },

    // ==================== 每日复盘 ====================
    buildWeekReviews() {
      const reviews = []
      for (let i = 6; i >= 0; i--) {
        const date = addDays(todayStr(), -i)
        if (i === 0) {
          reviews.push(mock.getMockDailyReview(date))
        } else {
          const r = mock.getMockDailyReview(date)
          r.userConfirmed = true
          r.portraitUpdated = true
          r.memoryUpdated = true
          reviews.push(r)
        }
      }
      return reviews
    },

    generateTodayReview() {
      const date = todayStr()
      const dailyTasks = this.tasks.filter(t => t.deadline?.slice(0, 10) === date || t.completedAt?.slice(0, 10) === date)
      const totalTasks = dailyTasks.length
      const doneTasks = dailyTasks.filter(t => t.status === '已完成' && t.completedAt?.slice(0, 10) === date).length
      const studyMinutes = this.sessionLogs
        .filter(l => l.date === date)
        .reduce((a, b) => a + b.minutes, 0)
      const studyHours = Math.round((studyMinutes / 60) * 10) / 10
      const plannedHours = dailyTasks.reduce((sum, t) => sum + (t.estimatedDuration || 0), 0) / 60
      const efficiencyScore = Math.min(
        100, Math.round((studyHours / Math.max(plannedHours, 0.1)) * 70 +
          (totalTasks ? (doneTasks / totalTasks) * 30 : 30)))

      const weakKps = []
      for (const course of this.courses) {
        const kps = Object.entries(this.kpMastery[course.id] || {})
          .filter(([, s]) => s.mastery != null && s.mastery < 60)
        if (kps.length) weakKps.push(`${course.name}:${kps.map(([n]) => n).join('/')}`)
      }

      const suggestions = []
      if (weakKps.length) {
        suggestions.push(`检测到薄弱知识点 ${weakKps.join('、')}，建议明日安排针对性练习，适当减少新知识学习`)
      }
      if (studyHours < plannedHours) {
        suggestions.push(`今日学习 ${studyHours}h，低于计划 ${plannedHours}h，建议明天优先补上进度`)
      } else {
        suggestions.push(`今日学习时长达标(${studyHours}h)，保持这个节奏`)
      }
      suggestions.push('编程作业建议预留20%缓冲时间应对调试')

      const review = {
        id: generateId(),
        date,
        completedCourses: this.todayAgenda ? this.todayAgenda.courses.length : 2,
        totalCourses: this.todayAgenda ? this.todayAgenda.courses.length : 2,
        completedTasks: doneTasks,
        totalTasks,
        studyHours,
        exerciseMinutes: 30,
        plannedStudyHours: plannedHours,
        plannedExerciseMinutes: 30,
        deviationExplanation: studyHours < plannedHours
          ? `今日实际学习 ${studyHours}h，低于计划 ${plannedHours}h。具体原因需结合学习记录确认。`
          : `今日完成学习 ${studyHours}h，与计划基本一致。任务完成情况良好，学习节奏稳定。`,
        efficiencyScore,
        suggestions,
        dataSources: [
          `任务 ${doneTasks}/${totalTasks} 项完成`,
          `专注 ${studyMinutes} 分钟(${this.sessionLogs.filter(l => l.date === date).length} 次会话)`,
          weakKps.length ? `薄弱知识点 ${weakKps.length} 处` : '无薄弱知识点'
        ],
        portraitUpdated: false,
        memoryUpdated: false,
        userConfirmed: false
      }
      const idx = this.reviews.findIndex(r => r.date === date)
      if (idx >= 0) this.reviews[idx] = review
      else this.reviews.push(review)
      this.save()
      return review
    },

    confirmReview(date) {
      const review = this.reviews.find(r => r.date === date)
      if (!review) return
      review.userConfirmed = true
      review.portraitUpdated = true
      review.memoryUpdated = true
      if (this.portrait) this.portrait.updatedAt = todayStr()
      this.save()
    },

    addReviewNote(date, note) {
      const review = this.reviews.find(r => r.date === date)
      if (!review) return
      review.deviationExplanation += '\n\n📝 补充：' + note
      this.save()
    },

    // ==================== 知识库 ====================
    addKnowledgeDoc(doc) {
      this.knowledgeDocs.unshift({ id: generateId(), uploadDate: todayStr(), tags: [], ...doc })
      this.save()
    },

    addExamMaterial(examId, material) {
      const exam = this.exams.find(e => e.id === examId)
      if (exam) {
        exam.materials.push({ id: generateId(), ...material })
        this.save()
      }
    }
  }
})
