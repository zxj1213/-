<template>
  <div class="card timer-card">
    <div class="head">
      <span class="title">专注时刻</span>
      <span v-if="session" class="session-badge" :class="{ running: isRunning }">
        {{ isRunning ? '专注中' : '已暂停' }}
      </span>
    </div>

    <!-- 任务绑定(A4：开始专注前必须绑定任务) -->
    <div class="bind-row">
      <span class="bind-label">绑定任务</span>
      <el-select
        v-model="boundTaskId"
        placeholder="选择要专注的任务(必选)"
        size="small"
        filterable
        style="flex: 1"
        :disabled="isRunning"
        @change="onTaskChange"
      >
        <el-option
          v-for="t in selectableTasks"
          :key="t.id"
          :label="t.title"
          :value="t.id"
        >
          <span>{{ t.title }}</span>
          <span class="opt-meta">{{ t.courseName || '未关联课程' }}</span>
        </el-option>
      </el-select>
    </div>

    <!-- 知识点 -->
    <div class="kp-row" v-if="kps.length">
      <span class="kp-label">知识点</span>
      <div class="chip-scroll">
        <span
          v-for="kp in kps"
          :key="kp.name"
          class="chip kp-chip"
          :class="{ active: kpName === kp.name }"
          @click="onKpChange(kp.name)"
        >{{ kp.name }}</span>
      </div>
    </div>

    <!-- 计时器圆环(真实时间戳计算，暂停不计时) -->
    <div class="ring-wrap">
      <svg viewBox="0 0 120 120" class="ring">
        <circle cx="60" cy="60" r="52" fill="none" stroke="var(--divider)" stroke-width="8" />
        <circle
          cx="60" cy="60" r="52" fill="none" stroke="url(#grad)" stroke-width="8"
          stroke-linecap="round"
          :stroke-dasharray="circumference"
          :stroke-dashoffset="dashOffset"
          transform="rotate(-90 60 60)"
        />
        <defs>
          <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#1E88E5" />
            <stop offset="100%" stop-color="#26A69A" />
          </linearGradient>
        </defs>
      </svg>
      <div class="ring-center">
        <div class="timer-display">{{ display }}</div>
        <div class="timer-state" :class="{ running: isRunning }">{{ stateText }}</div>
        <div v-if="boundTask" class="timer-task">{{ boundTask.title.slice(0, 14) }}{{ boundTask.title.length > 14 ? '…' : '' }}</div>
      </div>
    </div>

    <!-- 时长选择 -->
    <div class="durations">
      <button
        v-for="d in [25, 45, 60]"
        :key="d"
        type="button"
        class="chip"
        :class="{ active: targetMinutes === d }"
        :disabled="!!session"
        @click="setTarget(d)"
      >{{ d }}分钟</button>
    </div>

    <div class="custom-duration">
      <div class="duration-heading">
        <span>自定义时长</span>
        <div class="duration-input">
          <el-input-number
            v-model="durationInput"
            :min="0"
            :max="120"
            :step="1"
            :precision="0"
            :disabled="!!session"
            controls-position="right"
            size="small"
            aria-label="自定义专注时长（分钟）"
          />
          <span>分钟</span>
        </div>
      </div>
      <el-slider
        v-model="durationInput"
        :min="0"
        :max="120"
        :step="1"
        :disabled="!!session"
        :format-tooltip="formatMinutes"
        aria-label="滑动设置专注时长，0到120分钟"
      />
      <div class="duration-scale"><span>0分钟</span><span>1小时</span><span>2小时</span></div>
      <div class="duration-hint">
        {{ session ? '本次时长已锁定，结束专注后可调整' : targetMinutes > 0 ? `目标：${formatMinutes(targetMinutes)}` : '请设置大于0分钟的专注时长' }}
      </div>
    </div>

    <!-- 今日任务进度 -->
    <div class="task-progress">
      <div class="tp-head">
        <span>任务进度</span>
        <span>{{ doneCount }}/{{ totalCount }} · {{ progressPct }}%</span>
      </div>
      <el-progress :percentage="progressPct" :stroke-width="8" :show-text="false" color="#1E88E5" />
      <div class="tp-task" v-if="boundTask">
        <el-icon><Bell /></el-icon>
        <span>{{ boundTask.title }}</span>
        <span class="tp-actual" v-if="boundTask.actualMinutes">已累计 {{ formatMinutes(boundTask.actualMinutes) }}</span>
      </div>
      <div class="tp-task idle" v-else>请先在上方选择要专注的任务（从任务卡片进入会自动绑定）</div>
    </div>

    <div class="controls">
      <el-button v-if="!isRunning" type="primary" round size="large" @click="start" :disabled="!boundTaskId || targetMinutes <= 0">
        <el-icon><VideoPlay /></el-icon>&nbsp;{{ accumulated > 0 ? '继续专注' : '开始专注' }}
      </el-button>
      <el-button v-else type="warning" round size="large" @click="pause">
        <el-icon><VideoPause /></el-icon>&nbsp;暂停
      </el-button>
      <el-button round size="large" @click="finishEarly">
        <el-icon><Finished /></el-icon>&nbsp;结束
      </el-button>
    </div>

    <!-- 结束打卡弹窗：记录真实学习结果 → 喂给自适应引擎 -->
    <el-dialog v-model="showFinish" title="学习完成！记录真实结果" width="88%" align-center>
      <div class="finish-q">
        <div class="q-title">本次专注「{{ session?.taskTitle || '任务' }}」完成情况如何？</div>
        <el-radio-group v-model="finish.taskDone" class="finish-radios">
          <el-radio-button label="yes">任务已完成</el-radio-button>
          <el-radio-button label="no">还未完成</el-radio-button>
        </el-radio-group>

        <div class="q-title" style="margin-top: 14px">练习正确率（0-100%）</div>
        <el-slider v-model="finish.correctRate" :step="5" show-input size="small" />

        <div class="hint">
          💡 提交后 AI 将根据真实正确率更新「{{ session?.kp || '该课程' }}」的掌握度，并动态调整你的学习计划
        </div>
      </div>
      <template #footer>
        <el-button @click="discardFinish">放弃记录</el-button>
        <el-button type="primary" @click="submitFinish">提交结果</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '../store'
