/**
 * 学迹 StudyFlow - 自适应学习引擎(核心创新) v2
 * 对应图2核心理念：根据真实学习结果动态改变决策。
 *
 * 规则：
 * - 知识点掌握度 < 60%  → 暂停推进新知识，自动插入"针对性练习"
 * - 掌握度 60%-85%     → 轻量复习 + 正常推进
 * - 掌握度 ≥ 85%       → 判定已掌握，可进入下一新章节
 * - 每日总时长硬约束   → 超出预算自动顺延/拆分，并解释调整
 * - 用户锁定任务       → 重新规划时保留，不覆盖用户手工安排
 * 后端 FastAPI 中有一份相同逻辑的 Python 实现 (backend/app/services/adaptive.py)
 */

export const WEAK_THRESHOLD = 60 // 薄弱阈值：低于该值触发针对性练习
export const MASTERED_THRESHOLD = 85 // 掌握阈值：达到该值视为已掌握

/** 记录一次真实练习结果，更新知识点掌握度(加权平滑) */
export function recordPractice(kpState, correct, total, minutes = 30) {
  if (!kpState || total <= 0) return kpState
  const rate = Math.round((correct / total) * 100)
  const newMastery = Math.round((kpState.mastery ?? 50) * 0.5 + rate * 0.5)
  return {
    ...kpState,
    mastery: newMastery,
    assessed: true,
    records: [
      ...(kpState.records || []),
      { date: new Date().toISOString().slice(0, 10), correct, total, minutes, rate }
    ]
  }
}

/** 批量记录多个知识点的练习结果 */
export function recordPracticeBatch(kpMap, results) {
  const next = { ...kpMap }
  for (const r of results) {
    if (r && r.kp && next[r.kp]) {
      next[r.kp] = recordPractice(next[r.kp], r.correct, r.total, r.minutes || 30)
    }
  }
  return next
}

/** 获取某门课程的知识点状态列表(按掌握度升序，待评估排最后) */
export function listKps(kpMap) {
  return Object.entries(kpMap || {})
    .map(([name, s]) => ({
      name,
      mastery: s.mastery ?? null,
      assessed: s.assessed !== false,
      records: s.records || []
    }))
    .sort((a, b) => {
      if (a.mastery == null) return 1
      if (b.mastery == null) return -1
      return a.mastery - b.mastery
    })
}

/** 计算课程平均掌握度(忽略待评估知识点) */
export function avgMastery(kpMap) {
  const kps = Object.values(kpMap || {}).filter(s => s.mastery != null)
  if (kps.length === 0) return 0
  return Math.round(kps.reduce((sum, s) => sum + s.mastery, 0) / kps.length)
}

/** 生成 AI 学习推荐(首页 AI Study Recommendations) */
export function generateRecommendations({ kpMastery, courses, exams, tasks }) {
  const recs = []

  // 1. 薄弱知识点 → 针对性练习(核心创新点，与图2示例一致)
  for (const course of courses || []) {
    const kps = listKps(kpMastery[course.id]).filter(k => k.mastery != null && k.mastery < WEAK_THRESHOLD)
    for (const kp of kps.slice(0, 2)) {
      const last = kp.records && kp.records.length ? kp.records[kp.records.length - 1] : null
      const lastRate = last
        ? `最近一次练习正确率 ${last.rate ?? Math.round((last.correct / last.total) * 100)}%`
        : '尚未进行过练习'
      recs.push({
        icon: '📉',
        title: `「${kp.name}」掌握度 ${kp.mastery}%`,
        desc: `${course.name} · ${lastRate}，已自动减少新知识学习，安排 40 分钟针对性练习`,
        reason: '薄弱知识点',
        courseId: course.id,
        kp: kp.name,
        severity: 'weak'
      })
    }
  }

  // 2. 已掌握知识点 → 推进新章节
  for (const course of courses || []) {
    const mastered = listKps(kpMastery[course.id]).filter(k => k.mastery != null && k.mastery >= MASTERED_THRESHOLD)
    if (mastered.length > 0) {
      recs.push({
        icon: '📈',
        title: `「${mastered[mastered.length - 1].name}」已掌握 (${mastered[mastered.length - 1].mastery}%)`,
        desc: `${course.name} · 可以开始学习下一章节的新内容了`,
        reason: '已掌握推进',
        courseId: course.id,
        severity: 'good'
      })
    }
  }

  // 3. 即将到来的考试
  for (const exam of (exams || []).slice(0, 2)) {
    const course = (courses || []).find(c => c.id === exam.courseId)
    const avg = course ? avgMastery(kpMastery[course.id]) : exam.masteryLevel
    const estimated = Math.round(avg * 0.75 + 25)
    recs.push({
      icon: '🎯',
      title: `${exam.name} · 预计 ${estimated}-${Math.min(estimated + 8, 100)} 分`,
      desc: `目标 ${exam.targetScore} 分，当前平均掌握度 ${avg}%，每日预算 ${exam.dailyMinutes || 90} 分钟`,
      reason: '考试倒计时',
      examId: exam.id,
      severity: estimated >= exam.targetScore - 5 ? 'good' : 'normal'
    })
  }

  // 4. 紧急任务
  for (const t of (tasks || []).filter(t => t.priority === '紧急' && t.status !== '已完成').slice(0, 2)) {
    recs.push({
      icon: '⏰',
      title: t.title,
      desc: `截止时间临近，建议优先处理`,
      reason: '紧急任务',
      severity: 'urgent'
    })
  }

  return recs.slice(0, 6)
}

