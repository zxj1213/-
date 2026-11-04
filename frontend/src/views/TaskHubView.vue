<template>
  <div class="page">
    <!-- ============ AI 对话模式(全屏桌面布局) ============ -->
    <div v-if="isChatMode" class="chat-mode">
      <div class="chat-header">
        <span class="back" @click="isChatMode = false">‹</span>
        <DigitalHuman :state="digitalHuman" @activate="onHumanActivate" />
        <div class="chat-title">
          <div class="ct-name">学迹AI助手</div>
          <div class="ct-state">{{ digitalHuman.isSpeaking ? '正在思考...' : '随时为你服务 · 大模型API优先，规则引擎兜底' }}</div>
        </div>
        <span class="chat-more" @click="showHistory = true">···</span>
      </div>

      <div class="chat-body" ref="chatBodyRef">
        <div class="chat-body-inner">
          <ChatBubble v-for="msg in store.chatMessages" :key="msg.id" :message="msg" />
          <div v-if="digitalHuman.isSpeaking" class="thinking-row">
            <span class="thinking-dots"><span></span><span></span><span></span></span>
            <span class="thinking-text">AI正在分析...</span>
          </div>
        </div>
      </div>

      <div class="chat-input">
        <span class="ci-icon" @click="onAttach">⊕</span>
        <el-input
          v-model="inputText"
          placeholder="输入任务描述或发送截图..."
          @keyup.enter="onSendMessage"
        />
        <span class="ci-icon" @click="onVoice">🎤</span>
        <el-button type="primary" circle size="small" :disabled="!inputText.trim()" @click="onSendMessage">
          <el-icon><Top /></el-icon>
        </el-button>
      </div>
    </div>

    <!-- ============ 任务列表模式 ============ -->
    <template v-else>
      <!-- 工具栏 -->
      <div class="toolbar card">
        <div class="tb-title">
          <span class="tb-t">任务管理</span>
          <span class="tb-sub">{{ formatDateCN(today) }} · 今日 {{ store.pendingTasks.length }} 个待办 · {{ todayCourses.length }} 门课程</span>
        </div>
        <div class="tb-actions">
          <el-button type="primary" round @click="showAddTask = true">
            <el-icon><Plus /></el-icon>&nbsp;添加任务
          </el-button>
          <el-button round plain type="primary" @click="showOcr = true">
            📷&nbsp;OCR识别
          </el-button>
          <el-button round plain style="color: var(--secondary); border-color: var(--secondary)" @click="isChatMode = true">
            💬&nbsp;AI对话
          </el-button>
        </div>
      </div>

      <div class="grid-main-side">
        <!-- 左侧：筛选 + 任务列表 -->
        <div>
          <div class="chip-scroll filter-row">
            <span
              v-for="f in filters"
              :key="f"
              class="chip"
              :class="{ active: activeFilter === f }"
              @click="activeFilter = f"
            >{{ f }}</span>
          </div>

          <div class="task-list">
            <TaskCard
              v-for="task in filteredTasks"
              :key="task.id"
              :task="task"
              @toggle-task="(tid) => store.toggleTask(tid)"
              @toggle-sub="(tid, sid) => store.toggleSubTask(tid, sid)"
              @complete="(tid) => store.completeTask(tid)"
              @focus="onFocusTask"
            />
            <div v-if="!filteredTasks.length" class="empty-state card">
              <span class="icon">✅</span>
              <span>没有筛选结果</span>
              <span style="font-size: calc(0.6875rem * var(--font-scale)); line-height: 19.36px">当前筛选条件下没有任务</span>
            </div>
          </div>
        </div>

        <!-- 右侧：今日聚合 + AI 建议 -->
        <div class="side-col">
          <div class="card agenda">
            <div class="card-title">
              <span class="t">📅 今日聚合</span>
              <el-badge :value="aiSuggestions.length" type="primary">
                <span class="agenda-bulb">💡</span>
              </el-badge>
            </div>
            <div class="agenda-block">
              <div class="ag-title">📚 课程</div>
              <div v-for="c in todayCourses" :key="c.id" class="ag-item">
                {{ c.courseName }} <span class="ag-meta">{{ c.startTime }}-{{ c.endTime }} · {{ c.classroom }}</span>
              </div>
              <div v-if="!todayCourses.length" class="ag-meta">无课程安排</div>
            </div>
            <div class="agenda-block">
              <div class="ag-title">🎯 考试倒计时</div>
              <div v-for="e in todayAgenda?.examCountdowns || []" :key="e.id" class="ag-item">
                {{ e.examName }} <span class="ag-meta">还有 {{ e.daysLeft }} 天</span>
              </div>
            </div>
          </div>

          <div class="card ai-suggestions-card">
            <div class="card-title">
              <span class="t">✨ AI 建议</span>
              <span class="more" @click="showSuggestions = !showSuggestions">
                {{ showSuggestions ? '收起' : '展开全部' }}
              </span>
            </div>
            <div class="as-item">💡 {{ aiSuggestions[0] || '暂无建议' }}</div>
            <template v-if="showSuggestions">
              <div v-for="(s, i) in aiSuggestions.slice(1)" :key="i" class="as-item">💡 {{ s }}</div>
            </template>
          </div>
        </div>
      </div>
    </template>

    <!-- ============ 添加任务弹窗 ============ -->
    <el-dialog v-model="showAddTask" title="添加新任务" width="min(88%, 680px)" align-center>
      <el-form :model="taskForm" label-position="top" @submit.prevent="createTask">
        <el-form-item label="任务名称" required>
          <el-input v-model="taskForm.title" placeholder="例如：完成数据结构实验报告" aria-label="任务名称" />
        </el-form-item>
        <el-form-item label="任务截止时间" required>
          <el-date-picker v-model="taskForm.deadline" type="datetime" value-format="YYYY-MM-DD HH:mm"
            format="YYYY-MM-DD HH:mm" placeholder="选择截止日期和时间" aria-label="任务截止时间" style="width: 100%" />
        </el-form-item>
        <el-form-item required>
          <template #label><span>任务内容</span><span class="content-count">{{ taskForm.contents.length }}/10</span></template>
          <div class="task-content-list">
            <div v-for="(_, index) in taskForm.contents" :key="index" class="task-content-row">
              <el-input v-model="taskForm.contents[index]" type="textarea" :autosize="{ minRows: 2, maxRows: 5 }"
                :placeholder="`填写第${index + 1}项任务内容`" :aria-label="`任务内容${index + 1}`" />
              <div class="content-actions">
                <el-button circle :disabled="taskForm.contents.length >= 10" :aria-label="`在第${index + 1}项后增加内容`" @click="addTaskContent(index)">
                  <el-icon><Plus /></el-icon>
                </el-button>
                <el-button v-if="taskForm.contents.length > 1" circle :aria-label="`删除第${index + 1}项内容`" @click="removeTaskContent(index)">
                  <el-icon><Minus /></el-icon>
                </el-button>
              </div>
            </div>
          </div>
        </el-form-item>
      </el-form>
      <div class="priority-preview">
        <div>紧急程度：<b>{{ taskForm.deadline ? taskPriority : '选择截止时间后自动计算' }}</b></div>
        <div class="dialog-hint">≤1天：紧急 · ≤3天：高 · ≤7天：中 · &gt;7天：低（1天为24小时）</div>
        <div class="dialog-hint">每项内容将保存为可勾选的子任务，最多10项。</div>
      </div>
      <template #footer>
        <el-button @click="showAddTask = false">取消</el-button>
        <el-button type="primary" @click="createTask">创建任务</el-button>
      </template>
    </el-dialog>

    <!-- ============ OCR 识别弹窗 ============ -->
    <el-dialog v-model="showOcr" title="OCR 智能识别" width="88%" align-center>
      <div class="dialog-hint">上传课程/任务截图（QQ、微信、雨课堂等），AI 自动提取任务信息</div>
      <div class="ocr-upload" @click="pickUpload">
        <input ref="uploadFile" type="file" accept="image/*" hidden @change="onOcrFile" />
        <div v-if="!ocrProcessing && !ocrResult" class="ocr-placeholder">
          <div class="op-icon">📷</div>
          <div class="op-text">点击选择截图文件</div>
          <div class="op-sub">支持 jpg / png，后端在线时调用大模型识别</div>
        </div>
        <div v-else-if="ocrProcessing" class="ocr-processing">
          <el-icon class="is-loading" :size="30"><Loading /></el-icon>
          <div class="op-text">AI 正在识别图片中的文字...</div>
        </div>
        <div v-else class="ocr-result">
          <pre class="or-text">{{ ocrResult.recognizedText }}</pre>
        </div>
      </div>
      <template #footer>
        <el-button @click="showOcr = false">取消</el-button>
        <el-button type="primary" :disabled="!ocrResult || creatingOcrTasks" @click="createOcrTasks">
          创建 {{ ocrResult?.tasks?.length || 0 }} 个任务
        </el-button>
      </template>
    </el-dialog>

    <!-- ============ 聊天历史 ============ -->
    <el-dialog v-model="showHistory" title="聊天记录" width="88%" align-center>
      <div class="history-list">
        <ChatBubble v-for="msg in store.chatMessages" :key="msg.id" :message="msg" />
        <el-empty v-if="!store.chatMessages.length" description="暂无聊天记录" :image-size="60" />
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, nextTick, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAppStore } from '../store'
import { todayStr, nowStr, formatDateCN, generateId, getTaskPriority, taskDeadlineTime } from '../constants'
import { chatWithAI, ocrRecognize } from '../services/api'
import TaskCard from '../components/TaskCard.vue'
import ChatBubble from '../components/ChatBubble.vue'
import DigitalHuman from '../components/DigitalHuman.vue'

