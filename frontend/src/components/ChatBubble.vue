<template>
  <div class="msg-row" :class="message.role">
    <div v-if="message.role === 'assistant'" class="digital-human small">
      <span>🧠</span>
    </div>
    <div class="bubble" :class="message.role">
      <div v-if="message.attachments && message.attachments.length" class="attach">
        📎 {{ message.attachments.join(', ') }}
      </div>
      <span v-html="renderContent(message.content)"></span>
      <div class="time">{{ message.timestamp?.slice(11, 16) }}</div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  message: { type: Object, required: true }
})

/** 简单 Markdown 渲染：**加粗** 与换行 */
function renderContent(content) {
  return (content || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>')
}
</script>

<style scoped>
.msg-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 12px;
}

.msg-row.user {
  justify-content: flex-end;
}

.digital-human.small {
  width: 32px;
  height: 32px;
  font-size: calc(1rem * var(--font-scale));
  flex-shrink: 0;
  line-height: 28.16px;
}

.time {
  font-size: calc(0.5625rem * var(--font-scale));
  color: var(--text-hint);
  margin-top: 4px;
  text-align: right;
  line-height: 15.84px;
}

.attach {
  font-size: calc(0.6875rem * var(--font-scale));
  margin-bottom: 4px;
  opacity: 0.8;
  line-height: 19.36px;
}
</style>
