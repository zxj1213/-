<template>
  <div class="card">
    <div class="head">
      <span class="date">📅 {{ review.date }}</span>
      <span class="score" :style="{ color: scoreColor }">
        效率 {{ review.efficiencyScore }}分
      </span>
    </div>

    <div class="grid">
      <div class="stat">
        <div class="v">{{ review.completedCourses }}/{{ review.totalCourses }}</div>
        <div class="k">课程完成</div>
      </div>
      <div class="stat">
        <div class="v">{{ review.completedTasks }}/{{ review.totalTasks }}</div>
        <div class="k">任务完成</div>
      </div>
      <div class="stat">
        <div class="v">{{ review.studyHours }}h</div>
        <div class="k">学习时长</div>
      </div>
      <div class="stat">
        <div class="v">{{ review.exerciseMinutes }}min</div>
        <div class="k">锻炼时长</div>
      </div>
    </div>

    <el-progress
      :percentage="Math.round((review.studyHours / review.plannedStudyHours) * 100)"
      :stroke-width="8"
      color="#1E88E5"
      style="margin-top: 10px"
    />

    <div class="explain">
      <div class="explain-title">🤖 AI 偏差分析</div>
      <div class="explain-body">{{ review.deviationExplanation }}</div>
    </div>

    <div class="suggestions">
      <div class="suggest-title">💡 次日建议</div>
      <div v-for="(s, i) in review.suggestions" :key="i" class="suggest-item">• {{ s }}</div>
    </div>

    <!-- 数据来源(A5：复盘基于真实数据，不虚构统计) -->
    <div v-if="review.dataSources && review.dataSources.length" class="data-sources">
      <div class="ds-title">📊 数据来源</div>
      <div v-for="(ds, i) in review.dataSources" :key="i" class="ds-item">• {{ ds }}</div>
    </div>

    <div v-if="showActions" class="actions">
      <el-button size="small" round @click="$emit('add-note')">✏️ 补充说明</el-button>
      <el-button
        size="small" round type="primary"
        :disabled="review.userConfirmed"
        @click="$emit('confirm')"
      >
        {{ review.userConfirmed ? '✓ 已确认' : '确认并回写画像' }}
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  review: { type: Object, required: true },
  showActions: { type: Boolean, default: false }
})

defineEmits(['confirm', 'add-note'])

const scoreColor = computed(() => {
  const s = props.review.efficiencyScore
  if (s >= 85) return '#4CAF50'
  if (s >= 70) return '#2196F3'
  if (s >= 50) return '#FF9800'
  return '#F44336'
})
</script>

<style scoped>
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.date {
  font-size: 14px;
  font-weight: bold;
  color: var(--text-primary);
}

.score {
  font-size: 13px;
  font-weight: bold;
}

.grid {
  display: flex;
  margin-top: 12px;
}

.stat {
  flex: 1;
  text-align: center;
}

.stat .v {
  font-size: 16px;
  font-weight: bold;
  color: var(--primary);
}

.stat .k {
  font-size: 10px;
  color: var(--text-hint);
  margin-top: 2px;
}

.explain {
  margin-top: 12px;
  background: var(--bg-primary);
  border-radius: 8px;
  padding: 10px;
}

.explain-title {
  font-size: 12px;
  font-weight: bold;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.explain-body {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.7;
  white-space: pre-wrap;
}

.suggestions {
  margin-top: 10px;
}

.suggest-title {
  font-size: 12px;
  font-weight: bold;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.suggest-item {
  font-size: 12px;
  color: var(--secondary);
  line-height: 1.8;
}

.actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  justify-content: flex-end;
}

.data-sources {
  margin-top: 10px;
  background: rgba(30, 136, 229, 0.05);
  border-radius: 8px;
  padding: 10px;
}

.ds-title {
  font-size: 12px;
  font-weight: bold;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.ds-item {
  font-size: 11px;
  color: var(--text-secondary);
  line-height: 1.8;
}
</style>
