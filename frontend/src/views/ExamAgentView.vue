<template>
  <div class="page">
    <template v-if="store.exams.length">
      <!-- 考试选择 -->
      <div class="chip-scroll exam-selector">
        <div
          v-for="(exam, i) in store.exams"
          :key="exam.id"
          class="exam-chip"
          :class="{ active: selectedIndex === i }"
          @click="selectExam(i)"
        >
          <div class="ec-name">{{ exam.name }}</div>
          <div class="ec-count">{{ countdown(exam.date) }} · 每日{{ exam.dailyMinutes }}分钟</div>
        </div>
      </div>

      <!-- 工具栏：设置 / 测验 / 打卡 / 重排 -->
      <div class="card checkin-bar">
        <div class="cb-left">
          <span class="cb-icon">✨</span>
          <div>
            <div class="cb-title">自适应备考引擎</div>
            <div class="cb-sub">设置约束 → 生成计划 → 测验记录真实结果 → 计划动态调整</div>
          </div>
        </div>
        <div class="cb-actions">
          <el-button round plain @click="openExamSetup">⚙️ 考试设置</el-button>
          <el-button round plain type="info" @click="openQuiz">📝 知识点测验</el-button>
          <el-button type="success" round @click="openCheckIn">✅ 今日打卡</el-button>
          <el-button round plain type="primary" @click="onReplan">🔄 重新规划</el-button>
        </div>
      </div>

      <!-- 计划调整对比(B1：调整前后差异 + 确认/回退) -->
      <div v-if="planAdjust && !planAdjust.confirmed" class="card adjust-diff fade-up">
        <div class="ad-head">
          <span class="ad-title">🔀 AI 计划调整对比</span>
          <span class="ad-time">调整于 {{ planAdjust.at }}</span>
        </div>
        <div v-if="planChanges.length" class="ad-changes">
          <div v-for="c in planChanges" :key="c.date + c.reason" class="ad-change">
            <div class="ad-day">Day{{ c.day }} {{ c.date.slice(5) }}</div>
            <div class="ad-from">原：{{ c.from }}</div>
            <div class="ad-to">新：{{ c.to }}</div>
            <div class="ad-reason" v-if="c.reason">↳ {{ c.reason }}</div>
          </div>
        </div>
        <pre class="ad-explain">{{ planAdjust.explanation }}</pre>
        <div class="ad-actions">
          <span class="ad-hint">💡 你可以确认调整，或恢复原计划（AI 不会悄悄覆盖你的安排）</span>
          <div>
            <el-button size="small" round @click="rollbackAdjust">↩ 恢复原计划</el-button>
            <el-button size="small" round type="primary" @click="confirmAdjust">✓ 确认调整</el-button>
          </div>
        </div>
      </div>

      <div class="grid-side-main">
        <!-- 左列：概览 + 成绩预估 + 进度 -->
        <div class="left-col">
          <div class="card fade-up">
            <div class="ov-top">
              <div>
                <div class="ov-name">{{ exam.name }}</div>
                <div class="ov-meta">📅 {{ exam.date }} · ⏰ {{ exam.duration }}分钟 · 📍 {{ exam.location }}</div>
                <div class="ov-meta">⏳ 每日可学习 {{ exam.dailyMinutes }} 分钟 · 🎯 目标 {{ exam.targetScore }} 分</div>
              </div>
              <div class="ov-count">
                <div class="ov-k">倒计时</div>
                <div class="ov-v">{{ daysLeft }}天</div>
              </div>
            </div>
            <div class="ov-bottom">
              <span class="ov-mats">📄 已上传{{ exam.materials.length }}份资料</span>
              <el-button size="small" round plain type="primary" @click="showUpload = true">
                <el-icon><Plus /></el-icon>&nbsp;上传资料
              </el-button>
            </div>
          </div>

          <!-- 成绩预估 -->
          <div v-if="estimate" class="card fade-up">
            <div class="card-title">
              <span class="t">成绩预估</span>
              <span class="more">更新于 {{ estimate.estimatedDate }}</span>
            </div>
            <div class="score-row">
              <div class="score-box">
                <div class="sb-k">当前预估</div>
                <div class="sb-v primary">{{ estimate.currentMinScore }}-{{ estimate.currentMaxScore }}</div>
                <div class="sb-u">分</div>
              </div>
              <div class="score-arrow">→</div>
              <div class="score-box">
                <div class="sb-k">目标分数</div>
                <div class="sb-v success">{{ estimate.targetScore }}</div>
                <div class="sb-u">分</div>
              </div>
            </div>
            <div class="areas">
              <div class="area-col">
                <div class="area-label strong">💪 强项</div>
                <div v-for="a in estimate.strongAreas" :key="a" class="area-item">• {{ a }}</div>
              </div>
              <div class="area-col">
                <div class="area-label weak">⚠️ 弱项</div>
                <div v-for="a in estimate.weakAreas" :key="a" class="area-item">• {{ a }}</div>
              </div>
            </div>
            <div class="trend">📈 {{ estimate.trendDescription }}</div>
          </div>

          <!-- 学习进度 -->
          <div v-if="progress" class="card fade-up">
            <div class="card-title">
              <span class="t">学习进度</span>
              <span class="more" style="color: var(--primary)">{{ progress.overallCompletion }}%</span>
            </div>
            <el-progress :percentage="progress.overallCompletion" :stroke-width="8" color="#1E88E5" />
            <div class="prog-stats">
              <div class="prog-stat">
                <div class="ps-k">章节</div>
                <div class="ps-v">{{ progress.chaptersCompleted }} / {{ progress.totalChapters }}</div>
              </div>
              <div class="prog-stat">
                <div class="ps-k">刷题</div>
                <div class="ps-v">{{ progress.practiceTasksCompleted }} / {{ progress.totalPracticeTasks }}</div>
              </div>
              <div class="prog-stat">
                <div class="ps-k">正确率</div>
                <div class="ps-v">{{ progress.averageCorrectRate }}%</div>
              </div>
              <div class="prog-stat">
                <div class="ps-k">剩余天数</div>
                <div class="ps-v">{{ progress.daysLeft }}天</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 右列：学习计划 -->
        <div class="right-col">
          <div class="plan-head">
            <span class="ph-title">学习计划（🔒 锁定后重新规划不覆盖）</span>
            <div class="chip-scroll" style="gap: 4px">
              <span
                v-for="p in phases"
                :key="p.label"
                class="chip phase-chip"
                :class="{ active: currentPhase === p.label }"
                @click="currentPhase = p.label"
              >{{ p.label }}</span>
            </div>
          </div>
          <ExamPlanCard
            v-for="plan in filteredPlans"
            :key="plan.id"
            :plan="plan"
            :is-today="plan.date === today"
            @toggle-lock="(pid) => store.togglePlanLock(exam.id, pid)"
          />
          <div v-if="!filteredPlans.length" class="empty-state card">
            <span class="icon">📆</span>
            <span>当前阶段无计划</span>
          </div>
        </div>
      </div>
    </template>

    <!-- ============ 考试设置弹窗(B5：现实约束) ============ -->
    <el-dialog v-model="showSetup" title="考试设置" width="88%" align-center>
      <div class="setup-body">
        <div class="su-row">
          <span class="su-label">考试日期</span>
          <el-date-picker
            v-model="setupForm.date"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="选择日期"
            style="flex: 1"
          />
        </div>
        <div class="su-row">
          <span class="su-label">每日可学习</span>
          <el-input-number v-model="setupForm.dailyMinutes" :min="15" :max="600" :step="15" />
          <span class="su-unit">分钟</span>
        </div>
        <div class="su-row">
          <span class="su-label">目标分数</span>
          <el-input-number v-model="setupForm.targetScore" :min="60" :max="100" />
        </div>
        <div class="su-hint">
          💡 排程算法优先满足硬约束：每日总时长不超过预算，超出的内容自动拆减并顺延，锁定任务不会被覆盖
        </div>
      </div>
      <template #footer>
        <el-button @click="showSetup = false">取消</el-button>
        <el-button type="primary" @click="saveSetup">保存并重新规划</el-button>
      </template>
    </el-dialog>

    <!-- ============ 知识点测验弹窗(B4：题→知识点→掌握度) ============ -->
    <el-dialog v-model="showQuiz" title="知识点测验" width="88%" align-center>
      <div v-if="!quizSubmitted" class="quiz-body">
        <div class="quiz-info">
          共 {{ quizQuestions.length }} 题 · 每题关联知识点，作答结果将真实更新掌握度并驱动计划调整
        </div>
        <div v-for="(q, qi) in quizQuestions" :key="q.id" class="quiz-q">
          <div class="qq-head">
            <span class="qq-num">Q{{ qi + 1 }}</span>
            <span class="qq-kp">知识点：{{ q.kp }}</span>
            <span class="qq-diff">难度 {{ '★'.repeat(q.difficulty) }}</span>
          </div>
          <div class="qq-text">{{ q.question }}</div>
          <el-radio-group v-model="quizAnswers[q.id]" class="qq-options">
            <el-radio v-for="(opt, oi) in q.options" :key="oi" :label="oi" border class="qq-option">
              {{ String.fromCharCode(65 + oi) }}. {{ opt }}
            </el-radio>
          </el-radio-group>
        </div>
      </div>

      <div v-else class="quiz-result">
        <div class="qr-title">测验结果 · 掌握度已更新</div>
        <div v-for="(s, kp) in quizStats" :key="kp" class="qr-row">
          <span class="qr-kp">{{ kp }}</span>
          <span class="qr-correct">{{ s.correct }}/{{ s.total }} 题正确</span>
          <span class="qr-mastery" :class="{ weak: s.mastery != null && s.mastery < 60 }">
            掌握度 {{ s.mastery == null ? '待评估' : s.mastery + '%' }}
          </span>
        </div>
        <div v-if="quizWeakKps.length" class="qr-weak">
          ⚠️ {{ quizWeakKps.join('、') }} 表现较弱，重新规划后系统将自动插入针对性练习
        </div>
        <div v-else class="qr-weak good">全部答对，可以放心推进新章节 🎉</div>
        <div class="qr-explain" v-for="q in quizQuestions" :key="'e' + q.id">
          <b>Q{{ quizQuestions.indexOf(q) + 1 }} 解析：</b>{{ q.explanation }}
        </div>
      </div>

      <template #footer>
        <el-button v-if="!quizSubmitted" :disabled="quizQuestions.some(q => quizAnswers[q.id] == null)" type="primary" @click="submitQuizAnswers">提交测验</el-button>
        <template v-else>
          <el-button @click="showQuiz = false">关闭</el-button>
          <el-button type="primary" @click="replanAfterQuiz">重新规划计划</el-button>
        </template>
      </template>
    </el-dialog>

    <!-- ============ 打卡弹窗 ============ -->
    <el-dialog v-model="showCheckIn" title="每日打卡 · 记录真实学习结果" width="88%" align-center>
      <div class="checkin-body">
        <div class="ci-q">今天完成了哪些计划内容？</div>
        <el-radio-group v-model="checkIn.completed">
          <el-radio-button label="full">全部完成</el-radio-button>
          <el-radio-button label="part">部分完成</el-radio-button>
          <el-radio-button label="none">未开始</el-radio-button>
        </el-radio-group>

        <div class="ci-q">实际用时（小时）</div>
        <el-slider v-model="checkIn.actualHours" :min="0" :max="6" :step="0.5" show-input size="small" />

        <div class="ci-q">各知识点练习正确率（真实学习结果）</div>
        <div v-for="kp in examKps" :key="kp.name" class="kp-rate">
          <div class="kr-head">
            <span class="kr-name">{{ kp.name }}</span>
            <span class="kr-mastery" :class="{ weak: isWeakKp(kp.mastery) }">{{ masteryText(kp) }}</span>
          </div>
          <el-slider
            v-model="checkIn.rates[kp.name]"
            :min="0" :max="100" :step="5"
            size="small" :show-tooltip="false"
          />
        </div>

        <div class="ci-hint">
          💡 提交后 AI 将根据真实正确率更新掌握度，并自动重排剩余计划——掌握度低于 60% 的知识点会触发针对性练习，自动减少新知识学习
        </div>
      </div>
      <template #footer>
        <el-button @click="showCheckIn = false">稍后再说</el-button>
        <el-button type="primary" @click="submitCheckIn">提交打卡</el-button>
      </template>
    </el-dialog>

    <!-- ============ 上传备考资料 ============ -->
    <el-dialog v-model="showUpload" title="上传备考资料" width="88%" align-center>
      <div class="dialog-hint">支持 PPT / 教材 / 往年题 / 重点笔记等，AI 将按章节解析覆盖范围</div>
      <div class="upload-zone" @click="pickUpload">
        <input ref="uploadFile" type="file" multiple hidden @change="onUploadFile" />
        <span style="font-size: 32px">📄</span>
        <span style="font-size: 12px; color: var(--text-hint)">点击选择文件（可多选，单文件 ≤ 10MB）</span>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { useAppStore } from '../store'
