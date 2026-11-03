<template>
  <div class="home-page">
    <!-- Hello 横幅：今日必做 + 主按钮(A1：新用户5秒识别首要任务) -->
    <div class="hero fade-up">
      <div class="hero-left">
        <div class="hello">Hello，{{ store.userInfo?.name || '同学' }} 👋</div>
        <div class="sub">{{ formatDateCN(today) }} {{ weekday }}</div>
        <div class="must-do" v-if="topTask">
          <span class="must-label">🎯 今日必做</span>
          <span class="must-title">{{ topTask.title }}</span>
          <span class="must-deadline">{{ relativeTime(topTask.deadline) }}截止 · {{ formatMinutes(topTask.estimatedDuration) }}</span>
        </div>
        <div class="must-do" v-else>
          <span class="must-label">🎯 今日必做</span>
          <span class="must-title">暂无待办任务，开启一次专注学习吧</span>
        </div>
        <div class="hero-actions">
          <el-button type="primary" size="large" round class="cta" @click="startFocusTask(topTask)">
            <el-icon><VideoPlay /></el-icon>&nbsp;开始专注
          </el-button>
          <el-button size="large" round class="cta-ghost" @click="$router.push('/tasks')">查看任务</el-button>
          <el-button size="large" round class="cta-ghost" @click="showDemo = true">
            🎬 评委演示模式
          </el-button>
        </div>
      </div>
      <div class="hero-stats">
        <div class="hs-item" @click="$router.push('/tasks')">
          <div class="hs-v">{{ store.pendingTasks.length }}</div>
          <div class="hs-k">📝 待办任务</div>
        </div>
        <div class="hs-item" @click="$router.push('/plan')">
          <div class="hs-v">{{ todayCourses.length }}</div>
          <div class="hs-k">📚 今日课程</div>
        </div>
        <div class="hs-item" @click="$router.push('/exam')">
          <div class="hs-v">{{ examDays }}</div>
          <div class="hs-k">🎯 最近考试(天)</div>
        </div>
        <div class="hs-item" @click="$router.push('/review')">
          <div class="hs-v">{{ studyMinutes }}min</div>
          <div class="hs-k">⏱️ 今日专注</div>
        </div>
      </div>
    </div>

    <!-- 中部：AI 推荐 + 学习计时器 -->
    <div class="grid-main-side">
      <!-- AI 学习推荐(自适应引擎实时生成，折叠展示) -->
      <div class="card rec-card fade-up">
        <div class="card-title">
          <span class="t">🤖 AI Study Recommendations</span>
          <span class="more" @click="$router.push('/exam')">自适应引擎动态生成 ›</span>
        </div>
        <div class="rec-grid">
          <div v-for="rec in shownRecs" :key="rec.title" class="rec-item">
            <span class="rec-icon">{{ rec.icon }}</span>
            <div class="rec-body">
              <div class="rec-title">
                {{ rec.title }}
                <span class="tag" :style="reasonStyle(rec.reason)">{{ rec.reason }}</span>
              </div>
              <div class="rec-desc">{{ rec.desc }}</div>
            </div>
            <el-icon v-if="rec.courseId" class="rec-arrow" @click="focusCourse(rec)"><VideoPlay /></el-icon>
          </div>
        </div>
        <div v-if="store.recommendations.length > 4" class="rec-more" @click="showAllRecs = !showAllRecs">
          {{ showAllRecs ? '收起' : `展开全部 ${store.recommendations.length} 条建议` }}
        </div>
      </div>

      <!-- 学习计时器(图1: Study Session 00:00:00) -->
      <StudyTimer ref="timerRef" class="fade-up" />
    </div>

    <!-- 今日待办 + 考试倒计时(合并卡片，去除重复) -->
    <div class="section-title">
      今日待办
      <span class="more" @click="$router.push('/tasks')">全部任务 ›</span>
    </div>
    <div class="card">
      <div class="exam-strip" v-if="store.exams.length">
        <span
          v-for="exam in store.exams.slice(0, 3)"
          :key="exam.id"
          class="exam-pill"
          @click="$router.push('/exam')"
        >
          {{ exam.name }} · <b>{{ daysUntil(exam.date) }}天</b>
        </span>
      </div>
      <TaskCard
        v-for="t in store.tasks.slice(0, 4)"
        :key="t.id"
        :task="t"
        :show-detail="false"
        @toggle-task="(tid) => store.toggleTask(tid)"
        @toggle-sub="(tid, sid) => store.toggleSubTask(tid, sid)"
        @complete="(tid) => store.completeTask(tid)"
        @focus="(task) => startFocusTask(task)"
      />
      <el-empty v-if="!store.tasks.length" description="暂无任务" :image-size="60" />
    </div>

    <!-- 课程掌握度(图1: Machine Learning / Data Structures) -->
    <div class="section-title">
      课程掌握度
      <span class="more" @click="$router.push('/plan')">课程管理 ›</span>
    </div>
    <div class="grid-4">
      <div v-for="course in featuredCourses" :key="course.id" class="course-card card fade-up">
        <div class="cc-top">
          <span class="cc-name">{{ course.englishName }}</span>
          <span class="cc-type">{{ course.type }}</span>
        </div>
        <div class="cc-cn">{{ course.name }}</div>
        <div class="cc-mastery">
          <span>掌握度</span>
          <span class="cc-pct" :class="masteryClass(course.id)">{{ masteryOf(course.id) }}%</span>
        </div>
        <el-progress
          :percentage="masteryOf(course.id)"
          :stroke-width="6"
          :color="masteryColor(course.id)"
          :show-text="false"
        />
        <div class="cc-weak" v-if="weakKpsOf(course.id).length">
          ⚠️ 薄弱：{{ weakKpsOf(course.id).map(k => k.name).join('、') }}（已安排针对性练习）
        </div>
        <el-button class="cc-btn" size="small" round type="primary" plain @click="startFocus(course)">
          <el-icon><VideoPlay /></el-icon>&nbsp;继续学习
        </el-button>
      </div>
    </div>

    <!-- 评委演示模式(B8) -->
    <el-dialog v-model="showDemo" title="🎬 评委演示模式 · 自适应学习闭环" width="88%" align-center>
      <DemoWizard @done="showDemo = false" />
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '../store'
import { todayStr, formatDateCN, formatMinutes, daysBetween, relativeTime } from '../constants'
import { WEAK_THRESHOLD, MASTERED_THRESHOLD, listKps } from '../services/adaptive'
import StudyTimer from '../components/StudyTimer.vue'
import TaskCard from '../components/TaskCard.vue'
import DemoWizard from '../components/DemoWizard.vue'