import { formatMinutes } from '../constants'
import { WEAK_THRESHOLD } from '../services/adaptive'

const store = useAppStore()

const props = defineProps({
  initialCourseId: { type: String, default: '' },
  initialTask: { type: Object, default: null }
})

const boundTaskId = ref(props.initialTask?.id || '')
const kpName = ref('')
const targetMinutes = ref(25)
const durationInput = computed({
  get: () => targetMinutes.value,
  set: (value) => setTarget(value)
})
const accumulated = ref(0) // 已专注秒数(不含暂停段)
const showFinish = ref(false)
const finish = ref({ taskDone: 'yes', correctRate: 80 })
let interval = null
let pendingSwitchTaskId = null // 切换任务待确认的目标

const courses = computed(() => store.courses)
const session = computed(() => store.activeSession)
const isRunning = computed(() => session.value?.status === 'running')

const boundTask = computed(() => store.tasks.find(t => t.id === boundTaskId.value) || null)
const courseId = computed(() => {
  if (session.value?.courseId) return session.value.courseId
  const t = boundTask.value
  if (t?.courseName) {
    const c = store.courses.find(x => x.name === t.courseName)
    if (c) return c.id
  }
  return props.initialCourseId || store.courses[0]?.id || ''
})
const currentCourse = computed(() => store.courses.find(c => c.id === courseId.value))
const kps = computed(() => Object.keys(store.kpMastery[courseId.value] || {}))
const selectableTasks = computed(() =>
  store.tasks.filter(t => t.status !== '已完成').sort((a, b) => {
    const p = { 紧急: 0, 高: 1, 中: 2, 低: 3 }
    return (p[a.priority] ?? 2) - (p[b.priority] ?? 2)
  })
)