import { todayStr, daysBetween, countdown, addDays, formatMinutes } from '../constants'
import { listKps, WEAK_THRESHOLD, describePlanDay } from '../services/adaptive'
import { getMockQuiz } from '../mock/data'
import ExamPlanCard from '../components/ExamPlanCard.vue'

const store = useAppStore()
const today = todayStr()

const selectedIndex = ref(0)
const currentPhase = ref('全部')
const showCheckIn = ref(false)
const showUpload = ref(false)
const showSetup = ref(false)
const showQuiz = ref(false)
const uploadFile = ref(null)

const setupForm = ref({ date: '', dailyMinutes: 90, targetScore: 88 })

const phases = [
  { label: '全部' },
  { label: '逐章学习', phase: 'chapter' },
  { label: '集中刷题', phase: 'practice' },
  { label: '冲刺复习', phase: 'sprint' }
]

const checkIn = ref({
  completed: 'part',
  actualHours: 2,
  rates: {}
})

// 测验状态
const quizQuestions = ref([])
const quizAnswers = ref({})
const quizStats = ref({})
const quizSubmitted = ref(false)

const exam = computed(() => store.exams[selectedIndex.value] || null)
const estimate = computed(() => (exam.value ? store.scoreEstimates[exam.value.id] : null))
const progress = computed(() => (exam.value ? store.studyProgress[exam.value.id] : null))
const plans = computed(() => (exam.value ? store.studyPlans[exam.value.id] || [] : []))