const store = useAppStore()
const route = useRoute()
const router = useRouter()
const timerRef = ref(null)
const showDemo = ref(false)
const showAllRecs = ref(false)
const today = todayStr()
const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][new Date().getDay()]

const todayCourses = computed(() =>
  store.todayAgenda?.courses || store.courses.slice(0, 2)
)

const examDays = computed(() => {
  const nearest = store.exams
    .map(e => daysUntil(e.date))
    .filter(d => d >= 0)
    .sort((a, b) => a - b)[0]
  return nearest ?? '—'
})

const studyMinutes = computed(() =>
  store.sessionLogs
    .filter(l => l.date === today)
    .reduce((a, b) => a + b.minutes, 0)
)

const featuredCourses = computed(() => store.courses.slice(0, 4))

const shownRecs = computed(() =>
  showAllRecs.value ? store.recommendations : store.recommendations.slice(0, 4)
)

/** 今日必做：优先级最高且截止最近的待办任务 */
const topTask = computed(() => {
  const p = { 紧急: 0, 高: 1, 中: 2, 低: 3 }
  return [...store.pendingTasks].sort((a, b) =>
    (p[a.priority] ?? 2) - (p[b.priority] ?? 2) || a.deadline.localeCompare(b.deadline)
  )[0] || null
})

// 从任务页「开始专注」跳转而来 → 自动绑定并开始
onMounted(() => {
  if (route.query.focus) {
    const task = store.tasks.find(t => t.id === route.query.focus)
    if (task) startFocusTask(task)
  }
})

function masteryOf(courseId) {
  return store.avgKpMastery(courseId)
}

function weakKpsOf(courseId) {
  return listKps(store.kpMastery[courseId]).filter(k => k.mastery != null && k.mastery < WEAK_THRESHOLD)
}

function masteryColor(courseId) {
  const m = masteryOf(courseId)
  if (m >= MASTERED_THRESHOLD) return '#4CAF50'
  if (m >= WEAK_THRESHOLD) return '#1E88E5'
  return '#FF9800'
}

function masteryClass(courseId) {
  const m = masteryOf(courseId)
  if (m >= MASTERED_THRESHOLD) return 'good'
  if (m >= WEAK_THRESHOLD) return 'mid'
  return 'weak'
}

function reasonStyle(reason) {
  const map = {
    薄弱知识点: { background: '#F4433615', color: '#F44336' },
    已掌握推进: { background: '#4CAF5015', color: '#4CAF50' },
    考试倒计时: { background: '#1E88E515', color: '#1E88E5' },
    紧急任务: { background: '#FF980015', color: '#FF9800' }
  }
  return map[reason] || { background: '#75757515', color: '#757575' }
}

