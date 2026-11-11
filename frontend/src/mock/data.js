/**
 * 学迹 StudyFlow - 模拟数据服务
 * 移植自学途(Study_Path)的 MockData.ets，日期全部相对今天动态生成，
 * 保证演示数据永远"新鲜"。实际开发中这些数据来自 FastAPI + MySQL。
 */
import { todayStr, nowStr, addDays, generateId } from '../constants'

/** 模拟用户信息 */
export function getMockUserInfo() {
  return {
    id: 'user_001',
    name: '张同学',
    avatar: '',
    studentId: '20240101001',
    school: '清华大学',
    major: '计算机科学与技术',
    enrollmentYear: 2024,
    expectedGraduationYear: 2028,
    phone: '138****8888',
    email: 'zhang@tsinghua.edu.cn'
  }
}

/** 模拟应用设置 */
export function getMockAppSettings() {
  return {
    theme: 'light',
    fontSize: 'medium',
    notificationEnabled: true,
    voiceEnabled: true,
    autoSync: true,
    privacyMode: false,
    language: 'zh'
  }
}

/** 模拟认证状态 */
export function getMockAuthState() {
  return {
    isAuthenticated: true,
    authMethod: 'fingerprint',
    lastAuthTime: nowStr(),
    privateLibraryEncrypted: true
  }
}

/** 模拟服务卡片配置 */
export function getMockWidgetConfig() {
  return {
    showTodayCourses: true,
    showTasks: true,
    showExamCountdown: true,
    showDailyReview: true,
    cardStyle: 'detailed'
  }
}

/** 模拟任务列表(截止日期相对今天) */
export function getMockTasks() {
  return [
    {
      id: generateId(),
      title: '完成数据结构课程作业第三章',
      description: '完成二叉树遍历算法的实现与分析，包括前序、中序、后序遍历及层次遍历',
      source: '微信',
      category: '作业',
      priority: '高',
      status: '待完成',
      deadline: `${addDays(todayStr(), 2)} 23:59`,
      estimatedDuration: 180,
      suggestedStartTime: nowStr(),
      courseName: '数据结构',
      attachments: [],
      ocrText: '数据结构作业：完成第三章二叉树遍历算法实现，截止日期7月18日',
      aiSummary: '需要完成二叉树遍历算法作业，建议分两个时间段进行，预计耗时3小时',
      subTasks: [
        { id: 'sub1', title: '理解二叉树遍历原理', completed: true },
        { id: 'sub2', title: '实现前序遍历算法', completed: false },
        { id: 'sub3', title: '实现中序遍历算法', completed: false },
        { id: 'sub4', title: '实现后序遍历算法', completed: false },
        { id: 'sub5', title: '实现层次遍历算法', completed: false },
        { id: 'sub6', title: '编写测试用例', completed: false }
      ],
      createdAt: nowStr(),
      updatedAt: nowStr(),
      tags: ['数据结构', '算法', '作业']
    },
    {
      id: generateId(),
      title: '准备英语四级考试 - 听力专项',
      description: '完成2套四级听力真题练习，重点训练新闻听力部分',
      source: '手动添加',
      category: '考试',
      priority: '高',
      status: '进行中',
      deadline: `${addDays(todayStr(), 4)} 18:00`,
      estimatedDuration: 120,
      suggestedStartTime: nowStr(),
      courseName: '大学英语',
      attachments: [],
      subTasks: [
        { id: 'sub7', title: '完成2024年6月真题听力', completed: true },
        { id: 'sub8', title: '完成2023年12月真题听力', completed: false },
        { id: 'sub9', title: '整理听力高频词汇', completed: false }
      ],
      createdAt: nowStr(),
      updatedAt: nowStr(),
      tags: ['英语', '四级', '听力']
    },
    {
      id: generateId(),
      title: '小组项目：校园导航小程序开发',
      description: '完成前端地图模块的UI设计和基础交互逻辑',
      source: 'QQ',
      category: '项目',
      priority: '中',
      status: '待完成',
      deadline: `${addDays(todayStr(), 9)} 23:59`,
      estimatedDuration: 480,
      suggestedStartTime: nowStr(),
      courseName: '软件工程',
      attachments: [],
      subTasks: [
        { id: 'sub10', title: '设计地图页面UI', completed: false },
        { id: 'sub11', title: '实现地图渲染', completed: false },
        { id: 'sub12', title: '实现导航路径计算', completed: false }
      ],
      createdAt: nowStr(),
      updatedAt: nowStr(),
      tags: ['软件工程', '项目', '小程序']
    },
    {
      id: generateId(),
      title: '阅读《算法导论》动态规划章节',
      description: '精读第15章动态规划，完成课后习题15.1-15.5',
      source: '手动添加',
      category: '阅读',
      priority: '低',
      status: '待完成',
      deadline: `${addDays(todayStr(), 6)} 23:59`,
      estimatedDuration: 150,
      suggestedStartTime: nowStr(),
      courseName: '算法设计与分析',
      attachments: [],
      subTasks: [
        { id: 'sub13', title: '阅读15.1-15.3节', completed: false },
        { id: 'sub14', title: '完成课后习题', completed: false }
      ],
      createdAt: nowStr(),
      updatedAt: nowStr(),
      tags: ['算法', '阅读', '动态规划']
    },
    {
      id: generateId(),
      title: 'ACM校赛报名',
      description: '提交ACM程序设计竞赛校内选拔赛报名表和简历',
      source: '手动添加',
      category: '竞赛',
      priority: '紧急',
      status: '待完成',
      deadline: `${addDays(todayStr(), 1)} 17:00`,
      estimatedDuration: 30,
      suggestedStartTime: nowStr(),
      attachments: [],
      subTasks: [
        { id: 'sub15', title: '填写报名表', completed: false },
        { id: 'sub16', title: '准备竞赛简历', completed: true },
        { id: 'sub17', title: '提交报名', completed: false }
      ],
      createdAt: nowStr(),
      updatedAt: nowStr(),
      tags: ['竞赛', 'ACM', '报名']
    }
  ]
}