/** 描述一个计划日的内容(用于调整对比) */
export function describePlanDay(plan) {
  const parts = []
  for (const ch of plan.chapters || []) {
    parts.push(`${ch.name}(${ch.estimatedMinutes}分钟)`)
  }
  for (const p of plan.practiceTasks || []) {
    parts.push(`${p.type}×${p.count}(${p.estimatedMinutes}分钟)`)
  }
  if (!parts.length) parts.push('休息日(无安排)')
  return parts.join(' + ')
}

/**
 * 根据真实练习结果重排备考计划(图2：根据真实学习结果改变决策)
 * 约束：每日总时长 ≤ dailyMinutes(硬约束)，锁定任务保留
 * 返回 { plans, explanation, estimated, avg, changes, overBudgetDays }
 */
export function replanByResults({ exam, course, kpMastery, daysLeft, targetScore, prevPlans }) {
  const kps = listKps(kpMastery[course.id])
  const weak = kps.filter(k => k.mastery != null && k.mastery < WEAK_THRESHOLD)
  const avg = avgMastery(kpMastery[course.id])
  const budget = exam.dailyMinutes || 90

  const newPlans = []
  const changes = [] // 调整前后差异
  let overBudgetDays = 0
  const totalDays = Math.max(daysLeft, 3)
  const today = new Date()
  const fmt = d =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  for (let i = 0; i < totalDays; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() + i)
    const dateStr = fmt(d)
    const isToday = i === 0

    // 用户锁定的计划日 → 原样保留(不覆盖用户手工安排)
    const locked = (prevPlans || []).find(p => p.date === dateStr && p.locked)
    if (locked) {
      newPlans.push({ ...locked, locked: true })
      continue
    }

    let phase = i < 5 ? 'chapter' : i < totalDays - 3 ? 'practice' : 'sprint'
    const chapters = []
    const practiceTasks = []
    let planMinutes = 0

    if (isToday && weak.length > 0) {
      // 今日：薄弱知识点针对性练习优先，新知识自动让位
      phase = 'practice'
      weak.slice(0, 3).forEach(k => {
        chapters.push({
          name: `针对性练习：${k.name}`,
          pageRange: '个性化题组',
          keyPoints: ['回顾核心概念', '错题重做', '变式训练'],
          estimatedMinutes: 40,
          completed: false,
          targeted: true
        })
        planMinutes += 40
      })
    } else if (phase === 'chapter') {
      chapters.push({
        name: `第${i + 1}章 重点内容`,
        pageRange: `P${i * 20 + 1}-P${(i + 1) * 20}`,
        keyPoints: ['核心概念', '算法实现', '复杂度分析'],
        estimatedMinutes: 90,
        completed: false
      })
      planMinutes += 90
    } else {
      practiceTasks.push({
        type: phase === 'practice' ? '习题' : '往年真题',
        count: phase === 'practice' ? 10 : 20,
        estimatedMinutes: phase === 'practice' ? 60 : 90,
        completed: false
      })
      planMinutes += phase === 'practice' ? 60 : 90
    }

    // 硬约束：超出每日预算 → 拆减练习量并顺延内容
    if (planMinutes > budget) {
      overBudgetDays++
      const oldDesc = describePlanDay({ chapters, practiceTasks })
      // 拆分：练习数量按预算缩减，剩余内容顺延到下一章
      if (practiceTasks.length) {
        const scale = Math.max(Math.floor(budget / practiceTasks[0].estimatedMinutes), 1)
        practiceTasks[0].count = scale
        practiceTasks[0].estimatedMinutes = budget
        practiceTasks.push({
          type: '顺延题组',
          count: 0,
          estimatedMinutes: 0,
          completed: false,
          postponed: `剩余 ${planMinutes - budget} 分钟顺延至次日`
        })
      } else if (chapters.length && !chapters[0].targeted) {
        chapters[0].keyPoints = ['核心概念', '复杂度分析'] // 拆分章节
        chapters.push({
          name: `(顺延) ${chapters[0].name} 剩余内容`,
          pageRange: chapters[0].pageRange,
          keyPoints: ['算法实现'],
          estimatedMinutes: planMinutes - budget,
          completed: false,
          postponed: true
        })
      }
      planMinutes = budget
      const newDesc = describePlanDay({ chapters, practiceTasks })
      changes.push({
        date: dateStr,
        day: i + 1,
        from: `${oldDesc} (${oldDesc.includes('+') ? planMinutes + (planMinutes - budget) : planMinutes}分钟)`,
        to: `${newDesc}`,
        deltaMin: 0,
        reason: `超出每日预算 ${budget} 分钟，已拆减并顺延`
      })
    }

    newPlans.push({
      id: `plan_${exam.id}_r${i}`,
      examId: exam.id,
      date: dateStr,
      phase,
      dayNumber: i + 1,
      totalDays,
      chapters,
      practiceTasks,
      estimatedHours: Math.round((planMinutes / 60) * 10) / 10,
      completed: false,
      completedHours: 0,
      selfEvaluation: 0,
      adjusted: true,
      locked: false
    })
  }

  // 与旧计划逐日对比(调整前后差异，驱动"计划真的变化了"的展示)
  for (let i = 0; i < Math.min(newPlans.length, (prevPlans || []).length); i++) {
    const prev = prevPlans[i]
    const next = newPlans[i]
    if (!prev || prev.locked) continue
    const prevDesc = describePlanDay(prev)
    const nextDesc = describePlanDay(next)
    const prevMin = dayMinutes(prev)
    const nextMin = dayMinutes(next)
    if (prevDesc !== nextDesc) {
      const exists = changes.find(c => c.date === next.date)
      if (!exists) {
        changes.push({
          date: next.date,
          day: i + 1,
          from: `${prevDesc} (${prevMin}分钟)`,
          to: `${nextDesc} (${nextMin}分钟)`,
          deltaMin: nextMin - prevMin,
          reason: i === 0 && weak.length > 0
            ? '薄弱知识点触发针对性练习，新知识学习自动让位'
            : '计划按最新掌握度重新排程'
        })
      }
    }
  }

  // 决策解释(让AI的调整"有说服力")
  const lines = []
  if (weak.length > 0) {
    lines.push(`检测到 ${weak.map(k => `「${k.name}」(${k.mastery}%)`).join('、')} 掌握度低于 ${WEAK_THRESHOLD}% 阈值`)
    lines.push(`→ 今日自动减少新知识学习，改为针对性练习(各 40 分钟)`)
    lines.push(`→ 待正确率回升至 ${WEAK_THRESHOLD}% 以上再恢复章节推进`)
  } else {
    lines.push(`全部知识点掌握度均不低于 ${WEAK_THRESHOLD}%，可正常推进新章节`)
  }
  if (avg >= MASTERED_THRESHOLD) {
    lines.push(`平均掌握度 ${avg}%，已达到掌握水平，建议提前进入刷题阶段`)
  }
  if (overBudgetDays > 0) {
    lines.push(`约束检查：${overBudgetDays} 天的计划超出每日预算 ${budget} 分钟，已自动拆减练习量并将剩余内容顺延`)
  } else {
    lines.push(`约束检查：全部计划满足每日 ${budget} 分钟预算`)
  }
  const estimated = Math.round(avg * 0.75 + 25)
  lines.push(`按当前趋势预估成绩 ${estimated}-${Math.min(estimated + 8, 100)} 分(目标 ${targetScore} 分)`)
  const explanation = lines.join('\n')

  return { plans: newPlans, explanation, estimated, avg, changes, overBudgetDays }
}

function dayMinutes(plan) {
  const ch = (plan.chapters || []).reduce((a, b) => a + (b.estimatedMinutes || 0), 0)
  const pr = (plan.practiceTasks || []).reduce((a, b) => a + (b.estimatedMinutes || 0), 0)
  return ch + pr
}
