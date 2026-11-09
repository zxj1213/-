<template>
  <div class="card task-card">
    <div class="row-top">
      <!-- 任务级勾选框：直接点击方框即可完成/取消(A3 修复，统一走 toggleTask) -->
      <el-checkbox
        :model-value="task.status === '已完成'"
        class="task-check"
        :aria-label="'完成任务：' + task.title"
        @change="$emit('toggle-task', task.id)"
        @click.stop
      />
      <div class="title-wrap">
        <span class="tag" :style="priorityStyle">{{ task.priority }}</span>
        <span class="tag source-tag">{{ task.source }}</span>
        <span class="title" :class="{ done: task.status === '已完成' }">{{ task.title }}</span>
      </div>
    </div>

    <div class="meta">
      <span>⏰ {{ relativeTime(task.deadline) }}截止</span>
      <span>⏱️ 约{{ formatDuration(task.estimatedDuration) }}</span>
      <span v-if="task.courseName">📚 {{ task.courseName }}</span>
      <span v-if="task.actualMinutes">🎧 已专注 {{ formatDuration(task.actualMinutes) }}</span>
    </div>

    <!-- 子任务进度：方框/文字均可切换 -->
    <div v-if="task.subTasks && task.subTasks.length" class="subtasks">
      <div class="subtask" v-for="sub in task.subTasks" :key="sub.id">
        <el-checkbox
          :model-value="sub.completed"
          :aria-label="'子任务：' + sub.title"
          @change="$emit('toggle-sub', task.id, sub.id)"
        />
        <span
          class="sub-title"
          :class="{ done: sub.completed }"
          @click="$emit('toggle-sub', task.id, sub.id)"
        >{{ sub.title }}</span>
      </div>
    </div>

    <!-- AI 摘要 -->
    <div v-if="task.aiSummary && showDetail" class="ai-summary">
      ✨ {{ task.aiSummary }}
    </div>

    <div class="row-actions">
      <span class="tag" :style="statusStyle">{{ task.status }}</span>
      <div class="actions">
        <el-button size="small" round @click.stop="$emit('focus', task)">
          <el-icon><Timer /></el-icon>&nbsp;开始专注
        </el-button>
        <el-button
          v-if="task.status !== '已完成'"
          size="small" round type="success" plain
          @click.stop="$emit('complete', task.id)"
        >完成</el-button>
        <el-button
          v-else
          size="small" round plain
          @click.stop="$emit('toggle-task', task.id)"
        >取消完成</el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { relativeTime } from '../constants'

const props = defineProps({
  task: { type: Object, required: true },
  showDetail: { type: Boolean, default: true }
})

defineEmits(['toggle-task', 'toggle-sub', 'focus', 'complete'])

const priorityMap = {
  紧急: { background: '#F4433615', color: '#F44336' },
  高: { background: '#FF980015', color: '#FF9800' },
  中: { background: '#2196F315', color: '#2196F3' },
  低: { background: '#75757515', color: '#757575' }
}
const priorityStyle = computed(() => priorityMap[props.task.priority] || priorityMap['中'])

const statusStyle = computed(() => {
  if (props.task.status === '已完成') return { background: '#4CAF5015', color: '#4CAF50' }
  if (props.task.status === '进行中') return { background: '#2196F315', color: '#2196F3' }
  return { background: '#FF980015', color: '#FF9800' }
})

function formatDuration(min) {
  if (min >= 60) {
    const h = Math.floor(min / 60)
    const m = min % 60
    return m ? `${h}小时${m}分钟` : `${h}小时`
  }
  return `${min}分钟`
}
</script>

<style scoped>
.task-card {
  margin-bottom: 16px;
}

.row-top {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.task-check {
  margin-top: 2px;
  flex-shrink: 0;
}

.title-wrap {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  flex-wrap: wrap;
  flex: 1;
}

.title {
  font-size: calc(0.875rem * var(--font-scale));
  font-weight: 600;
  color: var(--text-primary);
  line-height: 22.33px;
  flex: 1;
  min-width: 100%;
  margin-top: 4px;
}

.title.done {
  text-decoration: line-through;
  color: var(--text-hint);
}

.source-tag {
  background: rgba(30, 136, 229, 0.08);
  color: var(--primary);
}

.meta {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  font-size: calc(0.6875rem * var(--font-scale));
  color: var(--text-secondary);
  margin-top: 8px;
  line-height: 19.36px;
}

.subtasks {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.subtask {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: calc(0.75rem * var(--font-scale));
  color: var(--text-secondary);
  padding: 2px 0;
  line-height: 21.12px;
}

.sub-title {
  cursor: pointer;
}

.subtitle.done,
.subtask .done {
  text-decoration: line-through;
  color: var(--text-hint);
}

.ai-summary {
  margin-top: 8px;
  font-size: calc(0.75rem * var(--font-scale));
  color: var(--primary);
  background: rgba(30, 136, 229, 0.06);
  border-radius: 6px;
  padding: 6px 8px;
  line-height: 19.8px;
}

.row-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
}

.actions {
  display: flex;
  gap: 6px;
}
.card:last-child { margin-bottom: 0; }
</style>
