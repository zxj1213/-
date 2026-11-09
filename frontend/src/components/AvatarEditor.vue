<template>
  <el-dialog :model-value="modelValue" title="更换头像" width="min(92%, 420px)" align-center append-to-body
    :close-on-click-modal="false" :close-on-press-escape="!busy" :show-close="!busy"
    @update:model-value="$emit('update:modelValue', $event)">
    <input ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp" hidden @change="selectImage" />
    <div class="avatar-editor">
      <p v-if="!image" class="editor-hint">选择 JPG、PNG 或 WebP 图片，最大 5 MiB。</p>
      <div v-else class="crop-frame">
        <canvas ref="canvas" :width="size" :height="size" tabindex="0"
          aria-label="头像裁剪区域，可拖动图片或按方向键移动"
          @pointerdown="startDrag" @pointermove="moveDrag" @pointerup="endDrag"
          @pointercancel="endDrag" @lostpointercapture="endDrag" @keydown="moveWithKeys" />
        <div class="circle-guide" aria-hidden="true" />
      </div>
      <div v-if="image" class="zoom-row">
        <label for="avatar-zoom">缩放</label>
        <input id="avatar-zoom" v-model.number="zoom" type="range" min="1" max="4" step="0.01" :disabled="busy" />
        <output for="avatar-zoom">{{ Math.round(zoom * 100) }}%</output>
      </div>
      <p v-if="image" class="editor-hint">拖动图片调整位置，圆框内是头像的显示范围。</p>
      <div class="editor-actions">
        <el-button :loading="loading" :disabled="busy" @click="fileInput?.click()">{{ image ? '重新选择' : '选择图片' }}</el-button>
        <el-button v-if="image" :disabled="busy" @click="resetCrop">复位</el-button>
      </div>
      <p v-if="error" class="editor-error" role="alert">{{ error }}</p>
    </div>
    <template #footer>
      <el-button :disabled="busy" @click="$emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :loading="busy" :disabled="!image || loading" @click="confirmCrop">确认更换</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, ref, shallowRef, watch, watchEffect } from 'vue'

const props = defineProps({ modelValue: Boolean, saving: Boolean })
const emit = defineEmits(['update:modelValue', 'confirm'])
const size = 256
const fileInput = ref(null)
const canvas = ref(null)
const image = shallowRef(null)
const zoom = ref(1)
const offsetX = ref(0)
const offsetY = ref(0)
const loading = ref(false)
const encoding = ref(false)
const error = ref('')
const busy = computed(() => props.saving || encoding.value)
let generation = 0
let drag

const imageSize = computed(() => {
  if (!image.value) return { width: size, height: size }
  const { naturalWidth, naturalHeight } = image.value
  const scale = size * zoom.value / Math.min(naturalWidth, naturalHeight)
  return { width: naturalWidth * scale, height: naturalHeight * scale }
})

function moveImage(x, y) {
  const { width, height } = imageSize.value
  const limitX = Math.max(0, (width - size) / 2)
  const limitY = Math.max(0, (height - size) / 2)
  offsetX.value = Math.min(limitX, Math.max(-limitX, x))
  offsetY.value = Math.min(limitY, Math.max(-limitY, y))
}

watch(zoom, (next, previous) => {
  const ratio = next / previous
  moveImage(offsetX.value * ratio, offsetY.value * ratio)
})
watchEffect(() => {
  const context = canvas.value?.getContext('2d')
  if (!context || !image.value) return
  const { width, height } = imageSize.value
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, size, size)
  context.drawImage(image.value, (size - width) / 2 + offsetX.value, (size - height) / 2 + offsetY.value, width, height)
}, { flush: 'post' })

function resetCrop() {
  zoom.value = 1
  moveImage(0, 0)
}

watch(() => props.modelValue, open => {
  if (open) return
  generation++
  drag = undefined
  loading.value = false
  error.value = ''
  image.value = null
  resetCrop()
})

async function selectImage(event) {
  const file = event.target.files[0]
  event.target.value = ''
  if (!file || busy.value) return
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || !file.size || file.size > 5 * 1024 * 1024) {
    error.value = '请选择 5 MiB 以内的 JPG、PNG 或 WebP 图片。'
    return
  }
  const request = ++generation
  const url = URL.createObjectURL(file)
  loading.value = true
  error.value = ''
  try {
    const source = new Image()
    source.src = url
    await source.decode()
    if (request !== generation) return
    if (source.naturalWidth * source.naturalHeight > 24_000_000) {
      error.value = '图片分辨率过高，请缩小后重新选择。'
      return
    }
    image.value = source
    resetCrop()
  } catch {
    if (request === generation) error.value = '无法打开这张图片，请重新选择。'
  } finally {
    URL.revokeObjectURL(url)
    if (request === generation) loading.value = false
  }
}

function startDrag(event) {
  if (busy.value || drag || event.button !== 0) return
  const target = event.currentTarget
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY, left: offsetX.value, top: offsetY.value,
    scale: size / target.getBoundingClientRect().width }
  target.setPointerCapture(event.pointerId)
}

function moveDrag(event) {
  if (drag?.id !== event.pointerId || busy.value) return
  moveImage(drag.left + (event.clientX - drag.x) * drag.scale, drag.top + (event.clientY - drag.y) * drag.scale)
}

function endDrag(event) {
  if (drag?.id === event.pointerId) drag = undefined
}

function moveWithKeys(event) {
  const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key]
  if (!direction || busy.value) return
  event.preventDefault()
  const distance = event.shiftKey ? 12 : 3
  moveImage(offsetX.value + direction[0] * distance, offsetY.value + direction[1] * distance)
}

async function confirmCrop() {
  if (!canvas.value || !image.value || busy.value || loading.value) return
  encoding.value = true
  error.value = ''
  try {
    const blob = await new Promise(resolve => canvas.value.toBlob(resolve, 'image/png'))
    if (!blob) throw new Error('Avatar encoding failed')
    emit('confirm', new File([blob], 'avatar.png', { type: blob.type }))
  } catch {
    error.value = '无法生成头像，请重新选择图片。'
  } finally {
    encoding.value = false
  }
}
</script>

<style scoped>
.avatar-editor { display: grid; gap: 12px; }
.crop-frame { position: relative; width: min(100%, 256px); margin-inline: auto; overflow: hidden; }
.crop-frame canvas { display: block; width: 100%; touch-action: none; cursor: grab; }
.crop-frame canvas:focus-visible { outline: 2px solid var(--primary); outline-offset: -2px; }
.crop-frame canvas:active { cursor: grabbing; }
.circle-guide {
  position: absolute; inset: 0; border: 1px solid #fff; border-radius: 50%;
  box-shadow: 0 0 0 160px rgb(0 0 0 / 35%); pointer-events: none;
}
.zoom-row { display: flex; align-items: center; gap: 10px; }
.zoom-row input { flex: 1; min-width: 0; accent-color: var(--primary); }
.zoom-row output { min-width: 4ch; font-variant-numeric: tabular-nums; }
.editor-hint, .editor-error { margin: 0; }
.editor-hint { color: var(--text-secondary); }
.editor-error { color: var(--el-color-danger); }
</style>