/** 模拟AI对话消息 */
export function getMockChatMessages() {
  return [
    {
      id: 'msg1',
      role: 'user',
      content: '帮我看看这张群公告截图里有什么任务',
      timestamp: nowStr(),
      attachments: ['qr_code_screenshot.png']
    },
    {
      id: 'msg2',
      role: 'assistant',
      content: '我已经从截图中识别出以下内容：\n\n📋 识别的任务：\n1. 数据结构作业提交 - 截止时间：2天后，需包含实验报告和代码\n2. 下周组会安排 - 时间：下周三下午2点\n3. 实验课调课通知 - 原周四实验课调到周五下午\n\n已自动为您创建了相应的待办事项。需要我详细解释哪个任务吗？',
      timestamp: nowStr()
    },
    {
      id: 'msg3',
      role: 'user',
      content: '我的数据结构作业大概要多久完成？',
      timestamp: nowStr()
    },
    {
      id: 'msg4',
      role: 'assistant',
      content: '根据你的学习记录和作业要求，我分析如下：\n\n⏱️ 预计耗时：约3小时\n- 完成二叉树遍历算法实现：2小时\n- 编写测试用例：0.5小时\n- 整理实验报告：0.5小时\n\n📅 建议安排：\n今天下午14:00-17:00进行，这样你还有充足时间检查和修改。\n\n需要我把这个时间段加入你的今日待办吗？',
      timestamp: nowStr()
    }
  ]
}