const store = useAppStore()
const route = useRoute()
const router = useRouter()

const today = todayStr()
const isChatMode = ref(false)
const inputText = ref('')
const chatBodyRef = ref(null)
const activeFilter = ref('全部')
const showAddTask = ref(false)
const taskForm = reactive({ title: '', deadline: '', contents: [''] })
const showOcr = ref(false)
const ocrProcessing = ref(false)
const ocrResult = ref(null)
const creatingOcrTasks = ref(false)
const showHistory = ref(false)
const showSuggestions = ref(false)
const uploadFile = ref(null)

const digitalHuman = ref({
  isActive: true,
  isSpeaking: false,
  currentEmotion: 'neutral'
})

const filters = ['全部', '待完成', '已完成', '紧急']

const todayCourses = computed(() => store.todayAgenda?.courses || [])
const todayAgenda = computed(() => store.todayAgenda)
const aiSuggestions = computed(() => store.todayAgenda?.aiSuggestions || [])

const filteredTasks = computed(() => {
  const tasks = store.tasks
  if (activeFilter.value === '全部') return tasks
  if (activeFilter.value === '待完成') return tasks.filter(t => t.status !== '已完成')
  if (activeFilter.value === '已完成') return tasks.filter(t => t.status === '已完成')
  if (activeFilter.value === '紧急') return tasks.filter(t => t.priority === '紧急')
  return tasks
})

