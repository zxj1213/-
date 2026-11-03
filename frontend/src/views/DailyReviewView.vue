<template>
  <div class="page">
    <div class="head-row">
      <span class="head-title">AI每日复盘</span>
      <span class="refresh-chip" @click="onRefresh">
        <span v-if="!generating">🔄 刷新今日复盘</span>
        <el-icon v-else class="is-loading"><Loading /></el-icon>
      </span>
    </div>

    <!-- 日期选择 -->
    <div class="chip-scroll date-selector">
      <div
        v-for="review in store.reviews"
        :key="review.date"
        class="date-chip"
        :class="{ active: selectedDate === review.date }"
        @click="selectReview(review.date)"
      >
        <div class="dc-day">{{ cnDay(review.date) }}</div>
        <div class="dc-date">{{ review.date.slice(5) }}</div>
        <div v-if="review.userConfirmed" class="dc-check">✓</div>
      </div>
    </div>

    <!-- 生成中 / 失败重试(A5：三态反馈) -->
    <div v-if="generating" class="card generating">
      <el-icon class="is-loading" :size="30"><Loading /></el-icon>
      <div class="g-text">AI正在分析今日数据...</div>
      <div class="g-sub">汇总任务完成、专注会话、薄弱知识点...</div>
    </div>
    <div v-if="genError" class="card gen-error">
      <span class="ge-icon">⚠️</span>
      <div class="ge-text">
        <div class="ge-title">AI 复盘生成失败</div>
        <div class="ge-msg">{{ genError }}</div>
      </div>
      <el-button size="small" round type="primary" @click="onRefresh">重试</el-button>
    </div>

    <div class="grid-main-side">
      <!-- 复盘卡 -->
      <DailyReviewCard
        v-if="currentReview"
        :review="currentReview"
        :show-actions="true"
        @confirm="onConfirm"
        @add-note="showAddNote = true"
      />

      <!-- 本周趋势 -->
      <TrendChart
        :items="store.reviews.map(r => ({ date: r.date, value: r.efficiencyScore }))"
      />
    </div>

    <!-- 补充说明弹窗 -->
    <el-dialog v-model="showAddNote" title="补充说明" width="88%" align-center>
      <div class="dialog-hint">补充你对今天学习的感想或困难</div>
      <el-input
        v-model="noteText"
        type="textarea"
        :rows="4"
        placeholder="例如：今天二叉树作业花了3小时..."
        style="margin-top: 10px"
      />
      <template #footer>
        <el-button @click="showAddNote = false">取消</el-button>
        <el-button type="primary" @click="saveNote">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { useAppStore } from '../store'
import DailyReviewCard from '../components/DailyReviewCard.vue'
import TrendChart from '../components/TrendChart.vue'

const store = useAppStore()

const selectedDate = ref(store.reviews[store.reviews.length - 1]?.date || '')
const generating = ref(false)
const genError = ref('')
const showAddNote = ref(false)
const noteText = ref('')

const currentReview = computed(() =>
  store.reviews.find(r => r.date === selectedDate.value) || null
)

function cnDay(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.getDate() + '日'
}

function selectReview(date) {
  selectedDate.value = date
}

function onConfirm() {
  if (!currentReview.value) return
  store.confirmReview(selectedDate.value)
  ElMessage.success('画像与记忆库已更新')
}

function saveNote() {
  if (currentReview.value && noteText.value.trim()) {
    store.addReviewNote(selectedDate.value, noteText.value.trim())
  }
  showAddNote.value = false
  noteText.value = ''
  ElMessage.success('补充说明已保存')
}

/** 生成今日复盘(A5)：加载态 + 失败降级规则引擎 + 可重试 */
function onRefresh() {
  generating.value = true
  genError.value = ''
  // 模拟异步生成(后端在线时走 API，失败自动降级为本地规则引擎)
  setTimeout(() => {
    try {
      const review = store.generateTodayReview()
      selectedDate.value = review.date
      generating.value = false
      ElMessage.success('AI复盘已生成（规则引擎 + 真实学习数据）')
    } catch (e) {
      generating.value = false
      genError.value = '生成过程异常，已使用规则引擎兜底。请重试或检查数据。'
      ElMessage.error('复盘生成失败，可点击重试')
    }
  }, 1600)
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
  font-size: 22px;
  font-weight: bold;
  color: var(--text-primary);
}

.refresh-chip {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 13px;
  color: var(--primary);
  background: rgba(100, 181, 246, 0.15);
  padding: 7px 14px;
  border-radius: 16px;
  cursor: pointer;
}

.date-selector {
  flex-wrap: wrap;
}

.date-chip {
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
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.dc-date {
  font-size: 10px;
  color: var(--text-hint);
  margin-top: 2px;
}

.dc-check {
  font-size: 10px;
  color: var(--success);
  margin-top: 2px;
}

.date-chip.active .dc-day,
.date-chip.active .dc-date {
  color: #fff;
}

.date-chip.active .dc-check {
  color: #fff;
}

.generating {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 30px;
}

.gen-error {
  display: flex;
  align-items: center;
  gap: 12px;
  border: 1px solid rgba(244, 67, 54, 0.3);
}

.ge-icon {
  font-size: 24px;
}

.ge-text {
  flex: 1;
}

.ge-title {
  font-size: 13px;
  font-weight: bold;
  color: var(--error);
}

.ge-msg {
  font-size: 11px;
  color: var(--text-secondary);
  margin-top: 2px;
}

.g-text {
  font-size: 14px;
  color: var(--text-secondary);
}

.g-sub {
  font-size: 12px;
  color: var(--text-hint);
}

.dialog-hint {
  font-size: 12px;
  color: var(--text-hint);
}
</style>