/** 模拟课程列表(含图1中的 Machine Learning / Data Structures) */
export function getMockCourses() {
  return [
    {
      id: 'course_001',
      code: 'CS202',
      name: '数据结构',
      englishName: 'Data Structures',
      type: '必修',
      credits: 4,
      hours: 64,
      teacher: '李教授',
      semester: '2026春',
      description: '学习线性表、树、图等基本数据结构及其算法',
      syllabus: '第1-3章：线性结构\n第4-6章：树结构\n第7-9章：图结构\n第10-12章：排序与查找',
      prerequisites: ['程序设计基础'],
      materials: ['《数据结构(C语言版)》', '《算法导论》'],
      schedule: [
        { weekDay: 1, startPeriod: 1, periodCount: 2, classroom: '教学楼A301' },
        { weekDay: 3, startPeriod: 3, periodCount: 2, classroom: '教学楼A301' }
      ],
      examDate: `${addDays(todayStr(), 12)} 09:00`,
      grade: 'A-',
      score: 88
    },
    {
      id: 'course_002',
      code: 'CS301',
      name: '算法设计与分析',
      englishName: 'Algorithm Design and Analysis',
      type: '必修',
      credits: 3,
      hours: 48,
      teacher: '王教授',
      semester: '2026春',
      description: '学习分治、贪心、动态规划、回溯等算法设计方法',
      syllabus: '第1-2章：算法分析基础\n第3-5章：分治与贪心\n第6-8章：动态规划\n第9-10章：回溯与分支限界',
      prerequisites: ['数据结构'],
      materials: ['《算法导论》', '《算法设计与分析》'],
      schedule: [
        { weekDay: 2, startPeriod: 1, periodCount: 2, classroom: '教学楼B205' },
        { weekDay: 4, startPeriod: 5, periodCount: 2, classroom: '实验室C102' }
      ],
      examDate: `${addDays(todayStr(), 16)} 09:00`,
      grade: 'A',
      score: 92
    },
    {
      id: 'course_003',
      code: 'ENG102',
      name: '大学英语(四)',
      englishName: 'College English IV',
      type: '通识',
      credits: 2,
      hours: 32,
      teacher: 'Smith教授',
      semester: '2026春',
      description: '提升学术英语听说读写能力，备考CET-4',
      syllabus: 'Unit 1-2: Academic Writing\nUnit 3-4: Presentation Skills\nUnit 5-6: Research Reading',
      prerequisites: ['大学英语(三)'],
      materials: ['《新视野大学英语4》'],
      schedule: [
        { weekDay: 1, startPeriod: 5, periodCount: 2, classroom: '外语楼D101' }
      ],
      examDate: `${addDays(todayStr(), 14)} 14:00`,
      grade: 'B+',
      score: 82
    },
    {
      id: 'course_004',
      code: 'SE201',
      name: '软件工程',
      englishName: 'Software Engineering',
      type: '必修',
      credits: 3,
      hours: 48,
      teacher: '赵教授',
      semester: '2026春',
      description: '学习软件生命周期、需求分析、设计模式、敏捷开发方法',
      syllabus: '第1-3章：软件过程\n第4-6章：需求工程\n第7-9章：软件设计\n第10-12章：测试与维护',
      prerequisites: ['程序设计基础'],
      materials: ['《软件工程：实践者的研究方法》'],
      schedule: [
        { weekDay: 3, startPeriod: 1, periodCount: 2, classroom: '教学楼B301' }
      ],
      examDate: `${addDays(todayStr(), 19)} 09:00`,
      grade: 'A-',
      score: 86
    },
    {
      id: 'course_005',
      code: 'ML301',
      name: '机器学习',
      englishName: 'Machine Learning',
      type: '选修',
      credits: 3,
      hours: 48,
      teacher: '陈教授',
      semester: '2026秋',
      description: '学习监督学习、无监督学习与深度学习基础，含课程项目',
      syllabus: '第1-2章：绪论与模型评估\n第3-4章：线性模型与决策树\n第5-6章：神经网络\n第7-8章：聚类与降维',
      prerequisites: ['概率论', '线性代数'],
      materials: ['《机器学习》(周志华)', '《深度学习》'],
      schedule: [
        { weekDay: 2, startPeriod: 3, periodCount: 2, classroom: '信息楼E201' }
      ],
      examDate: '',
      grade: '',
      score: 0
    }
  ]
}

/** 知识点掌握度(自适应学习引擎的数据基础)
 *  图2核心创新：系统根据真实练习结果动态调整计划
 */