const daysLeft = computed(() =>
  exam.value ? Math.max(daysBetween(today, exam.value.date.slice(0, 10)), 0) : 0
)

const examKps = computed(() =>
  exam.value?.courseId ? listKps(store.kpMastery[exam.value.courseId]) : []
)

const filteredPlans = computed(() => {
  if (currentPhase.value === '全部') return plans.value
  const phase = phases.find(p => p.label === currentPhase.value)?.phase
  return plans.value.filter(p => p.phase === phase)
})

/** 计划调整历史(未确认时展示对比) */
const planAdjust = computed(() => (exam.value ? store.planHistory[exam.value.id] : null))

const planChanges = computed(() => {
  const h = planAdjust.value
  if (!h || !h.prev || !h.next) return []
  const changes = []
  for (let i = 0; i < Math.min(h.prev.length, h.next.length); i++) {
    const p = h.prev[i]
    const n = h.next[i]
    if (!p || p.locked) continue
    const pd = describePlanDay(p)
    const nd = describePlanDay(n)
    if (pd !== nd) {
      changes.push({
        date: n.date,
        day: i + 1,
        from: pd,
        to: nd,
        reason: i === 0 && n.chapters?.some(c => c.targeted)
          ? '薄弱知识点触发针对性练习，新知识学习自动让位'
          : '按最新掌握度重新排程'
      })
    }
  }
  return changes
})

