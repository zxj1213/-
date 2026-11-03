<template>
  <div class="page">
    <!-- 快捷入口(子页面切换) -->
    <div class="card quick-entries">
      <div
        v-for="entry in entries"
        :key="entry.key"
        class="quick-entry"
        :class="{ active: currentSub === entry.key }"
        @click="currentSub = entry.key"
      >
        <span class="qe-icon">{{ entry.emoji }}</span>
        <span class="qe-label" :style="{ color: currentSub === entry.key ? entry.color : '' }">{{ entry.label }}</span>
      </div>
    </div>

    <div class="sub-body">
      <!-- ============ 画像(总览) ============ -->
      <template v-if="currentSub === 'overview'">
        <div class="grid-side-main">
          <AcademicPortraitCard :portrait="store.portrait" class="fade-up" />

          <div class="right-col">
            <!-- AI记忆库预览 -->
            <div class="card mem-preview fade-up" @click="currentSub = 'memory'">
              <div class="card-title">
                <span class="t">AI记忆库</span>
                <span class="more">{{ store.aiMemories.length }}条记忆 ›</span>
              </div>
              <div v-for="mem in store.aiMemories.slice(0, 3)" :key="mem.id" class="mem-item">
                <span class="mem-icon" :style="{ background: memoryColor(mem.type) + '20' }">{{ memoryEmoji(mem.type) }}</span>
                <div class="mem-body">
                  <div class="mem-content">{{ mem.content }}</div>
                  <div class="mem-meta">
                    <span class="tag" :style="{ background: memoryColor(mem.type) + '20', color: memoryColor(mem.type) }">{{ memoryLabel(mem.type) }}</span>
                    <span class="mem-star">重要性: {{ '⭐'.repeat(Math.min(mem.importance, 5)) }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- 目标方向 -->
            <div class="card fade-up">
              <div class="card-title">
                <span class="t">目标方向</span>
                <span class="more" @click.stop="currentSub = 'career'">查看全部 →</span>
              </div>
              <div v-for="goal in store.portrait.goals" :key="goal.id" class="goal-item">
                <span class="tag" :style="careerColorStyle(goal.type)">{{ goal.type }}</span>
                <div class="goal-body">
                  <div class="goal-name">{{ goal.name }}</div>
                  <div class="goal-match">
                    <el-progress
                      :percentage="goal.matchScore"
                      :stroke-width="5"
                      :color="matchColor(goal.matchScore)"
                      style="width: 120px"
                    />
                    <span class="gm-text">{{ goal.matchScore }}%匹配</span>
                  </div>
                  <div v-if="goal.skillGaps.length" class="goal-gap">⚠️ 缺口: {{ goal.skillGaps.join(', ') }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 课程→能力→竞赛→岗位 路径图 -->
        <div class="card fade-up path-card">
          <div class="path-title">🔀 课程→能力→竞赛→岗位 路径图</div>
          <div class="path-row">
            <div class="path-node" style="background: #2196F3">数据结构<br/>算法设计</div>
            <span class="path-arrow">→</span>
            <div class="path-node" style="background: #4CAF50">算法能力<br/>编程能力</div>
            <span class="path-arrow">→</span>
            <div class="path-node" style="background: #FF9800">ACM竞赛<br/>蓝桥杯</div>
            <span class="path-arrow">→</span>
            <div class="path-node" style="background: #1E88E5">保研<br/>大厂就业</div>
            <span class="path-arrow">→</span>
            <div class="path-node" style="background: #26A69A">科研论文<br/>系统设计</div>
          </div>
        </div>
      </template>

      <!-- ============ 竞赛推荐 ============ -->
      <template v-else-if="currentSub === 'competition'">
        <div class="sub-title">竞赛推荐</div>
        <div class="grid-3">
          <div v-for="comp in store.competitions" :key="comp.id" class="card comp-card fade-up">
            <div class="comp-top">
              <div>
                <div class="comp-name">{{ comp.name }}</div>
                <div class="comp-meta">{{ comp.level }} · {{ comp.category }}</div>
              </div>
              <div class="comp-score">
                <div class="cs-v" :style="{ color: matchColor(comp.matchScore) }">{{ comp.matchScore }}%</div>
                <div class="cs-k">匹配度</div>
              </div>
            </div>
            <div class="comp-desc">{{ comp.description }}</div>
            <div v-if="comp.skillGaps?.length" class="comp-gap">💡 需提升: {{ comp.skillGaps.join('、') }}</div>
            <div class="comp-foot">
              <span class="comp-deadline">报名截止: {{ comp.registrationDeadline }}</span>
              <el-button size="small" round plain type="primary">查看详情</el-button>
            </div>
          </div>
        </div>
      </template>

      <!-- ============ 升学/就业推荐 ============ -->
      <template v-else-if="currentSub === 'career'">
        <div class="sub-title">升学/就业推荐</div>
        <div class="grid-2">
          <div v-for="career in store.portrait.goals" :key="career.id" class="card career-card fade-up">
            <div class="career-head">
              <span class="tag" :style="careerColorStyle(career.type)">{{ career.type }}</span>
              <span class="career-name">{{ career.name }}</span>
            </div>
            <div class="career-reqs">
              <div v-for="req in career.requirements" :key="req" class="req-item">✓ {{ req }}</div>
            </div>
            <div class="career-actions">
              <div class="ca-title">AI 建议行动</div>
              <div v-for="action in career.suggestedActions" :key="action" class="ca-item">➡ {{ action }}</div>
            </div>
          </div>
        </div>
      </template>

      <!-- ============ 知识库 ============ -->
      <template v-else-if="currentSub === 'knowledge'">
        <div class="sub-title-row">
          <span class="sub-title" style="margin: 0">知识库</span>
          <el-button size="small" type="primary" round @click="showUpload = true">
            <el-icon><Plus /></el-icon>&nbsp;上传资料
          </el-button>
        </div>
        <div class="grid-2">
          <div v-for="doc in store.knowledgeDocs" :key="doc.id" class="card doc-card">
            <span class="doc-icon" :style="{ background: 'rgba(100,181,246,0.15)' }">{{ docEmoji(doc.type) }}</span>
            <div class="doc-body">
              <div class="doc-title">{{ doc.title }}</div>
              <div class="doc-meta">{{ doc.type }}{{ doc.courseName ? ` · ${doc.courseName}` : '' }} · {{ doc.uploadDate }}</div>
              <div class="doc-summary">{{ doc.summary }}</div>
            </div>
            <el-icon class="doc-arrow"><ArrowRight /></el-icon>
          </div>
        </div>
        <div class="card search-row">
          <el-icon><Search /></el-icon>
          <el-input placeholder="在知识库中搜索（RAG智能检索）..." :borderless="true" size="small" />
        </div>
      </template>

      <!-- ============ 课程管理 ============ -->
      <template v-else-if="currentSub === 'courses'">
        <div class="sub-title">课程管理</div>
        <div class="card train-card">
          <div class="train-info">ℹ {{ store.trainingPlan.school }} · {{ store.trainingPlan.major }}</div>
          <div class="train-stats">
            <div v-for="s in creditStats" :key="s.label" class="train-stat">
              <div class="ts-v">{{ s.value }}</div>
              <div class="ts-k">{{ s.label }}</div>
            </div>
          </div>
          <div class="train-reqs">
            <div class="tr-title">毕业要求</div>
            <div v-for="r in store.trainingPlan.graduationRequirements" :key="r" class="tr-item">✓ {{ r }}</div>
          </div>
        </div>
        <div class="grid-2">
          <div v-for="course in store.courses" :key="course.id" class="card course-row">
            <div class="course-top">
              <span class="course-name">{{ course.name }}</span>
              <span class="tag" style="background: rgba(30,136,229,0.1); color: var(--primary)">{{ course.type }}</span>
              <span class="course-credit">{{ course.credits }}学分 · {{ course.hours }}学时</span>
            </div>
            <div class="course-meta">
              <span>{{ course.teacher }}</span>
              <span v-if="course.score" :style="{ color: course.score >= 90 ? 'var(--success)' : '' }"> · {{ course.grade }}({{ course.score }}分)</span>
              <span v-if="course.examDate" style="color: var(--warning)"> · 考试: {{ course.examDate.slice(0, 10) }}</span>
            </div>
            <div class="course-desc">{{ course.description }}</div>
          </div>
        </div>
      </template>

      <!-- ============ AI记忆库 ============ -->
      <template v-else-if="currentSub === 'memory'">
        <div class="sub-title">AI记忆库</div>
        <div class="mem-desc">AI从对话中学习你的偏好、习惯和目标，建立持续记忆，让推荐越来越精准</div>
        <div class="grid-2">
          <div v-for="mem in store.aiMemories" :key="mem.id" class="card mem-card">
            <span class="mem-icon" :style="{ background: memoryColor(mem.type) + '20' }">{{ memoryEmoji(mem.type) }}</span>
            <div class="mem-body">
              <div class="mem-content">{{ mem.content }}</div>
              <div class="mem-meta">
                <span class="tag" :style="{ background: memoryColor(mem.type) + '20', color: memoryColor(mem.type) }">{{ memoryLabel(mem.type) }}</span>
                <span class="mem-star">最近访问: {{ mem.lastAccessedAt }} · 访问{{ mem.accessCount }}次</span>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- 上传资料弹窗(B2：解析进度与失败提示) -->
    <el-dialog v-model="showUpload" title="上传资料到知识库" width="88%" align-center>
      <div class="dialog-hint">支持 PDF / PPT / Word / 笔记，AI 自动提取章节知识点（单文件 ≤ 10MB）</div>
      <div class="upload-zone" @click="pickUpload">
        <input ref="uploadFile" type="file" multiple hidden @change="onUploadFile" />
        <span style="font-size: 32px">📄</span>
        <span style="font-size: 12px; color: var(--text-hint)">点击选择文件（可多选）</span>
      </div>
      <div v-if="parsing" class="parse-progress">
        <el-icon class="is-loading" :size="20"><Loading /></el-icon>
        <span class="pp-text">AI 正在解析资料并提取知识点...</span>
      </div>
      <div v-if="parseErrors.length" class="parse-errors">
        <div v-for="err in parseErrors" :key="err" class="pe-item">⚠️ {{ err }}</div>
      </div>
    </el-dialog>

    <!-- 知识点确认弹窗(B2：解析结果人工确认/修改) -->
    <el-dialog v-model="showKpConfirm" title="确认解析出的知识点" width="88%" align-center>
      <div class="dialog-hint">
        AI 从资料中提取了以下知识点，可修改名称或删除，确认后进入学习计划流程（来源可追溯）
      </div>
      <div class="kc-course-row">
        <span class="kc-label">归属课程</span>
        <el-select v-model="kpConfirmCourseId" size="small" style="flex: 1">
          <el-option v-for="c in store.courses" :key="c.id" :label="c.name" :value="c.id" />
        </el-select>
      </div>
      <div v-for="(kp, i) in kpConfirmList" :key="i" class="kc-row">
        <el-input v-model="kp.name" size="small" class="kc-name" />
        <span class="kc-source" :title="kp.source">📎 {{ kp.source }}</span>
        <el-icon class="kc-del" @click="kpConfirmList.splice(i, 1)"><Delete /></el-icon>
      </div>
      <div class="kc-add" @click="kpConfirmList.push({ name: '', source: '人工添加' })">+ 手动添加知识点</div>
      <template #footer>
        <el-button @click="showKpConfirm = false">取消</el-button>
        <el-button type="primary" :disabled="!kpConfirmList.filter(k => k.name.trim()).length" @click="confirmKps">
          确认 {{ kpConfirmList.filter(k => k.name.trim()).length }} 个知识点
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { useAppStore } from '../store'
import { simulateMaterialParse } from '../services/ai'
import AcademicPortraitCard from '../components/AcademicPortraitCard.vue'

const store = useAppStore()

const currentSub = ref('overview')
const showUpload = ref(false)
const uploadFile = ref(null)
const parsing = ref(false)
const parseErrors = ref([])
const showKpConfirm = ref(false)
const kpConfirmList = ref([])
const kpConfirmCourseId = ref('course_001')

function pickUpload() {
  uploadFile.value?.click()
}

const entries = [
  { key: 'overview', label: '画像', emoji: '🪪', color: '#1E88E5' },
  { key: 'competition', label: '竞赛', emoji: '🏆', color: '#FF9800' },
  { key: 'career', label: '升学', emoji: '🎓', color: '#4CAF50' },
  { key: 'knowledge', label: '知识库', emoji: '📝', color: '#2196F3' },
  { key: 'courses', label: '课程', emoji: '📖', color: '#26A69A' },
  { key: 'memory', label: '记忆', emoji: '🧠', color: '#F44336' }
]

const creditStats = computed(() => {
  const t = store.trainingPlan
  if (!t) return []
  return [
    { label: '总学分', value: t.totalCredits },
    { label: '必修', value: t.requiredCredits },
    { label: '选修', value: t.electiveCredits },
    { label: '通识', value: t.generalCredits },
    { label: '实践', value: t.practiceCredits }
  ]
})

function matchColor(score) {
  if (score >= 80) return '#4CAF50'
  if (score >= 50) return '#FF9800'
  return '#F44336'
}

function careerColorStyle(type) {
  const map = {
    保研: '#4CAF50', 考研: '#2196F3', 就业: '#FF9800', 出国: '#26A69A'
  }
  const color = map[type] || '#1E88E5'
  return { background: color + '20', color }
}

function memoryEmoji(type) {
  const map = { preference: '❤', habit: '🔄', goal: '🎯', context: '☰' }
  return map[type] || '🧠'
}

function memoryColor(type) {
  const map = { preference: '#F44336', habit: '#FF9800', goal: '#4CAF50', context: '#2196F3' }
  return map[type] || '#757575'
}

function memoryLabel(type) {
  const map = { preference: '偏好', habit: '习惯', goal: '目标', context: '上下文' }
  return map[type] || '其他'
}

function docEmoji(type) {
  const map = { PPT: '📊', PDF: '📄', 笔记: '📝', 教材: '📖', 论文: '📄' }
  return map[type] || '📄'
}

/** 上传 → 解析(B2)：校验限制 → 提取知识点 → 人工确认 → 进入计划 */
async function onUploadFile(e) {
  const files = Array.from(e.target.files || [])
  if (!files.length) return
  parseErrors.value = []
  const MAX = 10 * 1024 * 1024
  const validFiles = []
  for (const f of files) {
    if (f.size === 0) {
      parseErrors.value.push(`「${f.name}」是空文件，已跳过`)
    } else if (f.size > MAX) {
      parseErrors.value.push(`「${f.name}」超过 10MB 限制，已跳过`)
    } else if (!/\.(pdf|ppt|pptx|doc|docx|txt|md)$/i.test(f.name)) {
      parseErrors.value.push(`「${f.name}」格式不支持（支持 PDF/PPT/Word/文本），已跳过`)
    } else {
      validFiles.push(f)
    }
  }
  if (!validFiles.length) return

  // 解析进度
  parsing.value = true
  const allKps = []
  const docInfos = []
  for (const f of validFiles) {
    // 模拟异步解析(后端在线时调用真实大模型解析)
    await new Promise(r => setTimeout(r, 700))
    try {
      const result = simulateMaterialParse(f.name, f.size)
      ElMessage.warning('当前为演示解析：知识点来自文件名示例，未读取文件内容。')
      allKps.push(...result.kps)
      const ext = f.name.split('.').pop().toLowerCase()
      const typeMap = { pdf: 'PDF', ppt: 'PPT', pptx: 'PPT', doc: '笔记', docx: '笔记', txt: '笔记', md: '笔记' }
      docInfos.push({ file: f, type: typeMap[ext] || '其他', result })
    } catch (err) {
      parseErrors.value.push(`「${f.name}」解析失败：${err.message || '未知错误'}`)
    }
  }
  parsing.value = false
  showUpload.value = false

  if (!allKps.length) {
    ElMessage.error('解析失败，请检查文件后重试')
    return
  }

  // 解析结果 → 人工确认弹窗
  kpConfirmList.value = allKps
  const lowerName = validFiles[0].name.toLowerCase()
  if (lowerName.includes('算法')) kpConfirmCourseId.value = 'course_002'
  else if (lowerName.includes('机器') || lowerName.includes('machine')) kpConfirmCourseId.value = 'course_005'
  else kpConfirmCourseId.value = 'course_001'
  pendingDocs.value = docInfos
  showKpConfirm.value = true
}

const pendingDocs = ref([])

/** 确认知识点：写入知识库 + 课程知识点表(可追溯来源) */
function confirmKps() {
  const kps = kpConfirmList.value.filter(k => k.name.trim())
  if (!kps.length) return
  store.addKnowledgePoints(kpConfirmCourseId.value, kps.map(k => ({ name: k.name.trim(), source: k.source })))
  for (const d of pendingDocs.value) {
    const course = store.courses.find(c => c.id === kpConfirmCourseId.value)
    store.addKnowledgeDoc({
      title: d.file.name,
      type: d.type,
      courseName: course?.name || '',
      summary: d.result.summary,
      chunks: d.result.chunks
    })
  }
  showKpConfirm.value = false
  kpConfirmList.value = []
  pendingDocs.value = []
  ElMessage.success(`已确认 ${kps.length} 个知识点并加入学习计划流程`)
}
</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: var(--section-gap);
}

/* 快捷入口 */
.quick-entries {
  display: flex;
  padding: 12px;
  gap: 4px;
}

.quick-entry {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px 10px;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.2s;
}

.quick-entry:hover {
  background: var(--bg-primary);
}

.quick-entry.active {
  background: rgba(30, 136, 229, 0.08);
}

.qe-icon {
  font-size: 18px;
  opacity: 0.4;
  transition: opacity 0.2s;
}

.quick-entry.active .qe-icon {
  opacity: 1;
}

.qe-label {
  font-size: 13px;
  color: var(--text-secondary);
}

.quick-entry.active .qe-label {
  font-weight: 600;
}

.sub-title {
  font-size: 18px;
  font-weight: bold;
  color: var(--text-primary);
  margin-bottom: 12px;
}

.sub-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.right-col {
  display: flex;
  flex-direction: column;
  gap: var(--grid-gap);
}

.path-card {
  margin-top: var(--section-gap);
}

.mem-preview {
  cursor: pointer;
}

.mem-item,
.mem-card {
  display: flex;
  gap: 10px;
  padding: 8px 0;
  align-items: flex-start;
}

.mem-icon {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}

.mem-body {
  flex: 1;
  min-width: 0;
}

.mem-content {
  font-size: 13px;
  color: var(--text-primary);
  line-height: 1.5;
}

.mem-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

.mem-star {
  font-size: 10px;
  color: var(--text-hint);
}

.goal-item {
  display: flex;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid var(--divider);
  align-items: flex-start;
}

.goal-item:last-child {
  border-bottom: none;
}

.goal-body {
  flex: 1;
}

.goal-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.goal-match {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 5px;
}

.gm-text {
  font-size: 11px;
  color: var(--text-hint);
}

.goal-gap {
  font-size: 11px;
  color: var(--warning);
  margin-top: 4px;
}

.path-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.path-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  margin-top: 10px;
  background: var(--bg-primary);
  border-radius: 8px;
  padding: 14px 10px;
}