export function getMockKnowledgePoints() {
  return {
    course_001: {
      '线性表': { mastery: 85, assessed: true, records: [] },
      '栈与队列': { mastery: 78, assessed: true, records: [] },
      '二叉树': { mastery: 45, assessed: true, records: [{ date: addDays(todayStr(), -1), correct: 9, total: 20, minutes: 40 }] },
      '线索二叉树': { mastery: 38, assessed: true, records: [{ date: addDays(todayStr(), -1), correct: 6, total: 20, minutes: 30 }] },
      '哈夫曼树': { mastery: 52, assessed: true, records: [] },
      '图结构': { mastery: 88, assessed: true, records: [] },
      '排序': { mastery: 62, assessed: true, records: [] },
      '查找': { mastery: 70, assessed: true, records: [] }
    },
    course_005: {
      '线性回归': { mastery: 80, records: [] },
      '决策树': { mastery: 55, records: [{ date: addDays(todayStr(), -2), correct: 11, total: 20, minutes: 35 }] },
      '神经网络': { mastery: 40, records: [] },
      '聚类分析': { mastery: 66, records: [] }
    },
    course_002: {
      '分治策略': { mastery: 82, records: [] },
      '贪心算法': { mastery: 75, records: [] },
      '动态规划': { mastery: 58, records: [] },
      '回溯搜索': { mastery: 64, records: [] }
    }
  }
}

/** 模拟学业画像 */
export function getMockAcademicPortrait() {
  return {
    userId: 'user_001',
    grade: '大二',
    gpa: 3.7,
    majorGpa: 3.8,
    totalCredits: 168,
    earnedCredits: 52,
    skills: [
      { name: 'C++', level: 4, category: '编程语言', evidence: ['数据结构课程项目', 'ACM训练'] },
      { name: 'Python', level: 3, category: '编程语言', evidence: ['数据分析课程'] },
      { name: '数据结构', level: 4, category: '计算机基础', evidence: ['课程成绩A-'] },
      { name: '算法设计', level: 3, category: '计算机基础', evidence: ['课程成绩A', '力扣200题'] },
      { name: '团队协作', level: 4, category: '软技能', evidence: ['软件工程小组项目'] }
    ],
    strengths: ['算法思维强', '代码实现快', '学习主动性好'],
    weaknesses: ['英语听力偏弱', '系统设计经验不足'],
    competitions: [
      { name: '蓝桥杯程序设计竞赛', level: '省级', award: '二等奖', date: '2025-04', description: 'C/C++组别' },
      { name: '全国大学生数学建模', level: '国家级', award: '参与奖', date: '2025-09', description: '团队赛' }
    ],
    projects: [
      {
        name: '校园导航小程序', role: '前端开发', technologies: ['Vue 3', 'Element Plus', '地图API'],
        startDate: '2026-03', endDate: '2026-06', description: '智慧校园室内外一体化导航',
        achievements: ['完成地图模块', '路径规划算法优化30%']
      }
    ],
    papers: [],
    certificates: [
      { name: 'CET-4', issuer: '教育部', date: '2025-12', level: '通过(530)' }
    ],
    interests: ['算法竞赛', '移动应用开发', '人工智能'],
    goals: [
      {
        id: 'goal1', type: '保研', name: '清华大学计算机系', institution: '清华大学',
        requirements: ['GPA≥3.7', '科研经历', '竞赛获奖'], matchScore: 75,
        skillGaps: ['科研论文', '英语六级'],
        suggestedActions: ['联系导师', '参与科研项目', '备考六级']
      },
      {
        id: 'goal2', type: '就业', name: '字节跳动后端开发', institution: '字节跳动',
        requirements: ['计算机基础扎实', 'Go/Python', '分布式系统经验'], matchScore: 60,
        skillGaps: ['Go语言', '分布式系统', '系统设计'],
        suggestedActions: ['学习Go语言', '做分布式项目', '刷LeetCode']
      }
    ],
    updatedAt: todayStr()
  }
}

/** 模拟竞赛列表 */
export function getMockCompetitions() {
  return [
    {
      id: 'comp1',
      name: 'ACM-ICPC校内选拔赛',
      level: '校级',
      category: '编程竞赛',
      registrationDeadline: addDays(todayStr(), 4),
      competitionDate: addDays(todayStr(), 30),
      description: '选拔代表学校参加ACM-ICPC区域赛的队员',
      requirements: ['数据结构', '算法设计', 'C++/Java'],
      recommendedFor: ['算法竞赛方向', '编程能力强'],
      matchScore: 85,
      skillGaps: ['图论高级算法']
    },
    {
      id: 'comp2',
      name: '全国大学生数学建模竞赛',
      level: '国家级',
      category: '数学建模',
      registrationDeadline: addDays(todayStr(), 45),
      competitionDate: addDays(todayStr(), 55),
      description: '三人组队，在三天内完成一道题目的建模求解',
      requirements: ['数学基础', 'MATLAB/Python', '论文写作'],
      recommendedFor: ['数学基础好'],
      matchScore: 60,
      skillGaps: ['MATLAB', '建模方法论']
    },
    {
      id: 'comp3',
      name: '华为云AI创新应用大赛',
      level: '国家级',
      category: '应用开发',
      registrationDeadline: addDays(todayStr(), 15),
      competitionDate: addDays(todayStr(), 40),
      description: '基于大模型API与规则算法结合开发创新AI应用',
      requirements: ['Vue/Python', '大模型API', '创新能力'],
      recommendedFor: ['全栈开发方向'],
      matchScore: 90,
      skillGaps: []
    }
  ]
}

