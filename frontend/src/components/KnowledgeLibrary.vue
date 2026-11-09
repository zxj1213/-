<template>
  <section aria-labelledby="library-title">
    <div class="library-header">
      <h2 id="library-title">知识库</h2>
      <el-button type="primary" round @click="showUpload = true">
        <el-icon><Plus /></el-icon> 上传资料
      </el-button>
    </div>

    <div class="card search-row">
      <el-input v-model="query" clearable placeholder="搜索资料标题、课程、标签或正文" aria-label="搜索知识库">
        <template #prefix><el-icon><Search /></el-icon></template>
      </el-input>
    </div>
    <p class="library-note" aria-live="polite">{{ query.trim() ? '找到' : '共' }} {{ results.length }} 份资料</p>
    <el-alert v-if="storageError" :title="storageError" type="warning" :closable="false" />
    <div v-if="results.length" class="grid-2">
      <article v-for="{ doc, field, hits } in results" :key="doc.id" class="card doc-card">
        <div class="doc-title">{{ doc.title }}</div>
        <div class="library-note">
          {{ doc.type }}{{ doc.courseName ? ' · ' + doc.courseName : '' }} · {{ doc.uploadDate }}
          <el-tag v-if="!doc.file" size="small" type="info">仅资料信息</el-tag>
          <el-tag v-if="field" size="small">命中{{ field }}</el-tag>
        </div>
        <p class="doc-summary">{{ doc.summary }}</p>
        <ul v-if="hits.length" class="source-hits">
          <li v-for="hit in hits" :key="hit.index">
            <el-button link type="primary" @click="openPreview(doc, hit.index)">{{ hit.label }}</el-button>
            <span>{{ hit.excerpt }}</span>
          </li>
        </ul>
        <el-button v-else-if="doc.file" link type="primary" @click="openPreview(doc, 0)">查看资料</el-button>
      </article>
    </div>
    <el-empty v-else :description="query.trim() ? '没有符合关键词的资料' : '暂无资料，可上传文件建立正文索引'" :image-size="80" />
  </section>

  <el-dialog v-model="showUpload" title="上传资料到知识库" width="min(94%, 680px)" align-center
    :close-on-click-modal="false" :close-on-press-escape="!saving" :show-close="!saving">
    <p class="library-note">支持 PDF、PPTX、DOCX、TXT、Markdown，单个文件最大 10 MiB。</p>
    <input ref="uploadFile" type="file" accept=".pdf,.pptx,.docx,.txt,.md" multiple hidden @change="onUpload" />
    <el-button :disabled="parsing || saving" @click="uploadFile?.click()">选择文件</el-button>
    <p v-if="parsing" role="status" class="library-note">
      <el-icon class="is-loading"><Loading /></el-icon> 正在提取资料正文…
    </p>
    <ul v-if="parseErrors.length" class="upload-errors" role="alert">
      <li v-for="error in parseErrors" :key="error">{{ error }}</li>
    </ul>
    <template v-if="pending.length">
      <ul class="pending-list">
        <li v-for="doc in pending" :key="doc.id">{{ doc.title }} · 已提取 {{ doc.chunks.length }} 处来源</li>
      </ul>
      <el-form label-position="top">
        <el-form-item label="归属课程">
          <el-select v-model="courseId" clearable placeholder="可选" style="width: 100%" :disabled="saving">
            <el-option v-for="course in store.courses" :key="course.id" :label="course.name" :value="course.id" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="courseId" label="同步到课程的知识点（可选）">
          <div class="library-keypoints">
            <div v-for="(point, index) in keyPoints" :key="index" class="keypoint-row">
              <el-input v-model="point.name" :aria-label="'知识点 ' + (index + 1)" :disabled="saving" />
              <span class="library-note">{{ point.source }}</span>
              <el-button link type="danger" :disabled="saving" @click="keyPoints.splice(index, 1)">移除</el-button>
            </div>
            <el-button link type="primary" :disabled="saving"
              @click="keyPoints.push({ name: '', source: '人工添加' })">添加知识点</el-button>
          </div>
        </el-form-item>
      </el-form>
    </template>
    <template #footer>
      <el-button :disabled="saving" @click="showUpload = false">取消</el-button>
      <el-button type="primary" :disabled="parsing || !pending.length" :loading="saving" @click="confirmUpload">
        保存 {{ pending.length }} 份资料
      </el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="showPreview" :title="previewDoc?.title || '资料预览'" width="min(94%, 820px)" align-center>
    <template v-if="previewChunk">
      <div class="preview-controls">
        <strong>{{ sourceLabel(previewChunk) }}</strong>
        <el-button size="small" :disabled="previewIndex === 0" @click="previewIndex--">上一处</el-button>
        <el-button size="small" :disabled="previewIndex === previewDoc.chunks.length - 1" @click="previewIndex++">下一处</el-button>
        <a v-if="previewChunk.kind === 'page'" :href="previewUrl + '#page=' + previewChunk.position"
          target="_blank" rel="noopener">打开原 PDF 第 {{ previewChunk.position }} 页</a>
        <a v-else :href="previewUrl" :download="previewDoc.title">下载原文件</a>
      </div>
      <pre class="source-text">{{ previewChunk.text }}</pre>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useAppStore } from '../store'
import { generateId, todayStr } from '../constants'
import { extractMaterial } from '../services/api'
import { loadMaterials, saveMaterials, searchMaterials, sourceLabel } from '../services/knowledgeLibrary'

const store = useAppStore()
const query = ref('')
const documents = shallowRef([])
const storageError = ref('')
const results = computed(() => searchMaterials([...documents.value, ...store.knowledgeDocs], query.value))