const totalCount = computed(() => store.todayTasks.length)
const doneCount = computed(() => store.tasks.filter(t => t.status === '已完成').length)
const progressPct = computed(() =>
  totalCount.value ? Math.round((doneCount.value / totalCount.value) * 100) : 0
)

const circumference = 2 * Math.PI * 52
const progress = computed(() => targetMinutes.value > 0
  ? Math.min(accumulated.value / (targetMinutes.value * 60), 1)
  : 0)
const dashOffset = computed(() => circumference * (1 - progress.value))

const display = computed(() => {
  const h = Math.floor(accumulated.value / 3600)
  const m = Math.floor(accumulated.value / 60) % 60
  const s = accumulated.value % 60
  return [h, m, s].map(n => String(n).padStart(2, '0')).join(':')
})

const stateText = computed(() => {
  if (isRunning.value) return '专注中...'
  if (accumulated.value > 0) return '已暂停'
  return '准备开始'
})

// ---------- 真实时间戳计时(A4/C3)：基于 Date.now 计算，暂停段不计入 ----------
function syncElapsed() {
  if (!session.value || session.value.status !== 'running') return
  const elapsed = Math.max(0, Math.floor((Date.now() - session.value.lastTick) / 1000))
  accumulated.value = Math.min(
    session.value.accumulatedSeconds + elapsed,
    targetMinutes.value * 60
  )
}

function tick() {
  if (!isRunning.value) return
  syncElapsed()
  if (accumulated.value >= targetMinutes.value * 60) {
    openFinish()
  }
}

function start() {
  if (isRunning.value) return
  if (targetMinutes.value <= 0) {
    ElMessage.warning('请设置大于0分钟的专注时长')
    return
  }
  if (!boundTaskId.value) {
    ElMessage.warning('请先选择要专注的任务')
    return
  }
  // 存在会话但任务不一致：先结算旧会话(真实时长保留)，再开新会话
  if (session.value && session.value.taskId !== boundTaskId.value) {
    const minutes = store.endSession({ completed: false, correctRate: null })
    if (minutes) ElMessage.info(`已结算上一任务「${session.value?.taskTitle?.slice(0, 10)}」${minutes} 分钟`)
    accumulated.value = 0
  }
  if (!session.value) {
    const t = boundTask.value
    const c = currentCourse.value
    store.startSession({
      taskId: t.id,
      taskTitle: t.title,
      courseId: c?.id || '',
      courseName: c?.name || t.courseName || '',
      kp: kpName.value,
      targetMinutes: targetMinutes.value
    })
    accumulated.value = 0
  } else {
    store.resumeSession()
  }
  tick()
  if (isRunning.value) {
    clearInterval(interval)
    interval = setInterval(tick, 1000)
  }
}

function pause() {
  if (!session.value) return
  syncElapsed() // 只结算时间，避免到点时与 openFinish 相互调用
  store.pauseSession(accumulated.value)
  clearInterval(interval)
  interval = null
}

function setTarget(min) {
  if (isRunning.value || session.value) return
  if (typeof min !== 'number' || !Number.isFinite(min)) return
  targetMinutes.value = Math.min(120, Math.max(0, Math.round(min)))
  accumulated.value = 0
}

function openFinish() {
  pause()
  showFinish.value = true
}

/** 手动提前结束：先结算再打开打卡弹窗 */
function finishEarly() {
  if (accumulated.value <= 0 && !session.value) {
    ElMessage.info('还没有开始专注')
    return
  }
  openFinish()
}

function submitFinish() {
  showFinish.value = false
  const minutes = store.endSession({
    completed: finish.value.taskDone === 'yes',
    correctRate: finish.value.correctRate
  })
  if (minutes == null) return

  const cid = courseId.value
  const kp = kpName.value
  const mastery = cid && kp ? store.kpMastery[cid]?.[kp]?.mastery : null
  const msg = mastery == null
    ? `已记录 ${minutes} 分钟专注，任务用时已归属「${boundTask.value?.title?.slice(0, 12)}」`
    : mastery < WEAK_THRESHOLD
      ? `「${kp}」掌握度 ${mastery}%，低于阈值，建议进行针对性练习`
      : `「${kp}」掌握度更新为 ${mastery}%，继续加油！`
  ElMessage.success(msg)
  resetLocal()
}