/** 模拟考试 */
export function getMockExams() {
  return [
    {
      id: 'exam1',
      name: '数据结构期末考试',
      courseName: '数据结构',
      courseId: 'course_001',
      date: `${addDays(todayStr(), 12)} 09:00`,
      duration: 120,
      examType: '期末',
      location: '教学楼A301',
      materials: [
        { id: 'mat1', type: 'PPT', name: '数据结构全学期课件', chapterCoverage: ['第1-10章'], importance: 5 },
        { id: 'mat2', type: '教材', name: '数据结构(C语言版)', chapterCoverage: ['第1-10章'], importance: 5 },
        { id: 'mat3', type: '往年题', name: '2023-2025期末真题', chapterCoverage: ['第1-10章'], importance: 4 },
        { id: 'mat4', type: '重点', name: '老师划重点笔记', chapterCoverage: ['第3-8章'], importance: 5 }
      ],
      masteryLevel: 65,
      targetScore: 88,
      dailyMinutes: 90,
      priority: 5
    },
    {
      id: 'exam2',
      name: '大学英语(四)期末考试',
      courseName: '大学英语(四)',
      courseId: 'course_003',
      date: `${addDays(todayStr(), 14)} 14:00`,
      duration: 100,
      examType: '期末',
      location: '外语楼D101',
      materials: [
        { id: 'mat5', type: '教材', name: '新视野大学英语4', chapterCoverage: ['Unit 1-6'], importance: 5 },
        { id: 'mat6', type: '往年题', name: '2024-2025期末真题', chapterCoverage: ['Unit 1-6'], importance: 4 }
      ],
      masteryLevel: 55,
      targetScore: 85,
      dailyMinutes: 60,
      priority: 4
    },
    {
      id: 'exam3',
      name: '算法设计与分析期末考试',
      courseName: '算法设计与分析',
      courseId: 'course_002',
      date: `${addDays(todayStr(), 16)} 09:00`,
      duration: 120,
      examType: '期末',
      location: '教学楼B205',
      materials: [
        { id: 'mat7', type: 'PPT', name: '算法设计全学期课件', chapterCoverage: ['第1-10章'], importance: 5 },
        { id: 'mat8', type: '往年题', name: '2023-2025期末真题', chapterCoverage: ['第1-10章'], importance: 4 }
      ],
      masteryLevel: 72,
      targetScore: 92,
      dailyMinutes: 120,
      priority: 4
    }
  ]
}

/** 模拟备考计划(逐日) */
export function getMockStudyPlan(examId) {
  const plans = []
  const totalDays = 12
  for (let i = 0; i < totalDays; i++) {
    const phase = i < 7 ? 'chapter' : i < 10 ? 'practice' : 'sprint'
    plans.push({
      id: `plan_${examId}_${i}`,
      examId,
      date: addDays(todayStr(), i),
      phase,
      dayNumber: i + 1,
      totalDays,
      chapters: i < 7
        ? [
            {
              name: `第${i + 1}章 重点内容`,
              pageRange: `P${i * 20 + 1}-P${(i + 1) * 20}`,
              keyPoints: ['核心概念', '算法实现', '时间复杂度分析'],
              estimatedMinutes: 90,
              completed: i < 2
            }
          ]
        : [],
      practiceTasks: i >= 7
        ? [
            {
              type: i < 10 ? '习题' : '往年真题',
              count: i < 10 ? 10 : 20,
              estimatedMinutes: i < 10 ? 60 : 90,
              completed: false
            }
          ]
        : [],
      estimatedHours: i < 7 ? 2 : i < 10 ? 2.5 : 3,
      completed: i < 2,
      completedHours: i < 2 ? (i < 7 ? 2 : 2.5) : 0,
      selfEvaluation: i < 2 ? 80 : 0,
      adjusted: i >= 2
    })
  }
  return plans
}

