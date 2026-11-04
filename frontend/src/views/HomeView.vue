<template>
  <div class="home-page">
    <!-- Hello 横幅：今日必做 + 主按钮(A1：新用户5秒识别首要任务) -->
    <div class="hero fade-up">
      <div class="hero-left">
        <div class="hello">Hello，{{ store.userInfo?.name || '同学' }} 👋</div>
        <div class="sub">{{ formatDateCN(today) }}</div>
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
          <span class="t">AI 学习建议</span>
          <span class="more" @click="$router.push('/exam')">查看学习计划 ›</span>
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
    <section class="home-section">
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

    </section>

    <!-- 课程掌握度(图1: Machine Learning / Data Structures) -->
    <section class="home-section">
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

    </section>

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
.home-page { display: flex; flex-direction: column; gap: var(--section-gap); }
.home-section { min-width: 0; }
.hero {
  background: var(--hero-bg);
  border: 1px solid var(--divider);
  border-radius: 16px;
  padding: 32px;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 0;
  flex-wrap: wrap;
}

.hero-left {
  flex: 1;
  min-width: 0;
  flex-basis: 480px;
}

.hello {
  font-size: calc(1.625rem * var(--font-scale));
  font-weight: bold;
  line-height: 45.76px;
}

.sub {
  font-size: calc(0.8125rem * var(--font-scale));
  opacity: 0.9;
  margin-top: 4px;
  line-height: 22.88px;
}

.must-do {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 14px;
  background: var(--bg-card);
  border: 1px solid var(--divider);
  border-radius: 10px;
  padding: 10px 14px;
  flex-wrap: wrap;
}

.must-label {
  font-size: calc(0.75rem * var(--font-scale));
  font-weight: bold;
  background: var(--accent-soft);
  color: var(--primary);
  padding: 3px 8px;
  border-radius: 6px;
  white-space: nowrap;
  line-height: 21.12px;
}

.must-title {
  font-size: calc(0.875rem * var(--font-scale));
  font-weight: 600;
  line-height: 24.64px;
}

.must-deadline {
  font-size: calc(0.6875rem * var(--font-scale));
  opacity: 0.85;
  line-height: 19.36px;
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
  background: var(--bg-card) !important;
  border-color: var(--divider) !important;
  color: var(--text-secondary) !important;
}

.hero-stats {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
}

.hs-item {
  background: var(--bg-card);
  border: 1px solid var(--divider);
  border-radius: 12px;
  padding: 12px 18px;
  text-align: center;
  cursor: pointer;
  transition: background 0.2s;
  min-width: 88px;
}

.hs-item:hover {
  background: var(--accent-soft);
}

.hs-v {
  font-size: calc(1.375rem * var(--font-scale));
  font-weight: bold;
  line-height: 38.72px;
}

.hs-k {
  font-size: calc(0.6875rem * var(--font-scale));
  opacity: 0.9;
  margin-top: 3px;
  white-space: nowrap;
  line-height: 19.36px;
}

.rec-card {
  display: flex;
  flex-direction: column;
}

.rec-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.rec-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 18px;
  background: var(--bg-primary);
  border: 1px solid var(--divider);
  border-radius: 12px;
}

.rec-icon {
  font-size: calc(1.25rem * var(--font-scale));
  line-height: 35.2px;
}

.rec-body {
  flex: 1;
  min-width: 0;
}

.rec-title {
  font-size: calc(0.8125rem * var(--font-scale));
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  line-height: 22.88px;
}

.rec-desc {
  font-size: calc(0.75rem * var(--font-scale));
  color: var(--text-secondary);
  margin-top: 8px;
  line-height: 23.76px;
}

.rec-arrow {
  color: var(--primary);
  cursor: pointer;
  margin-top: 4px;
}

.rec-more {
  text-align: center;
  font-size: calc(0.75rem * var(--font-scale));
  color: var(--primary);
  cursor: pointer;
  padding: 8px 0 2px;
  line-height: 21.12px;
}

.exam-strip {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 20px;
  padding-bottom: 20px;
  border-bottom: 1px dashed var(--divider);
}

.exam-pill {
  font-size: calc(0.6875rem * var(--font-scale));
  color: var(--text-secondary);
  background: var(--bg-primary);
  padding: 5px 10px;
  border-radius: 12px;
  cursor: pointer;
  line-height: 19.36px;
}

.exam-pill b {
  color: var(--primary);
}

.course-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cc-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.cc-name {
  font-size: calc(0.8125rem * var(--font-scale));
  font-weight: bold;
  color: var(--text-primary);
  line-height: 22.88px;
}

.cc-type {
  font-size: calc(0.5625rem * var(--font-scale));
  color: var(--primary);
  background: rgba(30, 136, 229, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  line-height: 15.84px;
}

.cc-cn {
  font-size: calc(0.6875rem * var(--font-scale));
  color: var(--text-secondary);
  line-height: 19.36px;
}

.cc-mastery {
  display: flex;
  justify-content: space-between;
  font-size: calc(0.625rem * var(--font-scale));
  color: var(--text-hint);
  line-height: 17.6px;
}

.cc-pct {
  font-weight: bold;
}

.cc-pct.good { color: var(--success); }
.cc-pct.mid { color: var(--primary); }
.cc-pct.weak { color: var(--warning); }

.cc-weak {
  font-size: calc(0.625rem * var(--font-scale));
  color: var(--warning);
  line-height: 16.5px;
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
.hero-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); width: 100%; gap: 16px; }
.hs-item { text-align: left; padding: 18px 22px; min-width: 0; }
.hs-v { font-size: calc(1.75rem * var(--font-scale)); color: var(--primary); font-variant-numeric: tabular-nums; line-height: 49.28px; }
.hs-k { color: var(--text-secondary); font-size: calc(0.75rem * var(--font-scale)); line-height: 21.12px; }
.rec-more { padding-top: 18px; }
@media (max-width: 600px) {
  .hero { padding: 24px 20px; gap: 22px; }
  .hello { font-size: calc(1.4375rem * var(--font-scale)); line-height: 40.48px; }
  .hero-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .hs-item { padding: 16px; }
  .hero-actions { gap: 10px; }
  .hero-actions .el-button { font-size: calc(0.75rem * var(--font-scale)); padding: 10px 14px; line-height: 21.12px; }
  .rec-grid { grid-template-columns: 1fr; }
}
</style>