const quizWeakKps = computed(() =>
  Object.entries(quizStats.value)
    .filter(([, s]) => s.mastery != null && s.mastery < WEAK_THRESHOLD)
    .map(([kp]) => kp)
)

function isWeakKp(mastery) {
  return mastery != null && mastery < WEAK_THRESHOLD
}

function masteryText(kp) {
  return kp.mastery == null ? '待评估' : `掌握度 ${kp.mastery}%`
}

function pickUpload() {
  uploadFile.value?.click()
}

function selectExam(i) {
  selectedIndex.value = i
}

// ---------- 考试设置(B5) ----------
function openExamSetup() {
  if (!exam.value) return
  setupForm.value = {
    date: exam.value.date.slice(0, 10),
    dailyMinutes: exam.value.dailyMinutes || 90,
    targetScore: exam.value.targetScore
  }
  showSetup.value = true
}

function saveSetup() {
  if (!exam.value) return
  if (!setupForm.value.date) {
    ElMessage.warning('请选择考试日期')
    return
  }
  store.updateExam(exam.value.id, {
    date: `${setupForm.value.date} 09:00`,
    dailyMinutes: setupForm.value.dailyMinutes,
    targetScore: setupForm.value.targetScore
  })
  showSetup.value = false
  onReplan()
  ElMessage.success('考试设置已保存，计划已按新约束重新生成')
}