/** 模拟成绩预估 */
export function getMockScoreEstimate(examId) {
  return {
    examId,
    estimatedDate: todayStr(),
    currentMinScore: 70,
    currentMaxScore: 85,
    targetScore: 88,
    confidence: 65,
    weakAreas: ['二叉树高级应用', 'B+树', '外部排序'],
    strongAreas: ['基本排序算法', '哈希表', '图的遍历'],
    trendDescription: '近一周学习进度良好，二叉树章节掌握度从38%提升至45%，但仍低于60%阈值，已自动安排针对性练习，按此趋势有望在考前达到目标分数'
  }
}

/** 模拟学习进度 */
export function getMockStudyProgress(examId) {
  return {
    examId,
    daysLeft: 12,
    totalDays: 12,
    daysCompleted: 2,
    totalChapters: 7,
    chaptersCompleted: 2,
    totalPracticeTasks: 3,
    practiceTasksCompleted: 0,
    averageCorrectRate: 45,
    overallCompletion: 18
  }
}

/** 模拟今日待办聚合 */
export function getMockTodayAgenda() {
  return {
    date: todayStr(),
    courses: [
      { id: 'schedule1', courseName: '数据结构', teacher: '李教授', classroom: '教学楼A301', startTime: '08:00', endTime: '09:40' },
      { id: 'schedule2', courseName: '机器学习', teacher: '陈教授', classroom: '信息楼E201', startTime: '14:00', endTime: '15:40' }
    ],
    examCountdowns: [
      { id: 'cd1', examName: '数据结构期末', date: addDays(todayStr(), 12), daysLeft: 12, progressPercent: 18 },
      { id: 'cd2', examName: '英语四级', date: addDays(todayStr(), 30), daysLeft: 30, progressPercent: 40 }
    ],
    aiSuggestions: [
      '二叉树掌握度仅45%，今日已自动安排针对性练习并放缓新知识学习',
      '今日有数据结构课程，建议课前预习第6章树结构内容',
      'ACM报名明天截止，请尽快提交',
      '根据你的学习效率曲线，下午15:00-17:00是高效时段，适合攻克难点'
    ]
  }
}

/** 学习情况不同的演示输入，复盘由与真实记录相同的规则计算。 */
export function getMockReviewScenarios(today) {
  const examples = [
    { label: '无学习记录', tasks: [], sessions: [] },
    { label: '时长不足', tasks: [['整理课堂笔记', 20, true], ['补做动态规划练习', 55], ['复习算法概念', 30]], sessions: [25, 15] },
    { label: '按计划完成', tasks: [['复习二叉树', 45, true], ['整理错题', 35, true], ['完成英语听力', 40, true]], sessions: [45, 35, 40] },
    { label: '用时偏长且有待办', tasks: [['复查测试用例', 20, true], ['定位代码边界错误', 45], ['补写实验结论', 25]], sessions: [50, 35, 25] },
    { label: '自主学习', tasks: [], sessions: [30, 15] }
  ]
  return examples.map(({ label, tasks, sessions }, index) => {
    const date = addDays(today, index + 1 - examples.length)
    return {
      label, date,
      tasks: tasks.map(([title, estimatedDuration, done]) => ({
        title, estimatedDuration, deadline: date, completedAt: done ? date : null,
        status: done ? '已完成' : '待完成'
      })),
      sessionLogs: sessions.map(minutes => ({ date, minutes }))
    }
  })
}