.path-arrow {
  font-size: 16px;
  color: var(--text-hint);
}

.comp-card {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.comp-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.comp-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.comp-meta {
  font-size: 12px;
  color: var(--text-hint);
  margin-top: 2px;
}

.comp-score {
  text-align: center;
}

.cs-v {
  font-size: 18px;
  font-weight: bold;
}

.cs-k {
  font-size: 10px;
  color: var(--text-hint);
}

.comp-desc {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 8px;
  flex: 1;
}

.comp-gap {
  font-size: 12px;
  color: var(--warning);
  margin-top: 6px;
}

.comp-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
}

.comp-deadline {
  font-size: 11px;
  color: var(--text-hint);
}

.career-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.career-name {
  font-size: 16px;
  font-weight: bold;
  color: var(--text-primary);
}

.career-reqs {
  margin-top: 8px;
  background: var(--bg-primary);
  border-radius: 6px;
  padding: 10px;
}

.req-item {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.8;
}

.career-actions {
  margin-top: 8px;
}

.ca-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--secondary);
}

.ca-item {
  font-size: 13px;
  color: var(--text-primary);
  margin-top: 3px;
}

.doc-card {
  display: flex;
  align-items: center;
  gap: 10px;
}

.doc-icon {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  flex-shrink: 0;
}