// ---------- 知识点测验(B4) ----------
function openQuiz() {
  if (!exam.value?.courseId) {
    ElMessage.warning('该考试未关联课程，无法生成测验')
    return
  }
  const bank = getMockQuiz(exam.value.courseId)
  if (!bank.length) {
    ElMessage.warning('该课程暂无内置测验题库')
    return
  }
  quizQuestions.value = bank
  quizAnswers.value = {}
  quizStats.value = {}
  quizSubmitted.value = false
  showQuiz.value = true
}

function submitQuizAnswers() {
  const answers = quizQuestions.value
    .filter(q => quizAnswers.value[q.id] != null)
    .map(q => ({ kp: q.kp, correct: quizAnswers.value[q.id] === q.answer }))
  if (answers.length !== quizQuestions.value.length) {
    ElMessage.warning('请完成所有题目')
    return
  }
  quizStats.value = store.submitQuiz(exam.value.courseId, answers)
  quizSubmitted.value = true
  ElMessage.success('测验已提交，知识点掌握度已更新')
}

function replanAfterQuiz() {
  showQuiz.value = false
  onReplan()
}

// ---------- 打卡 ----------
function openCheckIn() {
  if (!exam.value) return
  checkIn.value = { completed: 'part', actualHours: 2, rates: {} }
  for (const kp of examKps.value) {
    checkIn.value.rates[kp.name] = kp.mastery == null ? 50 : Math.min(100, kp.mastery + 5)
  }
  showCheckIn.value = true
}

function submitCheckIn() {
  if (!exam.value) return
  const results = examKps.value.map(kp => {
    const rate = checkIn.value.rates[kp.name] ?? 50
    return { kp: kp.name, correct: Math.round(rate / 5), total: 20, minutes: 30 }
  })
  const result = store.checkInExamDay(exam.value.id, {
    completed: checkIn.value.completed === 'full',
    results,
    actualHours: checkIn.value.actualHours
  })
  showCheckIn.value = false
  ElMessage.success('AI 已根据真实学习结果重排计划，请查看调整对比')
}

function onReplan() {
  if (!exam.value) return
  store.replanExam(exam.value.id)
  ElMessage.success('AI 已根据最新进度重新排列学习计划')
}

function confirmAdjust() {
  if (!exam.value) return
  store.confirmPlanAdjust(exam.value.id)
  ElMessage.success('已确认调整，计划生效')
}

function rollbackAdjust() {
  if (!exam.value) return
  store.rollbackPlan(exam.value.id)
  ElMessage.success('已恢复原计划')
}