function discardFinish() {
  showFinish.value = false
  // 未提交结果也保留专注时长(真实数据不丢失)，但不更新掌握度
  if (session.value) {
    const minutes = store.endSession({ completed: false, correctRate: null })
    if (minutes) ElMessage.info(`已保留 ${minutes} 分钟专注记录`)
  }
  resetLocal()
}

function resetLocal() {
  accumulated.value = 0
  clearInterval(interval)
  interval = null
}

/** 切换任务：运行中需确认(C4 场景) */
function onTaskChange(newId) {
  if (!isRunning.value || !session.value) {
    boundTaskId.value = newId
    syncKpForTask()
    return
  }
  pendingSwitchTaskId = newId
  ElMessageBox({
    title: '切换专注任务',
    message: '当前有一个进行中的专注会话，切换任务会如何处理？',
    showCancelButton: true,
    confirmButtonText: '结束并切换',
    cancelButtonText: '取消',
    distinguishCancelAndClose: true,
    type: 'warning'
  }).then(() => {
    // 结束并切换：结算当前会话(计入真实时长)
    pause()
    store.endSession({ completed: false, correctRate: null })
    boundTaskId.value = pendingSwitchTaskId
    pendingSwitchTaskId = null
    resetLocal()
    syncKpForTask()
    ElMessage.success('已结束当前会话并切换任务')
  }).catch((action) => {
    // 取消：还原选择
    boundTaskId.value = session.value?.taskId || ''
    pendingSwitchTaskId = null
  })
}

function onKpChange(name) {
  if (isRunning.value && session.value && session.value.kp !== name) {
    ElMessage.warning('专注进行中不能切换知识点，请先暂停或结束')
    return
  }
  kpName.value = name
  if (session.value) {
    session.value.kp = name
    store.save()
  }
}

function syncKpForTask() {
  if (kps.value.length && !kps.value.includes(kpName.value)) {
    kpName.value = kps.value[0] || ''
  }
}

/** 供首页课程卡片调用：设定课程并绑定任务 */
function setCourseAndTask(cid, task) {
  if (isRunning.value) {
    ElMessage.warning('专注进行中，请先结束当前会话')
    return
  }
  boundTaskId.value = task?.id || ''
  if (!kps.value.includes(kpName.value)) kpName.value = kps.value[0] || ''
}

// ---------- 初始化：刷新后从持久化会话恢复(A4 验收) ----------
onMounted(() => {
  const s = store.activeSession
  if (s) {
    boundTaskId.value = s.taskId || ''
    targetMinutes.value = s.targetMinutes || 25
    kpName.value = s.kp || ''
    accumulated.value = s.accumulatedSeconds || 0
    if (s.status === 'running') {
      // 后台漂移修正：按真实时间戳补算
      tick()
      if (isRunning.value) {
        interval = setInterval(tick, 1000)
        ElMessage.info(`已恢复「${s.taskTitle?.slice(0, 12)}」的专注会话`)
      }
    }
  } else if (props.initialTask) {
    boundTaskId.value = props.initialTask.id
  }
  syncKpForTask()
})

watch(() => props.initialTask, (t) => {
  if (t && !isRunning.value) {
    boundTaskId.value = t.id
    syncKpForTask()
  }
})

onUnmounted(() => {
  // 组件卸载时结算一次，保证切换页面不丢秒数
  syncElapsed()
  if (session.value) store.updateSessionSeconds(accumulated.value)
  clearInterval(interval)
})

defineExpose({ setCourseAndTask })
</script>