const showUpload = ref(false)
const uploadFile = ref(null)
const parsing = ref(false)
const saving = ref(false)
const parseErrors = ref([])
const pending = shallowRef([])
const courseId = ref('')
const keyPoints = ref([])
let request

const showPreview = ref(false)
const previewDoc = shallowRef(null)
const previewIndex = ref(0)
const previewUrl = ref('')
const previewChunk = computed(() => previewDoc.value?.chunks[previewIndex.value])

watch(() => store.currentUserId, async (owner, _, onCleanup) => {
  let current = true
  onCleanup(() => { current = false })
  documents.value = []
  storageError.value = ''
  query.value = ''
  showUpload.value = false
  showPreview.value = false
  if (!owner) return
  try {
    const stored = await loadMaterials(owner)
    if (current) documents.value = stored.reverse()
  } catch {
    if (current) storageError.value = '无法读取浏览器保存的资料，现有资料信息仍可搜索。'
  }
}, { immediate: true })

watch(showUpload, visible => {
  if (visible) return
  request?.abort()
  parsing.value = false
  pending.value = []
  parseErrors.value = []
  keyPoints.value = []
  courseId.value = ''
})

watch(showPreview, visible => { if (!visible) releasePreview() })
onScopeDispose(() => {
  request?.abort()
  releasePreview()
})

function releasePreview() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = ''
  previewDoc.value = null
}

function openPreview(doc, index) {
  releasePreview()
  previewDoc.value = doc
  previewIndex.value = index
  previewUrl.value = URL.createObjectURL(doc.type === 'PDF' ? new Blob([doc.file], { type: 'application/pdf' }) : doc.file)
  showPreview.value = true
}

function suggestKeyPoints(docs) {
  const suggestions = new Map()
  for (const doc of docs) {
    for (const chunk of doc.chunks) {
      for (const line of chunk.text.split('\n')) {
        const heading = line.match(/^\s*(?:#{1,6}\s+|第[一二三四五六七八九十\d]+[章节]\s*)(.{2,60})$/)
        if (heading && !suggestions.has(heading[1].trim())) {
          const name = heading[1].trim()
          suggestions.set(name, { name, source: doc.title + ' · ' + sourceLabel(chunk) })
        }
        if (suggestions.size >= 12) return [...suggestions.values()]
      }
    }
  }
  return [...suggestions.values()]
}

async function onUpload(event) {
  const files = [...event.target.files]
  event.target.value = ''
  if (!files.length || parsing.value || saving.value) return
  parseErrors.value = []
  pending.value = []
  keyPoints.value = []
  const controller = new AbortController()
  request = controller
  parsing.value = true
  const parsed = []
  try {
    for (const file of files) {
      if (controller.signal.aborted) return
      try {
        if (!/\.(pdf|pptx|docx|txt|md)$/i.test(file.name)) throw new Error('格式不受支持')
        if (!file.size || file.size > 10 * 1024 * 1024) throw new Error('文件为空或超过 10 MiB')
        const { type, chunks } = await extractMaterial(file, controller.signal)
        parsed.push({
          id: generateId(), title: file.name, uploadDate: todayStr(), type, chunks, file,
          summary: chunks[0].text.replace(/\s+/g, ' ').slice(0, 100)
        })
      } catch (error) {
        if (!controller.signal.aborted) parseErrors.value.push(file.name + ' · ' + error.message)
      }
    }
    if (!controller.signal.aborted) {
      pending.value = parsed
      keyPoints.value = suggestKeyPoints(parsed)
    }
  } finally {
    if (request === controller) {
      request = undefined
      parsing.value = false
    }
  }
}

async function confirmUpload() {
  const owner = store.currentUserId
  if (!owner || !pending.value.length || saving.value) return
  const course = store.courses.find(item => item.id === courseId.value)
  const points = keyPoints.value.filter(item => item.name.trim()).map(item => ({ ...item, name: item.name.trim() }))
  const docs = pending.value.map(doc => ({ ...doc, courseName: course?.name || '' }))
  saving.value = true
  try {
    await saveMaterials(owner, docs)
    if (store.currentUserId !== owner) return
    documents.value = [...docs, ...documents.value]
    if (course && points.length) store.addKnowledgePoints(course.id, points)
    query.value = ''
    showUpload.value = false
    ElMessage.success('已保存 ' + docs.length + ' 份可搜索资料')
  } catch {
    ElMessage.error('无法保存资料，请检查浏览器存储空间后重试。')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.library-header, .preview-controls, .keypoint-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.library-header { justify-content: space-between; margin-bottom: 12px; }
.library-header h2 { margin: 0; font-size: calc(1rem * var(--font-scale)); }
.search-row { max-width: 680px; }
.library-note { color: var(--text-secondary); font-size: calc(0.8125rem * var(--font-scale)); }
.doc-card { min-width: 0; overflow-wrap: anywhere; }
.doc-title { font-weight: 600; color: var(--text-primary); }
.doc-summary { margin: 6px 0; color: var(--text-secondary); }
.source-hits { list-style: none; margin: 8px 0 0; padding: 0; }
.source-hits li { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 8px; }
.source-hits span { color: var(--text-secondary); }
.library-keypoints { width: 100%; }
.keypoint-row { margin-bottom: 8px; }
.keypoint-row .el-input { flex: 1; min-width: 140px; }
.pending-list, .upload-errors { overflow-wrap: anywhere; }
.upload-errors { color: var(--el-color-danger); }
.preview-controls a { color: var(--primary); }
.source-text {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  max-height: 52dvh;
  overflow-y: auto;
  font: inherit;
  line-height: 1.6;
}
</style>
