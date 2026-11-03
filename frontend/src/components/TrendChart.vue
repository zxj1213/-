<template>
  <div class="card">
    <div class="title">📊 本周效率趋势</div>
    <div class="chart">
      <div v-for="item in items" :key="item.date" class="bar-col">
        <span class="val">{{ item.value }}</span>
        <div class="bar-track">
          <div class="bar" :style="{ height: barHeight(item.value), background: barColor(item.value) }"></div>
        </div>
        <span class="label">{{ item.date.slice(5) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  items: { type: Array, default: () => [] } // [{ date, value }]
})

const max = computed(() => Math.max(100, ...props.items.map(i => i.value)))

function barHeight(value) {
  return Math.max((value / max.value) * 100, 5) + '%'
}

function barColor(value) {
  if (value >= 85) return '#4CAF50'
  if (value >= 70) return '#2196F3'
  if (value >= 50) return '#FF9800'
  return '#F44336'
}
</script>

<style scoped>
.title {
  font-size: 15px;
  font-weight: bold;
  color: var(--text-primary);
  margin-bottom: 12px;
}

.chart {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  height: 120px;
}

.bar-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
  justify-content: flex-end;
}

.val {
  font-size: 9px;
  color: var(--text-hint);
  margin-bottom: 2px;
}

.bar-track {
  width: 100%;
  height: 80%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.bar {
  width: 14px;
  border-radius: 3px 3px 0 0;
  transition: height 0.5s ease-out;
}

.label {
  font-size: 9px;
  color: var(--text-hint);
  margin-top: 4px;
}
</style>