function daysUntil(dateStr) {
  return Math.max(daysBetween(today, dateStr.slice(0, 10)), 0)
}

function courseOf(task) {
  return store.courses.find(c => c.name === task.courseName) || null
}

function focusCourse(rec) {
  const course = store.courses.find(c => c.id === rec.courseId)
  if (course) startFocus(course)
}

/** 从任务开始专注：自动绑定任务并滚动到计时器 */
function startFocusTask(task) {
  if (!task) {
    router.push('/tasks')
    return
  }
  const course = courseOf(task)
  if (timerRef.value) timerRef.value.setCourseAndTask(course?.id || '', task)
  timerRef.value?.$el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

/** 从课程开始专注 */
function startFocus(course, task = null) {
  if (timerRef.value) timerRef.value.setCourseAndTask(course.id, task)
  timerRef.value?.$el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}
</script>

<style scoped>
.hero {
  background: linear-gradient(120deg, #1E88E5, #26A69A);
  border-radius: 16px;
  padding: 22px 26px;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 18px;
  flex-wrap: wrap;
}

.hero-left {
  flex: 1;
  min-width: 320px;
}

.hello {
  font-size: 26px;
  font-weight: bold;
}

.sub {
  font-size: 13px;
  opacity: 0.9;
  margin-top: 4px;
}

.must-do {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 14px;
  background: rgba(255, 255, 255, 0.16);
  border-radius: 10px;
  padding: 10px 14px;
  flex-wrap: wrap;
}

.must-label {
  font-size: 12px;
  font-weight: bold;
  background: rgba(255, 255, 255, 0.25);
  padding: 3px 8px;
  border-radius: 6px;
  white-space: nowrap;
}

.must-title {
  font-size: 14px;
  font-weight: 600;
}

.must-deadline {
  font-size: 11px;
  opacity: 0.85;
}

.hero-actions {
  display: flex;
  gap: 10px;
  margin-top: 14px;
  flex-wrap: wrap;
}

.cta {
  min-width: 130px;
}

.cta-ghost {
  background: rgba(255, 255, 255, 0.14) !important;
  border-color: transparent !important;
  color: #fff !important;
}

.hero-stats {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
}

.hs-item {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  padding: 12px 18px;
  text-align: center;
  cursor: pointer;
  transition: background 0.2s;
  min-width: 88px;
}

.hs-item:hover {
  background: rgba(255, 255, 255, 0.28);
}

.hs-v {
  font-size: 22px;
  font-weight: bold;
}

.hs-k {
  font-size: 11px;
  opacity: 0.9;
  margin-top: 3px;
  white-space: nowrap;
}

.rec-card {
  display: flex;
  flex-direction: column;
}

.rec-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px 14px;
}

.rec-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 8px;
  border-bottom: 1px solid var(--divider);
}

.rec-icon {
  font-size: 20px;
}

.rec-body {
  flex: 1;
  min-width: 0;
}

.rec-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.rec-desc {
  font-size: 11px;
  color: var(--text-secondary);
  margin-top: 3px;
  line-height: 1.5;
}

.rec-arrow {
  color: var(--primary);
  cursor: pointer;
  margin-top: 4px;
}

.rec-more {
  text-align: center;
  font-size: 12px;
  color: var(--primary);
  cursor: pointer;
  padding: 8px 0 2px;
}

.exam-strip {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;
  padding-bottom: 10px;
  border-bottom: 1px dashed var(--divider);
}

.exam-pill {
  font-size: 11px;
  color: var(--text-secondary);
  background: var(--bg-primary);
  padding: 5px 10px;
  border-radius: 12px;
  cursor: pointer;
}

.exam-pill b {
  color: var(--primary);
}

.course-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cc-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.cc-name {
  font-size: 13px;
  font-weight: bold;
  color: var(--text-primary);
}

.cc-type {
  font-size: 9px;
  color: var(--primary);
  background: rgba(30, 136, 229, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
}

.cc-cn {
  font-size: 11px;
  color: var(--text-secondary);
}

.cc-mastery {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--text-hint);
}

.cc-pct {
  font-weight: bold;
}

.cc-pct.good { color: var(--success); }
.cc-pct.mid { color: var(--primary); }
.cc-pct.weak { color: var(--warning); }

.cc-weak {
  font-size: 10px;
  color: var(--warning);
  line-height: 1.5;
  min-height: 30px;
}

.cc-btn {
  margin-top: 4px;
}

@media (max-width: 1100px) {
  .rec-grid {
    grid-template-columns: 1fr;
  }
}
</style>