const taskPriority = computed(() => getTaskPriority(taskForm.deadline, store.taskPriorityNow))

onMounted(() => {
  // 顶栏 AI助手 入口 → 直接进入对话模式
  if (route.query.chat === '1') {
    isChatMode.value = true
    router.replace({ path: '/tasks' })
  }
})

watch(isChatMode, async (v) => {
  if (v) {
    await nextTick()
    scrollChatToBottom()
  }
})

function scrollChatToBottom() {
  if (chatBodyRef.value) chatBodyRef.value.scrollTop = chatBodyRef.value.scrollHeight
}

async function onSendMessage() {
  const text = inputText.value.trim()
  if (!text) return
  store.pushChatMessage({ id: generateId(), role: 'user', content: text, timestamp: nowStr() })
  inputText.value = ''
  digitalHuman.value.isSpeaking = true
  digitalHuman.value.currentEmotion = 'thinking'
  await nextTick()
  scrollChatToBottom()

  const ctx = {
    tasks: store.tasks,
    courses: store.courses,
    exams: store.exams,
    todayAgenda: store.todayAgenda
  }
  const { reply, engine } = await chatWithAI(text, ctx, store.chatMessages)
  store.pushChatMessage({ id: generateId(), role: 'assistant', content: reply, timestamp: nowStr() })
  digitalHuman.value.isSpeaking = false
  digitalHuman.value.currentEmotion = 'happy'
  setTimeout(() => { digitalHuman.value.currentEmotion = 'neutral' }, 2000)
  await nextTick()
  scrollChatToBottom()
  if (engine === 'llm') {
    ElMessage.success('已通过大模型 API 回复')
  }
}