// ---------- 上传资料 ----------
function onUploadFile(e) {
  const files = Array.from(e.target.files || [])
  if (!files.length || !exam.value) return
  const MAX = 10 * 1024 * 1024
  for (const f of files) {
    if (f.size > MAX) {
      ElMessage.warning(`「${f.name}」超过 10MB 限制，已跳过`)
      continue
    }
    const lower = f.name.toLowerCase()
    let type = '其他'
    if (lower.endsWith('.ppt') || lower.endsWith('.pptx')) type = 'PPT'
    else if (lower.endsWith('.pdf')) type = '教材'
    else if (lower.endsWith('.doc') || lower.endsWith('.docx') || lower.endsWith('.txt')) type = '笔记'
    else if (lower.endsWith('.jpg') || lower.endsWith('.png')) type = '重点'
    store.addExamMaterial(exam.value.id, {
      type, name: f.name, chapterCoverage: [], importance: 4
    })
  }
  showUpload.value = false
  ElMessage.success('资料已添加（接入后端后可解析章节并提取知识点）')
}
</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.exam-selector {
  flex-wrap: wrap;
}

.exam-chip {
  padding: 10px 20px;
  border-radius: 10px;
  background: var(--bg-card);
  cursor: pointer;
  border: 1px solid var(--divider);
  transition: all 0.2s;
  min-width: 170px;
  box-shadow: var(--shadow);
}

.exam-chip.active {
  background: var(--primary);
  border-color: var(--primary);
  box-shadow: 0 2px 10px rgba(30, 136, 229, 0.3);
}

.exam-chip .ec-name {
  font-size: 13px;
  color: var(--text-primary);
  white-space: nowrap;
}

.exam-chip.active .ec-name {
  color: #fff;
}

.exam-chip .ec-count {
  font-size: 11px;
  color: var(--text-hint);
  margin-top: 2px;
}

.exam-chip.active .ec-count {
  color: rgba(255, 255, 255, 0.8);
}

.checkin-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  background: linear-gradient(120deg, rgba(30, 136, 229, 0.06), rgba(38, 166, 154, 0.06));
  border: 1px solid rgba(30, 136, 229, 0.15);
}

.cb-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.cb-icon {
  font-size: 26px;
}

.cb-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.cb-sub {
  font-size: 11px;
  color: var(--text-hint);
  margin-top: 2px;
}

.cb-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

/* 调整对比卡 */
.adjust-diff {
  border: 1.5px solid var(--secondary);
  background: rgba(38, 166, 154, 0.04);
}

.ad-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.ad-title {
  font-size: 15px;
  font-weight: bold;
  color: var(--secondary);
}

.ad-time {
  font-size: 11px;
  color: var(--text-hint);
}

