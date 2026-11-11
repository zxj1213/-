<template>
  <div class="card">
    <div class="head">
      <span class="date">📅 {{ review.label || review.date }}</span>
      <span v-if="review.efficiencyScore != null" class="score" :style="{ color: scoreColor }"
        title="任务完成占 30%，专注时长达成占 70%。没有预计时长时按任务完成率计算。">
        效率 {{ review.efficiencyScore }} 分
      </span>
    </div>

    <div v-if="review.legacy" class="explain">
      <div class="explain-title">旧版复盘</div>
      <div class="explain-body">{{ review.deviationExplanation || '此日期保留了补充说明。' }}</div>
    </div>
    <template v-else>
      <div v-if="review.hasActivity" class="grid">
        <div class="stat">
          <div class="v">{{ review.totalTasks ? `${review.completedTasks}/${review.totalTasks}` : '—' }}</div>
          <div class="k">任务完成</div>
        </div>
        <div class="stat">
          <div class="v">{{ formatMinutes(review.focusMinutes) }}</div>
          <div class="k">专注时长</div>
        </div>
        <div class="stat">
          <div class="v">{{ review.plannedMinutes ? formatMinutes(review.plannedMinutes) : '—' }}</div>
          <div class="k">预计时长</div>
        </div>
        <div class="stat">
          <div class="v">{{ review.sessionCount }}</div>
          <div class="k">专注次数</div>
        </div>
      </div>

      <div v-if="review.plannedMinutes" class="progress">
        <div class="progress-label">时长达成 {{ progress }}%</div>
        <el-progress :percentage="Math.min(progress, 100)" :show-text="false" :stroke-width="8" color="#1E88E5" />
      </div>

      <div class="explain">
        <div class="explain-title">学习情况分析</div>
        <div class="explain-body">{{ review.deviationExplanation }}</div>
      </div>

      <div class="suggestions">
        <div class="suggest-title">💡 次日建议</div>
        <div v-for="(s, i) in review.suggestions" :key="i" class="suggest-item">• {{ s }}</div>
      </div>

      <div v-if="review.hasActivity" class="data-sources">
        <div class="ds-title">📊 数据来源</div>
        <div v-for="(ds, i) in review.dataSources" :key="i" class="ds-item">• {{ ds }}</div>
      </div>
    </template>

    <div v-if="review.notes?.length" class="explain review-notes">
      <div class="explain-title">补充说明</div>
      <div v-for="(note, index) in review.notes" :key="index" class="explain-body">• {{ note }}</div>
    </div>

    <div v-if="showActions" class="actions">
      <el-button size="small" round @click="$emit('add-note')">✏️ 补充说明</el-button>
      <el-button
        v-if="review.hasActivity || review.userConfirmed"
        size="small" round type="primary"
        :disabled="review.userConfirmed"
        @click="$emit('confirm')"
      >
        {{ review.userConfirmed ? '✓ 已确认' : '确认并写入画像' }}
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { formatMinutes } from '../constants'

const props = defineProps({
  review: { type: Object, required: true },
  showActions: { type: Boolean, default: false }
})

defineEmits(['confirm', 'add-note'])

const progress = computed(() => props.review.plannedMinutes
  ? Math.round(props.review.focusMinutes / props.review.plannedMinutes * 100) : 0)

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
  font-size: calc(0.875rem * var(--font-scale));
  font-weight: bold;
  color: var(--text-primary);
  line-height: 24.64px;
}

.score {
  font-size: calc(0.8125rem * var(--font-scale));
  font-weight: bold;
  line-height: 22.88px;
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
  font-size: calc(1rem * var(--font-scale));
  font-weight: bold;
  color: var(--primary);
  line-height: 28.16px;
}

.stat .k {
  font-size: calc(0.625rem * var(--font-scale));
  color: var(--text-hint);
  margin-top: 2px;
  line-height: 17.6px;
}

.progress {
  margin-top: 10px;
}

.progress-label {
  color: var(--text-secondary);
  font-size: calc(0.75rem * var(--font-scale));
  margin-bottom: 4px;
}

.explain {
  margin-top: 12px;
  background: var(--bg-primary);
  border-radius: 8px;
  padding: 10px;
}

.explain-title {
  font-size: calc(0.75rem * var(--font-scale));
  font-weight: bold;
  color: var(--text-primary);
  margin-bottom: 4px;
  line-height: 21.12px;
}

.explain-body {
  font-size: calc(0.75rem * var(--font-scale));
  color: var(--text-secondary);
  line-height: 22.44px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.suggestions {
  margin-top: 10px;
}

.suggest-title {
  font-size: calc(0.75rem * var(--font-scale));
  font-weight: bold;
  color: var(--text-primary);
  margin-bottom: 4px;
  line-height: 21.12px;
}

.suggest-item {
  font-size: calc(0.75rem * var(--font-scale));
  color: var(--secondary);
  line-height: 23.76px;
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
  font-size: calc(0.75rem * var(--font-scale));
  font-weight: bold;
  color: var(--text-primary);
  margin-bottom: 4px;
  line-height: 21.12px;
}

.ds-item {
  font-size: calc(0.6875rem * var(--font-scale));
  color: var(--text-secondary);
  line-height: 21.78px;
}
</style>
