const dateOf = value => typeof value === 'string' ? value.slice(0, 10) : ''
const minutesOf = value => Number.isFinite(value) && value > 0 ? value : 0

export function buildDailyReview(date, tasks, sessionLogs) {
  const dailyTasks = tasks.filter(task => !task.reviewDemo && (
    task.status === '已完成' ? dateOf(task.completedAt) === date : dateOf(task.deadline) === date
  ))
  const completed = dailyTasks.filter(task => task.status === '已完成')
  const pending = dailyTasks.filter(task => task.status !== '已完成')
  const sessions = sessionLogs.filter(log => !log.reviewDemo && log.date === date && minutesOf(log.minutes))
  const focusMinutes = sessions.reduce((sum, log) => sum + log.minutes, 0)
  const plannedMinutes = dailyTasks.reduce((sum, task) => sum + minutesOf(task.estimatedDuration), 0)
  const progress = plannedMinutes ? focusMinutes / plannedMinutes : null
  let efficiencyScore = null
  if (dailyTasks.length) {
    const completion = completed.length / dailyTasks.length
    efficiencyScore = Math.round(progress === null ? completion * 100 : Math.min(progress, 1) * 70 + completion * 30)
  }

  const hasActivity = Boolean(dailyTasks.length || sessions.length)
  const taskSummary = dailyTasks.length
    ? `完成 ${completed.length}/${dailyTasks.length} 项任务，`
    : '当天没有到期或完成的任务，'
  const summary = hasActivity
    ? `${taskSummary}专注 ${focusMinutes} 分钟（${sessions.length} 次）。`
    : '当天没有到期或完成的任务，也没有专注记录。'
  let deviationExplanation = summary
  const suggestions = []
  if (!hasActivity) {
    suggestions.push('可以先添加一项学习任务，结束专注后再刷新复盘。')
  } else if (plannedMinutes) {
    const difference = focusMinutes - plannedMinutes
    deviationExplanation += difference === 0 ? ' 专注时长达到计划。'
      : difference > 0 ? ` 比任务预计时长多 ${difference} 分钟。`
        : ` 距任务预计时长还差 ${-difference} 分钟。`
  } else {
    deviationExplanation += ' 当天没有可比较的任务预计时长。'
  }

  if (pending.length) {
    const next = [...pending].sort((a, b) => (a.deadline || '').localeCompare(b.deadline || ''))[0]
    suggestions.push(`还有 ${pending.length} 项未完成，优先继续「${next.title || '未命名任务'}」。`)
    if (progress !== null && progress >= 1) {
      suggestions.push('专注时长已达到计划，尝试拆分剩余任务，记录卡住的步骤。')
    } else if (progress !== null) {
      suggestions.push('为剩余任务安排一段专注时间，再核对进度。')
    }
  } else if (completed.length) {
    suggestions.push('当天任务已完成，可以回看完成记录并安排下一项学习任务。')
  } else if (sessions.length) {
    suggestions.push('已记录自主学习。若这段学习有明确目标，可以添加任务来跟踪进度。')
  }

  return {
    date, completedTasks: completed.length, totalTasks: dailyTasks.length,
    focusMinutes, plannedMinutes, sessionCount: sessions.length,
    efficiencyScore, hasActivity, summary, deviationExplanation, suggestions,
    dataSources: ['当天到期或完成的任务', '当天结束并保存的专注会话']
  }
}