.doc-body {
  flex: 1;
  min-width: 0;
}

.doc-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.doc-meta {
  font-size: 11px;
  color: var(--text-hint);
  margin-top: 2px;
}

.doc-summary {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 3px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.doc-arrow {
  color: var(--text-hint);
  font-size: 18px;
}

.search-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  color: var(--text-hint);
  max-width: 560px;
}

.train-card {
  margin-bottom: 16px;
}

.train-info {
  font-size: 13px;
  color: var(--text-secondary);
}

.train-stats {
  display: flex;
  margin-top: 12px;
  gap: 12px;
}

.train-stat {
  flex: 1;
  text-align: center;
  background: var(--bg-primary);
  border-radius: 8px;
  padding: 10px 0;
}

.ts-v {
  font-size: 18px;
  font-weight: bold;
  color: var(--primary);
}

.ts-k {
  font-size: 11px;
  color: var(--text-hint);
  margin-top: 2px;
}

.train-reqs {
  margin-top: 12px;
  background: var(--bg-primary);
  border-radius: 8px;
  padding: 10px 12px;
}

.tr-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.tr-item {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.8;
}

.course-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.course-top {
  display: flex;
  align-items: center;
  gap: 6px;
}

.course-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.course-credit {
  font-size: 10px;
  color: var(--text-hint);
  margin-left: auto;
}