.ad-changes {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ad-change {
  background: var(--bg-card);
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 12px;
}

.ad-day {
  font-weight: bold;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.ad-from {
  color: var(--text-hint);
  text-decoration: line-through;
}

.ad-to {
  color: var(--secondary);
  font-weight: 600;
}

.ad-reason {
  color: var(--warning);
  margin-top: 3px;
}

.ad-explain {
  margin-top: 10px;
  font-size: 12px;
  color: var(--text-primary);
  white-space: pre-wrap;
  line-height: 1.8;
  font-family: inherit;
  background: var(--bg-card);
  border-radius: 8px;
  padding: 10px;
}

.ad-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 10px;
  flex-wrap: wrap;
}

.ad-hint {
  font-size: 11px;
  color: var(--text-hint);
}

.left-col,
.right-col {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.ov-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.ov-name {
  font-size: 17px;
  font-weight: bold;
  color: var(--text-primary);
}

.ov-meta {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 4px;
}

.ov-count {
  text-align: center;
}

.ov-k {
  font-size: 10px;
  color: var(--text-hint);
}

.ov-v {
  font-size: 22px;
  font-weight: bold;
  color: var(--primary);
}

.ov-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10px;
}

.ov-mats {
  font-size: 13px;
  color: var(--text-secondary);
}

.score-row {
  display: flex;
  align-items: center;
  justify-content: space-around;
  background: var(--bg-primary);
  border-radius: 8px;
  padding: 10px;
}

.score-box {
  text-align: center;
  flex: 1;
}

.sb-k {
  font-size: 11px;
  color: var(--text-hint);
}

.sb-v {
  font-size: 24px;
  font-weight: bold;
}

.sb-v.primary { color: var(--primary); }
.sb-v.success { color: var(--success); }

.sb-u {
  font-size: 12px;
  color: var(--text-hint);
}

.score-arrow {
  font-size: 20px;
  color: var(--text-hint);
}

.areas {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}

.area-col {
  flex: 1;
}

.area-label {
  font-size: 12px;
  font-weight: 600;
}

.area-label.strong { color: var(--success); }
.area-label.weak { color: var(--error); }

.area-item {
  font-size: 11px;
  color: var(--text-secondary);
  margin-top: 2px;
}

.trend {
  margin-top: 8px;
  font-size: 12px;
  color: var(--secondary);
  line-height: 1.7;
}

.prog-stats {
  display: flex;
  margin-top: 10px;
}

.prog-stat {
  flex: 1;
  text-align: center;
}

.ps-k {
  font-size: 10px;
  color: var(--text-hint);
}

.ps-v {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  margin-top: 2px;
}

.plan-head {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ph-title {
  font-size: 16px;
  font-weight: bold;
  color: var(--text-primary);
}

.phase-chip {
  padding: 3px 8px;
  font-size: 11px;
}

/* 设置弹窗 */
.setup-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.su-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.su-label {
  width: 90px;
  font-size: 13px;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.su-unit {
  font-size: 12px;
  color: var(--text-hint);
}

.su-hint {
  font-size: 11px;
  color: var(--secondary);
  background: rgba(38, 166, 154, 0.08);
  border-radius: 6px;
  padding: 8px;
  line-height: 1.6;
}

/* 测验弹窗 */
.quiz-info {
  font-size: 12px;
  color: var(--secondary);
  background: rgba(38, 166, 154, 0.08);
  border-radius: 6px;
  padding: 8px;
  margin-bottom: 12px;
}

.quiz-q {
  border: 1px solid var(--divider);
  border-radius: 10px;
  padding: 12px;
  margin-bottom: 12px;
}

.qq-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.qq-num {
  font-weight: bold;
  color: var(--primary);
  font-size: 13px;
}

.qq-kp {
  font-size: 11px;
  color: var(--secondary);
  background: rgba(38, 166, 154, 0.1);
  padding: 2px 8px;
  border-radius: 10px;
}

.qq-diff {
  font-size: 10px;
  color: #FFB300;
  margin-left: auto;
}

.qq-text {
  font-size: 13px;
  color: var(--text-primary);
  line-height: 1.7;
  margin-bottom: 8px;
}

.qq-options {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}

.qq-option {
  width: 100%;
  margin: 0;
  height: auto;
  padding: 8px 12px;
}

.quiz-result {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.qr-title {
  font-size: 14px;
  font-weight: bold;
  color: var(--text-primary);
}

.qr-row {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--bg-primary);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 12px;
}

.qr-kp {
  font-weight: 600;
  color: var(--text-primary);
}

.qr-correct {
  color: var(--text-secondary);
}

.qr-mastery {
  margin-left: auto;
  font-weight: bold;
  color: var(--success);
}

.qr-mastery.weak {
  color: var(--error);
}

.qr-weak {
  font-size: 12px;
  color: var(--warning);
  line-height: 1.6;
}

.qr-weak.good {
  color: var(--success);
}

.qr-explain {
  font-size: 11px;
  color: var(--text-hint);
  line-height: 1.7;
  border-top: 1px dashed var(--divider);
  padding-top: 6px;
}

.checkin-body {
  padding: 4px;
}

.ci-q {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 12px 0 8px;
}

.ci-q:first-child {
  margin-top: 0;
}

.kp-rate {
  margin-bottom: 6px;
}

.kr-head {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
}

.kr-name {
  color: var(--text-primary);
}

.kr-mastery {
  color: var(--success);
}

.kr-mastery.weak {
  color: var(--warning);
}

.ci-hint {
  margin-top: 12px;
  font-size: 11px;
  color: var(--secondary);
  background: rgba(38, 166, 154, 0.08);
  border-radius: 6px;
  padding: 8px;
  line-height: 1.6;
}

.dialog-hint {
  font-size: 12px;
  color: var(--text-hint);
}

.upload-zone {
  margin-top: 10px;
  height: 140px;
  border: 1.5px dashed var(--divider);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
}
</style>