/** 模拟知识库文档 */
export function getMockKnowledgeDocs() {
  return [
    {
      id: 'doc1',
      title: '数据结构-全学期课件',
      type: 'PPT',
      courseName: '数据结构',
      uploadDate: addDays(todayStr(), -6),
      tags: ['数据结构', '课件', '期末'],
      summary: '包含数据结构1-10章全部课堂课件'
    },
    {
      id: 'doc2',
      title: '算法设计-动态规划笔记',
      type: '笔记',
      courseName: '算法设计与分析',
      uploadDate: addDays(todayStr(), -4),
      tags: ['算法', '动态规划', '笔记'],
      summary: '动态规划章节的个人学习笔记，含例题解析'
    },
    {
      id: 'doc3',
      title: '软件工程-需求分析PPT',
      type: 'PPT',
      courseName: '软件工程',
      uploadDate: addDays(todayStr(), -8),
      tags: ['软件工程', '需求分析'],
      summary: '需求工程章节课件'
    },
    {
      id: 'doc4',
      title: '机器学习-决策树笔记',
      type: '笔记',
      courseName: '机器学习',
      uploadDate: addDays(todayStr(), -2),
      tags: ['机器学习', '决策树', '笔记'],
      summary: '决策树ID3/C4.5/CART算法对比笔记，决策树掌握度55%待提升'
    }
  ]
}

/** 模拟AI记忆 */
export function getMockAIMemories() {
  return [
    {
      id: 'mem1',
      type: 'preference',
      content: '用户偏好晚上7-10点学习编程类课程，早上8-10点学习数学类课程',
      importance: 7,
      createdAt: addDays(todayStr(), -30),
      lastAccessedAt: addDays(todayStr(), -1),
      accessCount: 15,
      relatedTopics: ['学习习惯', '时间管理']
    },
    {
      id: 'mem2',
      type: 'habit',
      content: '用户在每个任务开始前会先看一遍相关知识点的笔记',
      importance: 6,
      createdAt: addDays(todayStr(), -25),
      lastAccessedAt: addDays(todayStr(), -2),
      accessCount: 10,
      relatedTopics: ['学习方法', '笔记']
    },
    {
      id: 'mem3',
      type: 'goal',
      content: '用户本学期的目标GPA是3.8以上，希望保研到清华计算机系',
      importance: 9,
      createdAt: addDays(todayStr(), -120),
      lastAccessedAt: todayStr(),
      accessCount: 25,
      relatedTopics: ['学业目标', '保研规划']
    },
    {
      id: 'mem4',
      type: 'context',
      content: '用户正在准备ACM校内选拔赛，需要重点加强图论和高级数据结构',
      importance: 8,
      createdAt: addDays(todayStr(), -10),
      lastAccessedAt: todayStr(),
      accessCount: 8,
      relatedTopics: ['ACM竞赛', '图论', '算法训练']
    }
  ]
}

/** 模拟培养方案 */
export function getMockTrainingPlan() {
  return {
    major: '计算机科学与技术',
    school: '计算机学院',
    totalCredits: 168,
    requiredCredits: 100,
    electiveCredits: 30,
    generalCredits: 28,
    practiceCredits: 10,
    graduationRequirements: [
      '完成所有必修课学分',
      '总GPA不低于2.0',
      '通过毕业设计答辩',
      '完成专业实习'
    ]
  }
}

/**
 * 模拟测验题库：每道题关联具体知识点(驱动自适应计划)
 * 难度: 1基础 2进阶 3综合
 */
