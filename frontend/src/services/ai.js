/**
 * 学迹 StudyFlow - AI 智能服务(规则引擎)
 * 图2要求：第一版不训练模型，通过"大模型API + 规则算法"配合完成核心功能。
 * 本文件为规则算法部分；当 FastAPI 后端 + 大模型 API 可用时，
 * api.js 会优先调用真实大模型，失败时自动降级到本规则引擎。
 */
import { todayStr, nowStr, relativeTime, generateId } from '../constants'

/** 对话式任务解析：从自然语言中提取任务信息 */
export function parseTaskFromText(text) {
  let priority = '中'
  let category = '作业'
  let estimatedDuration = 60
  let deadline = `${todayStr()} 23:59`

  if (/紧急|马上|立刻|尽快|来不及|截止今晚|明天截止/.test(text)) {
    priority = '紧急'
  } else if (/重要|优先|重点/.test(text)) {
    priority = '高'
  } else if (/有空|不急|随便|阅读|看完/.test(text)) {
    priority = '低'
  }

  if (/考试|复习|备考|四级|六级/.test(text)) category = '考试'
  else if (/项目|开发|小程序|代码/.test(text)) category = '项目'
  else if (/阅读|读完|看书/.test(text)) category = '阅读'
  else if (/竞赛|比赛|报名/.test(text)) category = '竞赛'

  const hourMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:个)?(?:小时|h|H)/)
  if (hourMatch) estimatedDuration = Math.round(parseFloat(hourMatch[1]) * 60)
  else if (/(半小时)/.test(text)) estimatedDuration = 30

  const today = /今天|今晚|今日/.test(text)
  const tomorrow = /明天|明日/.test(text)
  const nextWeek = /下周/.test(text)
  const dayMatch = text.match(/(\d+)天后/)
  if (today) deadline = `${todayStr()} 23:59`
  else if (tomorrow) {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    deadline = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} 23:59`
  } else if (dayMatch) {
    const d = new Date()
    d.setDate(d.getDate() + parseInt(dayMatch[1]))
    deadline = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} 23:59`
  } else if (nextWeek) {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    deadline = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} 23:59`
  }

  const hourOfDay = text.match(/(上午|下午|晚上)?\s*(\d{1,2})点/)
  let suggestedStartTime = nowStr()
  if (hourOfDay) {
    let h = parseInt(hourOfDay[2])
    if (hourOfDay[1] === '下午' && h < 12) h += 12
    if (hourOfDay[1] === '晚上') h = h < 12 ? h + 12 : h
    suggestedStartTime = `${todayStr()} ${String(h).padStart(2, '0')}:00`
  }

  return {
    title: text.length > 40 ? text.slice(0, 40) + '...' : text,
    description: text,
    source: 'AI解析',
    category,
    priority,
    status: '待完成',
    deadline,
    estimatedDuration,
    suggestedStartTime,
    attachments: [],
    subTasks: [{ id: generateId(), title: text.slice(0, 30), completed: false }],
    createdAt: nowStr(),
    updatedAt: nowStr(),
    tags: ['AI解析']
  }
}

/** 模拟OCR识别：演示模式返回示例结果(接入大模型API后可真实识别) */
export function simulateOcr(fileName) {
  const name = (fileName || '群公告截图.png').toLowerCase()
  let tasks = []
  if (name.includes('公告') || name.includes('群')) {
    tasks = [
      { title: '数据结构作业提交', deadline: `${todayStr()} 23:59`, category: '作业', priority: '高' },
      { title: '下周组会：项目进度汇报', deadline: `${todayStr()} 23:59`, category: '项目', priority: '中' }
    ]
  } else if (name.includes('课表')) {
    tasks = [
      { title: '周四实验课调到周五下午', deadline: `${todayStr()} 23:59`, category: '其他', priority: '中' }
    ]
  } else if (name.includes('作业')) {
    tasks = [
      { title: '完成老师布置的课后作业', deadline: `${todayStr()} 23:59`, category: '作业', priority: '中' }
    ]
  } else {
    tasks = [
      { title: '完成学习任务安排', deadline: `${todayStr()} 23:59`, category: '作业', priority: '中' },
      { title: '整理课程笔记', deadline: `${todayStr()} 23:59`, category: '阅读', priority: '低' }
    ]
  }
  return {
    recognizedText: `[模拟OCR识别结果]\n已从「${fileName || '截图'}」中识别出 ${tasks.length} 项任务信息：\n` +
      tasks.map((t, i) => `${i + 1}. ${t.title}(${t.priority}优先级)`) .join('\n'),
    tasks
  }
}

/**
 * 模拟课程资料解析(B2 资料→知识点链路)
 * 后端在线时由大模型真实解析；离线演示按文件名/类型生成可追溯的知识点列表
 */
export function simulateMaterialParse(fileName, fileSize) {
  const name = (fileName || '').toLowerCase()
  let kps = []
  if (name.includes('数据结构') || name.includes('data')) {
    kps = [
      { name: '二叉树遍历', source: `${fileName} · 第6章 P45-58` },
      { name: '线索二叉树', source: `${fileName} · 第6章 P58-66` },
      { name: '哈夫曼树', source: `${fileName} · 第6章 P67-72` }
    ]
  } else if (name.includes('算法')) {
    kps = [
      { name: '动态规划', source: `${fileName} · 第6-8章` },
      { name: '分治策略', source: `${fileName} · 第3-5章` }
    ]
  } else if (name.includes('机器学习') || name.includes('machine')) {
    kps = [
      { name: '决策树', source: `${fileName} · 第4章` },
      { name: '神经网络', source: `${fileName} · 第5章` }
    ]
  } else {
    kps = [
      { name: '核心概念', source: `${fileName} · 解析摘要` }
    ]
  }
  return {
    kps,
    summary: `已解析文件「${fileName}」（${(fileSize / 1024).toFixed(1)} KB），提取出 ${kps.length} 个知识点，请确认后进入计划流程`,
    chunks: kps.map(k => ({ text: `${k.name} 相关章节内容切片`, source: k.source }))
  }
}

/** 规则引擎 AI 对话回复(后端不可用时的降级方案) */
export function generateRuleReply(input, ctx) {
  const text = (input || '').toLowerCase()
  const { tasks, courses, exams, todayAgenda } = ctx

  if (text.includes('今天') || text.includes('今日') || text.includes('课程')) {
    const courseLines = (todayAgenda?.courses || [])
      .map(c => `• ${c.courseName} ${c.startTime}-${c.endTime} @${c.classroom}`)
      .join('\n') || '无课程安排'
    const pending = (tasks || []).filter(t => t.status !== '已完成').slice(0, 3)
    const taskLines = pending.map(t => `• ${t.title} (${relativeTime(t.deadline)}截止)`).join('\n') || '暂无待办'
    const examLines = (todayAgenda?.examCountdowns || [])
      .map(e => `• ${e.examName}: 还有${e.daysLeft}天`)
      .join('\n') || '无即将考试'
    return `📋 今日待办汇总（${todayStr()}）\n\n📚 课程：\n${courseLines}\n\n📝 待办任务：\n${taskLines}\n\n⏰ 考试倒计时：\n${examLines}`
  }

  if (text.includes('任务') || text.includes('待办')) {
    const pending = (tasks || []).filter(t => t.status !== '已完成')
    let result = `你当前有 ${pending.length} 个待完成任务：\n\n`
    pending.slice(0, 5).forEach((t, i) => {
      result += `${i + 1}. ${t.title}\n   📎 来源：${t.source}\n   ⏰ 截止：${relativeTime(t.deadline)}\n   ⏱️ 预计耗时：${Math.floor(t.estimatedDuration / 60)}小时${t.estimatedDuration % 60}分钟\n\n`
    })
    result += pending.length > 0 ? '建议按优先级依次完成，需要我帮你排顺序吗？' : '当前没有待办任务，可以放松一下～'
    return result
  }

  if (text.includes('你好') || text.includes('hi') || text.includes('hello') || text.includes('在吗')) {
    return '你好呀！👋 我是学迹AI学习管家，一直在的～\n\n我能根据你的真实学习结果动态调整学习计划，而不是只生成一张漂亮的计划表。\n\n需要帮你看看今天的课程和任务，还是聊聊学习上的问题？'
  }

  if (text.includes('考试') || text.includes('复习') || text.includes('备考')) {
    const examLines = (exams || []).map(e =>
      `• ${e.name}: ${e.date} · 当前掌握度 ${e.masteryLevel}% · 目标 ${e.targetScore} 分`
    ).join('\n')
    return `📚 关于备考，我来帮你分析：\n\n${examLines}\n\n💡 建议：\n• 优先复习薄弱章节，别平均用力\n• 练习正确率低于60%的知识点会自动触发针对性练习\n• 每天保持2-3小时专注学习即可\n\n需要我帮你重新规划备考计划吗？可以去「考试Agent」页面查看～`
  }

  if (text.includes('怎么学') || text.includes('如何') || text.includes('建议') || text.includes('方法') || text.includes('规划')) {
    return '很好的问题！根据你的学习画像，我建议：\n\n🎯 短期优先：\n• 先处理截止日期最近的作业和任务\n• 二叉树掌握度只有45%，建议先做针对性练习再学新内容\n\n📅 中期规划：\n• 算法设计课每周至少刷5道LeetCode题\n• 英语坚持每天30分钟听力训练\n\n🏆 长期目标：\n• 保持GPA 3.7+为保研打基础\n• ACM校内赛可以准备起来，去「学业规划→竞赛」看看\n\n需要针对某个具体科目给你建议吗？'
  }

  if (text.includes('竞赛') || text.includes('保研') || text.includes('考研') || text.includes('就业') || text.includes('实习')) {
    return '关于未来发展，从你当前的学业画像来看：\n\n🎓 保研方向：\n• 清华大学计算机系 — 需提升科研论文+英语六级\n• 建议联系导师、参与科研项目\n\n🏆 推荐竞赛：\n• 华为云AI创新应用大赛（匹配度90%）\n• ACM校内选拔赛（匹配度85%，需补图论算法）\n\n💼 就业方向：\n• 字节跳动后端 — 需提升Go语言、分布式系统\n\n去「学业规划」页面可以看到详细分析和能力缺口～'
  }

  if (text.includes('机器学习') || text.includes('machine learning')) {
    return '关于机器学习课程：\n\n📊 你的知识点掌握情况：\n• 线性回归 80% ✓ 较好\n• 决策树 55% ⚠ 低于60%阈值\n• 神经网络 40% ⚠ 需要加强\n\n💡 决策树与神经网络练习正确率偏低，我已自动减少了新知识学习，为你安排了针对性练习。建议今天先完成「决策树」的40分钟专项训练。'
  }

  if (text.includes('二叉树')) {
    return '关于二叉树：\n\n📉 最近一次练习正确率 45%，掌握度处于低位。\n\n我的决策：\n• 暂停二叉树相关的新知识推进\n• 今天安排 40 分钟针对性练习：遍历算法 + 树的性质题\n• 正确率回升到 60% 以上后，再恢复章节学习\n\n这比普通日程规划器更有效——因为计划是根据你的真实练习结果调整的，而不是一张静态的计划表。'
  }

  const preview = text.length > 30 ? text.slice(0, 30) + '...' : text
  return `收到你的问题！🤔\n\n关于"${preview}"，我是学迹AI学习管家～\n\n你可以去「学业规划」页面查看学业画像，或者去「考试Agent」制定针对性计划。\n也可以换个方式描述你的问题，我会更精准回答～`
}