.course-meta {
  font-size: 12px;
  color: var(--text-secondary);
}

.course-desc {
  font-size: 12px;
  color: var(--text-hint);
  line-height: 1.6;
}

.mem-desc {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 14px;
  line-height: 1.6;
}

.dialog-hint {
  font-size: 12px;
  color: var(--text-hint);
}

.upload-zone {
  margin-top: 10px;
  height: 140px;
  border: 1.5px dashed var(--divider);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
}

.parse-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  font-size: 12px;
  color: var(--primary);
}

.pp-text {
  color: var(--text-secondary);
}

.parse-errors {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.pe-item {
  font-size: 11px;
  color: var(--error);
}

.kc-course-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 12px 0;
}

.kc-label {
  font-size: 13px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.kc-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.kc-name {
  flex: 1;
}

.kc-source {
  font-size: 10px;
  color: var(--text-hint);
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.kc-del {
  cursor: pointer;
  color: var(--error);
}

.kc-add {
  font-size: 12px;
  color: var(--primary);
  cursor: pointer;
  padding: 6px 0;
}
.quick-entries { overflow-x: auto; }
.quick-entry { flex-shrink: 0; white-space: nowrap; }
@media (max-width: 600px) {
  .quick-entry { flex: 0 0 auto; }
  .path-row { overflow-x: auto; justify-content: flex-start; gap: 10px; }
  .path-row :deep(.path-node) { flex-shrink: 0; min-width: 72px; }
}
</style>
