<template>
  <div class="card plan-card" :class="{ today: isToday }">
    <div class="head">
      <span class="day">Day {{ plan.dayNumber }}</span>
      <span class="date">{{ plan.date.slice(5) }}</span>
      <span v-if="plan.adjusted" class="tag adjusted">AI已调整</span>
      <span v-else class="tag normal">AI规划</span>
      <span class="phase-tag" :style="phaseStyle">{{ phaseLabel }}</span>
      <el-tooltip :content="plan.locked ? '已锁定：重新规划时保留此安排' : '锁定此安排：重新规划时不覆盖'" placement="top">
        <span class="lock-btn" @click.stop="$emit('toggle-lock', plan.id)">
          {{ plan.locked ? '🔒' : '🔓' }}
        </span>
      </el-tooltip>
    </div>

    <div v-if="plan.chapters.length" class="chapters">
      <div v-for="ch in plan.chapters" :key="ch.name" class="chapter" :class="{ targeted: ch.targeted }">
        <div class="ch-name">
          <el-checkbox v-model="ch.completed" @change="$emit('change', plan, ch)" />
          <span :class="{ done: ch.completed }">{{ ch.name }}</span>
          <span v-if="ch.targeted" class="target-badge">🎯 针对性练习</span>
        </div>
        <div class="ch-meta">{{ ch.pageRange }} · {{ ch.keyPoints.join(' / ') }} · 约{{ ch.estimatedMinutes }}分钟</div>
      </div>
    </div>

    <div v-if="plan.practiceTasks.length" class="practices">
      <div v-for="p in plan.practiceTasks" :key="p.type" class="practice">
        <el-checkbox v-model="p.completed" @change="$emit('change', plan, p)" />
        <span :class="{ done: p.completed }">{{ p.type }} × {{ p.count }}道</span>
        <span class="ch-meta">约{{ p.estimatedMinutes }}分钟</span>
      </div>
    </div>

    <div class="foot">
      <span class="hours">⏱️ 预计 {{ plan.estimatedHours }}小时</span>
      <span v-if="plan.selfEvaluation" class="eval">自评 {{ plan.selfEvaluation }}分</span>
      <span v-if="plan.completed" class="done-badge">✓ 已完成</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  plan: { type: Object, required: true },
  isToday: { type: Boolean, default: false }
})

defineEmits(['change', 'toggle-lock'])

const phaseMap = {
  chapter: { label: '逐章学习', color: '#2196F3' },
  practice: { label: '集中刷题', color: '#FF9800' },
  sprint: { label: '冲刺复习', color: '#F44336' }
}

const phaseStyle = computed(() => ({
  background: (phaseMap[props.plan.phase]?.color || '#2196F3') + '15',
  color: phaseMap[props.plan.phase]?.color || '#2196F3'
}))
const phaseLabel = computed(() => phaseMap[props.plan.phase]?.label || props.plan.phase)
</script>

<style scoped>
.plan-card {
  margin-bottom: 8px;
}

.plan-card.today {
  border: 1.5px solid var(--primary);
  box-shadow: 0 2px 10px rgba(30, 136, 229, 0.18);
}

.head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.day {
  font-size: 14px;
  font-weight: bold;
  color: var(--text-primary);
}

.date {
  font-size: 11px;
  color: var(--text-hint);
}

.tag.adjusted {
  background: #FF980015;
  color: #FF9800;
}

.tag.normal {
  background: rgba(30, 136, 229, 0.08);
  color: var(--primary);
}

.phase-tag {
  margin-left: auto;
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 10px;
}

.lock-btn {
  cursor: pointer;
  font-size: 13px;
  opacity: 0.75;
  transition: opacity 0.2s;
}

.lock-btn:hover {
  opacity: 1;
}

.chapters {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chapter {
  background: var(--bg-primary);
  border-radius: 8px;
  padding: 8px 10px;
}

.chapter.targeted {
  background: rgba(255, 152, 0, 0.08);
  border: 1px dashed #FF9800;
}

.ch-name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  flex-wrap: wrap;
}

.ch-name .done {
  text-decoration: line-through;
  color: var(--text-hint);
}

.target-badge {
  font-size: 10px;
  color: #FF9800;
  font-weight: normal;
}

.ch-meta {
  font-size: 10px;
  color: var(--text-hint);
  margin-top: 3px;
  margin-left: 22px;
}

.practices {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.practice {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-primary);
  background: var(--bg-primary);
  border-radius: 8px;
  padding: 8px 10px;
}

.practice .done {
  text-decoration: line-through;
  color: var(--text-hint);
}

.foot {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 10px;
  font-size: 11px;
  color: var(--text-secondary);
}

.done-badge {
  margin-left: auto;
  color: var(--success);
  font-weight: 600;
}

.eval {
  color: var(--primary);
}
</style>