function onHumanActivate() {
  digitalHuman.value.currentEmotion = 'happy'
  setTimeout(() => { digitalHuman.value.currentEmotion = 'neutral' }, 2000)
}

function onAttach() {
  ElMessage.info('选择附件：截图/文档/语音')
}

function onVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition
  if (SR) {
    const rec = new SR()
    rec.lang = 'zh-CN'
    rec.onresult = (e) => { inputText.value = e.results[0][0].transcript }
    rec.start()
    ElMessage.info('请开始说话...')
  } else {
    ElMessage.info('当前浏览器不支持语音输入，可用文字输入')
  }
}

function addTaskContent(index) {
  if (taskForm.contents.length >= 10) return
  taskForm.contents.splice(index + 1, 0, '')
}

function removeTaskContent(index) {
  if (taskForm.contents.length <= 1) return
  taskForm.contents.splice(index, 1)
}

function createTask() {
  const title = taskForm.title.trim()
  const contents = taskForm.contents.map(content => content.trim())
  if (!title) return ElMessage.warning('请填写任务名称')
  if (!Number.isFinite(taskDeadlineTime(taskForm.deadline))) return ElMessage.warning('请选择有效的任务截止时间')
  if (!contents.length || contents.length > 10 || contents.some(content => !content)) {
    return ElMessage.warning('请填写每项任务内容，最多10项；多余空框可点击减号删除')
  }
  store.addTask({
    title,
    deadline: taskForm.deadline,
    description: contents.join('\n'),
    source: '手动添加',
    category: '其他',
    priority: getTaskPriority(taskForm.deadline),
    status: '待完成',
    estimatedDuration: 60,
    attachments: [],
    tags: [],
    subTasks: contents.map(content => ({ id: generateId(), title: content, completed: false }))
  })
  showAddTask.value = false
  Object.assign(taskForm, { title: '', deadline: '', contents: [''] })
  ElMessage.success('任务已添加 ✓')
}

function pickUpload() {
  uploadFile.value?.click()
}

async function onOcrFile(e) {
  const file = e.target.files[0]
  if (!file) return
  ocrProcessing.value = true
  ocrResult.value = null
  try {
    const result = await ocrRecognize(file, file.name)
    ocrResult.value = result
  } finally {
    ocrProcessing.value = false
  }
}

function createOcrTasks() {
  if (!ocrResult.value) return
  creatingOcrTasks.value = true
  const count = (ocrResult.value.tasks || []).length
  for (const t of ocrResult.value.tasks || []) {
    store.addTask({
      title: t.title,
      description: `来自截图识别：${t.title}`,
      source: 'OCR识别',
      category: t.category || '作业',
      priority: t.priority || '中',
      status: '待完成',
      deadline: t.deadline || `${todayStr()} 23:59`,
      estimatedDuration: 60,
      attachments: [],
      subTasks: [],
      tags: ['OCR']
    })
  }
  creatingOcrTasks.value = false
  showOcr.value = false
  ocrResult.value = null
  ElMessage.success(`已创建 ${count} 个任务 ✓`)
}

function onFocusTask(task) {
  router.push({ path: '/', query: { focus: task.id } })
}
</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: var(--section-gap);
}

/* 工具栏 */
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.tb-t {
  font-size: calc(1.125rem * var(--font-scale));
  font-weight: bold;
  color: var(--text-primary);
  line-height: 31.68px;
}

.tb-sub {
  font-size: calc(0.75rem * var(--font-scale));
  color: var(--text-hint);
  margin-left: 10px;
  line-height: 21.12px;
}

.tb-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.filter-row {
  margin-bottom: 12px;
}

/* 右侧栏 */
.side-col {
  display: flex;
  flex-direction: column;
  gap: var(--grid-gap);
}

.agenda-bulb {
  font-size: calc(1.25rem * var(--font-scale));
  cursor: pointer;
  line-height: 35.2px;
}

.agenda-block {
  padding: 8px 0;
  border-bottom: 1px solid var(--divider);
}

.agenda-block:last-child {
  border-bottom: none;
}

