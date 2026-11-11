<template>
  <div class="page">
    <div class="head-row">
      <span class="head-title">每日复盘</span>
      <el-button v-if="!showDemo" round type="primary" @click="onRefresh">刷新今日复盘</el-button>
    </div>
    <div class="review-mode">
      <el-button round size="small" :type="showDemo ? 'default' : 'primary'" :aria-pressed="!showDemo"
        @click="showDemo = false">我的复盘</el-button>
      <el-button round size="small" :type="showDemo ? 'primary' : 'default'" :aria-pressed="showDemo"
        @click="showDemo = true">演示示例</el-button>
    </div>
    <div v-if="showDemo" class="dialog-hint">选择一个示例，查看不同的任务完成情况和专注时长会生成怎样的复盘。</div>
    <div v-else class="dialog-hint">复盘根据当前浏览器中的任务和专注记录生成。</div>

    <!-- 日期选择 -->
    <div class="chip-scroll date-selector">
      <button
        v-for="review in visibleReviews"
        :key="review.date"
        type="button"
        class="date-chip"
        :class="{ active: currentReview?.date === review.date }"
        :aria-pressed="currentReview?.date === review.date"
        @click="selectReview(review.date)"
      >
        <span class="dc-day">{{ review.label || review.date.slice(5) }}</span>
        <span v-if="review.userConfirmed" class="dc-check">✓ 已确认</span>
      </button>
    </div>

    <div v-if="genError && !showDemo" class="card gen-error" role="alert">
      <span class="ge-icon">⚠️</span>
      <div class="ge-text">
        <div class="ge-title">复盘生成失败</div>
        <div class="ge-msg">{{ genError }}</div>
      </div>
      <el-button size="small" round type="primary" @click="onRefresh">重试</el-button>
    </div>

    <div class="grid-main-side">
      <!-- 复盘卡 -->
      <DailyReviewCard
        v-if="currentReview"
        :review="currentReview"
        :show-actions="!showDemo"
        @confirm="onConfirm"
        @add-note="openNote"
      />
      <div v-else class="card dialog-hint">暂无复盘。点击「刷新今日复盘」查看今天的记录。</div>

      <TrendChart
        :title="showDemo ? '示例效率对比' : '近 7 天效率趋势'"
        :items="trendItems"
      />
    </div>

    <!-- 补充说明弹窗 -->
    <el-dialog v-model="showAddNote" title="补充说明" width="88%" align-center>
      <div class="dialog-hint">补充你对 {{ noteDate }} 学习的感想或困难</div>
      <el-input
        v-model="noteText"
        type="textarea"
        :rows="4"
        placeholder="例如：今天二叉树作业花了3小时..."
        style="margin-top: 10px"
      />
      <template #footer>
        <el-button @click="showAddNote = false">取消</el-button>
        <el-button type="primary" :disabled="!noteText.trim()" @click="saveNote">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { useAppStore } from '../store'
import { addDays, todayStr } from '../constants'
import { getMockReviewScenarios } from '../mock/data'
import { buildDailyReview } from '../services/dailyReview'
import DailyReviewCard from '../components/DailyReviewCard.vue'
import TrendChart from '../components/TrendChart.vue'

const store = useAppStore()

const selectedDate = ref('')
const showDemo = ref(false)
const demos = getMockReviewScenarios(todayStr()).map(({ label, date, tasks, sessionLogs }) => ({
  ...buildDailyReview(date, tasks, sessionLogs), label
}))
const selectedDemoDate = ref(demos.find(review => review.label === '按计划完成').date)
const genError = ref('')
const showAddNote = ref(false)
const noteText = ref('')
const noteDate = ref('')

const visibleReviews = computed(() => showDemo.value ? demos : store.reviews)
const currentReview = computed(() =>
  visibleReviews.value.find(r => r.date === (showDemo.value ? selectedDemoDate.value : selectedDate.value)) ||
  visibleReviews.value.at(-1) || null
)
const trendItems = computed(() => {
  const today = todayStr()
  const firstDay = addDays(today, -6)
  return visibleReviews.value.filter(r => Number.isFinite(r.efficiencyScore) &&
    (showDemo.value || (r.date >= firstDay && r.date <= today)))
    .map(r => ({ date: r.date, label: r.label, value: r.efficiencyScore }))
})

function selectReview(date) {
  if (showDemo.value) selectedDemoDate.value = date
  else selectedDate.value = date
}

function onConfirm() {
  if (currentReview.value && store.confirmReview(currentReview.value.date)) {
    ElMessage.success('复盘已确认，摘要已写入学业画像和记忆库')
  }
}

function openNote() {
  noteDate.value = currentReview.value.date
  noteText.value = ''
  showAddNote.value = true
}

function saveNote() {
  if (!store.addReviewNote(noteDate.value, noteText.value)) return
  showAddNote.value = false
  ElMessage.success('补充说明已保存')
}

function onRefresh() {
  genError.value = ''
  try {
    const review = store.generateTodayReview()
    if (review) {
      selectedDate.value = review.date
      ElMessage.success('今日复盘已更新')
    } else {
      genError.value = '无法保存复盘，请检查浏览器存储后重试。'
    }
  } catch {
    genError.value = '读取任务或专注记录时遇到问题，请重试。'
  }
}
</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: var(--section-gap);
}

.head-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.head-title {
  font-size: calc(1.375rem * var(--font-scale));
  font-weight: bold;
  color: var(--text-primary);
  line-height: 38.72px;
}

.review-mode {
  display: flex;
}

.date-selector {
  flex-wrap: wrap;
}

.date-chip {
  font-family: inherit;
  min-width: 64px;
  text-align: center;
  padding: 10px 8px;
  border-radius: 10px;
  background: var(--bg-card);
  cursor: pointer;
  border: 1px solid var(--divider);
  transition: all 0.2s;
}

.date-chip.active {
  background: var(--primary);
  border-color: var(--primary);
}

.dc-day {
  display: block;
  font-size: calc(0.8125rem * var(--font-scale));
  font-weight: 600;
  color: var(--text-primary);
  line-height: 22.88px;
}

.dc-check {
  display: block;
  font-size: calc(0.625rem * var(--font-scale));
  color: var(--success);
  margin-top: 2px;
  line-height: 17.6px;
}

.date-chip.active .dc-day,
.date-chip.active .dc-check {
  color: #fff;
}

.gen-error {
  display: flex;
  align-items: center;
  gap: 12px;
  border: 1px solid rgba(244, 67, 54, 0.3);
}

.ge-icon {
  font-size: calc(1.5rem * var(--font-scale));
  line-height: 42.24px;
}

.ge-text {
  flex: 1;
}

.ge-title {
  font-size: calc(0.8125rem * var(--font-scale));
  font-weight: bold;
  color: var(--error);
  line-height: 22.88px;
}

.ge-msg {
  font-size: calc(0.6875rem * var(--font-scale));
  color: var(--text-secondary);
  margin-top: 2px;
  line-height: 19.36px;
}

.dialog-hint {
  font-size: calc(0.75rem * var(--font-scale));
  color: var(--text-hint);
  line-height: 21.12px;
}
</style>
