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
              <span style="font-size: 11px">当前筛选条件下没有任务</span>
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

    <!-- ============ 添加任务弹窗(AI解析) ============ -->
    <el-dialog v-model="showAddTask" title="添加新任务" width="88%" align-center>
      <div class="dialog-hint">输入或粘贴任务描述，AI 将自动识别任务信息</div>
      <el-input
        v-model="addTaskText"
        type="textarea"
        :rows="4"
        placeholder="例如：下周一下午5点前交数据结构实验报告，第三章的课后题"
        style="margin-top: 10px"
      />
      <div v-if="parsePreview" class="parse-preview">
        <div class="pp-title">🤖 AI 识别结果：</div>
        <div class="pp-line">优先级：<b>{{ parsePreview.priority }}</b></div>
        <div class="pp-line">分类：<b>{{ parsePreview.category }}</b></div>
        <div class="pp-line">截止时间：<b>{{ parsePreview.deadline }}</b></div>
        <div class="pp-line">预计耗时：<b>{{ Math.floor(parsePreview.estimatedDuration / 60) }}小时{{ parsePreview.estimatedDuration % 60 }}分钟</b></div>
      </div>
      <template #footer>
        <el-button @click="showAddTask = false">取消</el-button>
        <el-button type="primary" @click="createTaskFromText">AI 解析创建</el-button>
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
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAppStore } from '../store'
import { todayStr, nowStr, formatDateCN, generateId } from '../constants'
import { parseTaskFromText } from '../services/ai'
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
const addTaskText = ref('')
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
  if (activeFilter.value === '紧急') return tasks.filter(t => t.priority === '紧急' || t.priority === '高')
  return tasks
})

const parsePreview = computed(() => {
  if (!addTaskText.value.trim()) return null
  return parseTaskFromText(addTaskText.value)
})

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

function createTaskFromText() {
  if (!addTaskText.value.trim()) return
  const parsed = parseTaskFromText(addTaskText.value)
  store.addTask({ ...parsed, id: undefined, createdAt: undefined, updatedAt: undefined })
  showAddTask.value = false
  addTaskText.value = ''
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
  gap: 16px;
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
  font-size: 18px;
  font-weight: bold;
  color: var(--text-primary);
}

.tb-sub {
  font-size: 12px;
  color: var(--text-hint);
  margin-left: 10px;
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
  gap: 16px;
}

.agenda-bulb {
  font-size: 20px;
  cursor: pointer;
}

.agenda-block {
  padding: 8px 0;
  border-bottom: 1px solid var(--divider);
}

.agenda-block:last-child {
  border-bottom: none;
}

.ag-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.ag-item {
  font-size: 12px;
  color: var(--text-primary);
  line-height: 1.9;
}

.ag-meta {
  font-size: 11px;
  color: var(--text-hint);
}

.ai-suggestions-card .as-item {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.7;
  padding: 4px 0;
}

.dialog-hint {
  font-size: 12px;
  color: var(--text-hint);
}

.parse-preview {
  margin-top: 10px;
  background: var(--bg-primary);
  border-radius: 8px;
  padding: 10px;
  font-size: 12px;
  color: var(--text-secondary);
}

.pp-title {
  font-weight: bold;
  color: var(--primary);
  margin-bottom: 4px;
}

.pp-line {
  line-height: 1.8;
}

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
  font-size: 36px;
}

.op-text {
  font-size: 13px;
  color: var(--text-secondary);
}

.op-sub {
  font-size: 11px;
  color: var(--text-hint);
}

.ocr-result {
  width: 100%;
}

.or-text {
  font-size: 12px;
  color: var(--text-primary);
  white-space: pre-wrap;
  line-height: 1.6;
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
  height: calc(100dvh - var(--header-height) - 52px);
  background: var(--bg-primary);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: var(--shadow);
}

.chat-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 20px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--divider);
}

.back {
  font-size: 26px;
  cursor: pointer;
  color: var(--text-primary);
}

.chat-title {
  flex: 1;
}

.ct-name {
  font-size: 16px;
  font-weight: bold;
  color: var(--text-primary);
}

.ct-state {
  font-size: 11px;
  color: var(--text-hint);
}

.chat-more {
  font-size: 18px;
  cursor: pointer;
  color: var(--text-secondary);
  padding: 4px 8px;
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
  padding: 16px 24px;
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
  font-size: 12px;
  color: var(--text-hint);
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
  font-size: 20px;
  cursor: pointer;
  color: var(--text-secondary);
}
</style>