export function getMockQuiz(courseId) {
  const banks = {
    course_001: [
      {
        id: 'q_bt_1', kp: '二叉树', difficulty: 1,
        question: '对一棵二叉树进行先序遍历，遍历序列为 ABDECF，中序遍历序列为 DBEAFC，则后序遍历序列是？',
        options: ['DEBFCA', 'DEBFAC', 'DEBCFA', 'DBEFCA'],
        answer: 0,
        explanation: '由先序+中序唯一确定二叉树：A 为根，左子树 DBE，右子树 FC；左子树中 B 为根、D 为左、E 为右；右子树 C 为根、F 为左。后序遍历：DEBFCA。'
      },
      {
        id: 'q_bt_2', kp: '二叉树', difficulty: 2,
        question: '具有 3 个结点的二叉树共有几种不同的形态？',
        options: ['3 种', '4 种', '5 种', '6 种'],
        answer: 2,
        explanation: 'n 个结点的二叉树形态数为卡特兰数 C(2n,n)/(n+1)。n=3 时为 5 种。'
      },
      {
        id: 'q_tb_1', kp: '线索二叉树', difficulty: 2,
        question: '在中序线索二叉树中，若某结点有左孩子，则其左指针域指向？',
        options: ['中序前驱', '左孩子', '中序后继', '右孩子'],
        answer: 1,
        explanation: '线索化仅利用空指针域：有左孩子时左指针指向左孩子；左指针为空时才指向中序前驱（线索）。'
      },
      {
        id: 'q_tb_2', kp: '线索二叉树', difficulty: 3,
        question: '一棵中序线索二叉树的线索（非孩子指针）数量与结点数 n 的关系是？',
        options: ['n 条', 'n-1 条', 'n+1 条', '2n 条'],
        answer: 2,
        explanation: 'n 个结点共 2n 个指针域，其中 n-1 个指向孩子，剩下 n+1 个空指针域全部用作线索。'
      },
      {
        id: 'q_g_1', kp: '图结构', difficulty: 2,
        question: '具有 n 个顶点的无向图，其邻接矩阵的非零元素个数（不含对角线）是？',
        options: ['n²', '边数的 2 倍', '边数', 'n(n-1)/2'],
        answer: 1,
        explanation: '无向图每条边在邻接矩阵中对应两个对称的非零元素，因此非零元素数为边数的 2 倍。'
      },
      {
        id: 'q_s_1', kp: '排序', difficulty: 1,
        question: '快速排序的平均时间复杂度是？',
        options: ['O(n)', 'O(n log n)', 'O(n²)', 'O(log n)'],
        answer: 1,
        explanation: '快速排序平均时间复杂度 O(n log n)，最坏（已有序且基准选择不当）为 O(n²)。'
      }
    ],
    course_005: [
      {
        id: 'q_ml_dt_1', kp: '决策树', difficulty: 1,
        question: 'ID3 算法选择划分属性时使用的指标是？',
        options: ['基尼指数', '信息增益', '增益率', '均方误差'],
        answer: 1,
        explanation: 'ID3 使用信息增益，C4.5 使用增益率，CART 使用基尼指数。'
      },
      {
        id: 'q_ml_dt_2', kp: '决策树', difficulty: 2,
        question: '关于决策树剪枝，下列说法正确的是？',
        options: ['预剪枝比后剪枝更容易欠拟合', '剪枝只能减少过拟合风险，不会影响泛化', '后剪枝是在训练完成后自底向上进行的', '预剪枝在构建完成后进行'],
        answer: 2,
        explanation: '后剪枝在决策树生成后自底向上考察非叶结点；预剪枝在构建过程中进行，容易欠拟合。'
      },
      {
        id: 'q_ml_lr_1', kp: '线性回归', difficulty: 1,
        question: '线性回归模型 y = wx + b 中，最小二乘法的优化目标是？',
        options: ['最大化残差平方和', '最小化残差平方和', '最小化模型参数个数', '最大化相关系数'],
        answer: 1,
        explanation: '最小二乘法通过最小化残差（预测值与真实值之差）的平方和来拟合参数。'
      },
      {
        id: 'q_ml_nn_1', kp: '神经网络', difficulty: 2,
        question: '反向传播算法的主要作用是？',
        options: ['初始化网络权重', '沿梯度方向更新网络参数', '增加网络层数', '防止过拟合'],
        answer: 1,
        explanation: '反向传播利用链式法则计算损失对各参数的梯度，并沿负梯度方向更新参数。'
      }
    ]
  }
  return banks[courseId] || []
}

/** 模拟学习专注记录(Study Session) */
export function getMockSessionLogs() {
  return [
    { id: generateId(), date: addDays(todayStr(), -1), courseName: '数据结构', courseId: 'course_001', minutes: 45, taskTitle: '二叉树遍历算法实现', taskCompleted: true, correctRate: 45, kp: '二叉树' },
    { id: generateId(), date: addDays(todayStr(), -1), courseName: '机器学习', courseId: 'course_005', minutes: 25, taskTitle: '决策树课后题', taskCompleted: true, correctRate: 55, kp: '决策树' },
    { id: generateId(), date: addDays(todayStr(), -2), courseName: '数据结构', courseId: 'course_001', minutes: 60, taskTitle: '栈与队列习题', taskCompleted: true, correctRate: 80, kp: '栈与队列' }
  ]
}