.ag-title {
  font-size: calc(0.75rem * var(--font-scale));
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 6px;
  line-height: 21.12px;
}

.ag-item {
  font-size: calc(0.75rem * var(--font-scale));
  color: var(--text-primary);
  line-height: 25.08px;
}

.ag-meta {
  font-size: calc(0.6875rem * var(--font-scale));
  color: var(--text-hint);
  line-height: 19.36px;
}

.ai-suggestions-card .as-item {
  font-size: calc(0.75rem * var(--font-scale));
  color: var(--text-secondary);
  line-height: 22.44px;
  padding: 4px 0;
}

.dialog-hint {
  font-size: calc(0.75rem * var(--font-scale));
  color: var(--text-hint);
  line-height: 21.12px;
}

.priority-preview {
  margin-top: 10px;
  background: var(--bg-primary);
  border-radius: 8px;
  padding: 10px;
  font-size: calc(0.75rem * var(--font-scale));
  color: var(--text-secondary);
  line-height: 21.12px;
}

.priority-preview .dialog-hint {
  margin-top: 6px;
}

.task-content-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}

.task-content-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.task-content-row > .el-textarea { flex: 1; min-width: 0; }
.content-actions { display: flex; flex-direction: column; gap: 6px; }
.content-actions .el-button + .el-button { margin-left: 0; }
.content-count { margin-left: 8px; color: var(--text-secondary); font-size: calc(0.75rem * var(--font-scale)); line-height: 21.12px; }

.ocr-upload {
  margin-top: 10px;
  min-height: 160px;
  border: 1.5px dashed var(--divider);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 16px;
}

.ocr-placeholder,
.ocr-processing {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.op-icon {
  font-size: calc(2.25rem * var(--font-scale));
  line-height: 63.36px;
}

.op-text {
  font-size: calc(0.8125rem * var(--font-scale));
  color: var(--text-secondary);
  line-height: 22.88px;
}

.op-sub {
  font-size: calc(0.6875rem * var(--font-scale));
  color: var(--text-hint);
  line-height: 19.36px;
}

.ocr-result {
  width: 100%;
}

.or-text {
  font-size: calc(0.75rem * var(--font-scale));
  color: var(--text-primary);
  white-space: pre-wrap;
  line-height: 21.12px;
  font-family: inherit;
}

.history-list {
  max-height: 60vh;
  overflow-y: auto;
}

/* 对话模式(全屏) */
.chat-mode {
  display: flex;
  flex-direction: column;
  height: calc(100dvh - var(--header-height) - 88px);
  min-height: 420px;
  border: 1px solid var(--divider);
  background: var(--bg-primary);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: var(--shadow);
}

.chat-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 20px 24px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--divider);
}

.back {
  font-size: calc(1.625rem * var(--font-scale));
  cursor: pointer;
  color: var(--text-primary);
  line-height: 45.76px;
}

.chat-title {
  flex: 1;
}

.ct-name {
  font-size: calc(1rem * var(--font-scale));
  font-weight: bold;
  color: var(--text-primary);
  line-height: 28.16px;
}

.ct-state {
  font-size: calc(0.6875rem * var(--font-scale));
  color: var(--text-hint);
  line-height: 19.36px;
}

.chat-more {
  font-size: calc(1.125rem * var(--font-scale));
  cursor: pointer;
  color: var(--text-secondary);
  padding: 4px 8px;
  line-height: 31.68px;
}

.chat-body {
  flex: 1;
  overflow-y: auto;
  scrollbar-width: none;
}

.chat-body::-webkit-scrollbar {
  display: none;
}

.chat-body-inner {
  max-width: 860px;
  margin: 0 auto;
  padding: 24px;
  gap: 16px;
  display: flex;
  flex-direction: column;
}

.thinking-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0 8px;
}

.thinking-text {
  font-size: calc(0.75rem * var(--font-scale));
  color: var(--text-hint);
  line-height: 21.12px;
}

.chat-input {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  background: var(--bg-secondary);
  border-top: 1px solid var(--divider);
}

.chat-input .el-input {
  max-width: 860px;
}

.ci-icon {
  font-size: calc(1.25rem * var(--font-scale));
  cursor: pointer;
  color: var(--text-secondary);
  line-height: 35.2px;
}
</style>