<style scoped>
.timer-card {
  text-align: center;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.title {
  font-size: calc(0.9375rem * var(--font-scale));
  font-weight: bold;
  color: var(--text-primary);
  line-height: 26.4px;
}

.session-badge {
  font-size: calc(0.625rem * var(--font-scale));
  padding: 3px 8px;
  border-radius: 10px;
  background: #FF980015;
  color: #FF9800;
  line-height: 17.6px;
}

.session-badge.running {
  background: #4CAF5015;
  color: #4CAF50;
}

.bind-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  text-align: left;
}

.bind-label {
  font-size: calc(0.75rem * var(--font-scale));
  color: var(--text-secondary);
  white-space: nowrap;
  line-height: 21.12px;
}

.opt-meta {
  float: right;
  font-size: calc(0.6875rem * var(--font-scale));
  color: var(--text-hint);
  line-height: 19.36px;
}

.kp-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}

.kp-label {
  font-size: calc(0.75rem * var(--font-scale));
  color: var(--text-secondary);
  white-space: nowrap;
  line-height: 21.12px;
}

.kp-chip {
  padding: 4px 10px;
  font-size: calc(0.6875rem * var(--font-scale));
  line-height: 19.36px;
}

.ring-wrap {
  position: relative;
  width: 160px;
  height: 160px;
  margin: 24px auto;
}

.ring {
  width: 100%;
  height: 100%;
}

.ring-center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
}

.timer-state {
  font-size: calc(0.6875rem * var(--font-scale));
  color: var(--text-hint);
  line-height: 19.36px;
}

.timer-state.running {
  color: var(--secondary);
}

.timer-task {
  font-size: calc(0.625rem * var(--font-scale));
  color: var(--text-hint);
  max-width: 130px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 17.6px;
}

.durations {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin: 8px 0 14px;
}

.durations button {
  font-family: inherit;
}

.durations button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.custom-duration {
  margin-bottom: 16px;
  padding: 12px 16px;
  border: 1px solid var(--divider);
  border-radius: 10px;
  text-align: left;
}

.duration-heading,
.duration-input,
.duration-scale {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.duration-heading {
  font-size: calc(0.75rem * var(--font-scale));
  color: var(--text-primary);
  flex-wrap: wrap;
  line-height: 21.12px;
}

.duration-input :deep(.el-input-number) {
  width: 110px;
}

.duration-scale,
.duration-hint {
  font-size: calc(0.6875rem * var(--font-scale));
  color: var(--text-secondary);
  line-height: 19.36px;
}

.duration-hint {
  margin-top: 8px;
}

.task-progress {
  text-align: left;
  background: var(--bg-primary);
  border-radius: 10px;
  padding: 12px;
}

.tp-head {
  display: flex;
  justify-content: space-between;
  font-size: calc(0.75rem * var(--font-scale));
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 14px;
  line-height: 21.12px;
}

.tp-task {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  font-size: calc(0.75rem * var(--font-scale));
  color: var(--text-primary);
  flex-wrap: wrap;
  line-height: 21.12px;
}

.tp-actual {
  font-size: calc(0.625rem * var(--font-scale));
  color: var(--secondary);
  line-height: 17.6px;
}

.tp-task.idle {
  color: var(--text-hint);
}

.controls {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-top: 14px;
}

.finish-q {
  padding: 4px;
}

.q-title {
  font-size: calc(0.8125rem * var(--font-scale));
  color: var(--text-primary);
  font-weight: 600;
  margin-bottom: 14px;
  line-height: 22.88px;
}

.finish-radios {
  display: flex;
  width: 100%;
}

.finish-radios :deep(.el-radio-button) {
  flex: 1;
}

.finish-radios :deep(.el-radio-button__inner) {
  width: 100%;
}

.hint {
  margin-top: 12px;
  font-size: calc(0.6875rem * var(--font-scale));
  color: var(--secondary);
  background: rgba(38, 166, 154, 0.08);
  border-radius: 6px;
  padding: 8px;
  line-height: 19.36px;
}
</style>
