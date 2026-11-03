<template>
  <div
    class="digital-human"
    :class="{ speaking: state.isSpeaking, thinking: emotion === 'thinking' }"
    @click="$emit('activate')"
    :title="state.isSpeaking ? '正在思考...' : '学迹AI助手'"
  >
    <span>{{ face }}</span>
    <div v-if="state.isSpeaking" class="wave"></div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  state: {
    type: Object,
    default: () => ({ isActive: true, isSpeaking: false, currentEmotion: 'neutral' })
  }
})

defineEmits(['activate'])

const emotion = computed(() => props.state.currentEmotion)

const face = computed(() => {
  if (emotion.value === 'thinking') return '🤔'
  if (emotion.value === 'happy') return '😊'
  if (emotion.value === 'speaking') return '🗣️'
  return '🧠'
})
</script>

<style scoped>
.digital-human {
  cursor: pointer;
  transition: transform 0.2s;
}

.digital-human:hover {
  transform: scale(1.06);
}

.digital-human.thinking span {
  animation: pulse 0.9s ease-in-out infinite;
}

.wave {
  position: absolute;
  inset: -6px;
  border-radius: 50%;
  border: 2px solid var(--primary);
  border-top-color: transparent;
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
