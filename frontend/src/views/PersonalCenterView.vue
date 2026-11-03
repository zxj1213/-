<template>
  <div class="page">
    <!-- 用户头部 -->
    <div class="card user-head">
      <div class="avatar" @click="showEdit = true">👤</div>
      <div class="uh-body" @click="showEdit = true">
        <div class="uh-name">{{ store.userInfo?.name }} <span class="uh-edit">›</span></div>
        <div class="uh-school">{{ store.userInfo?.school }} · {{ store.userInfo?.major }}</div>
        <div class="uh-id">学号: {{ store.userInfo?.studentId }} · {{ grade }} · {{ store.userInfo?.email }}</div>
      </div>
      <el-button round plain type="primary" @click="showEdit = true">编辑资料</el-button>
    </div>

    <div class="grid-2">
      <!-- 桌面服务卡片预览 -->
      <div class="card">
        <div class="card-title">
          <span class="t">桌面服务卡片</span>
          <el-button size="small" round plain type="primary">添加到桌面</el-button>
        </div>
        <div class="widget">
          <span class="widget-badge">今日概览</span>
          <div class="widget-stats">
            <div class="ws-item">
              <div class="ws-emoji">📚</div>
              <div class="ws-v">{{ todayCourses }}门</div>
              <div class="ws-k">课程</div>
            </div>
            <div class="ws-item">
              <div class="ws-emoji">☑</div>
              <div class="ws-v">{{ pendingCount }}项</div>
              <div class="ws-k">待办</div>
            </div>
            <div class="ws-item">
              <div class="ws-emoji">📆</div>
              <div class="ws-v">{{ nearestExamDays }}天</div>
              <div class="ws-k">考试</div>
            </div>
            <div class="ws-item">
              <div class="ws-emoji">⏱️</div>
              <div class="ws-v">{{ todayMinutes }}min</div>
              <div class="ws-k">专注</div>
            </div>
          </div>
          <div class="widget-toggles">
            <el-checkbox v-model="store.widgetConfig.showTodayCourses" size="small" @change="store.save()">今日课程</el-checkbox>
            <el-checkbox v-model="store.widgetConfig.showTasks" size="small" @change="store.save()">待办任务</el-checkbox>
            <el-checkbox v-model="store.widgetConfig.showExamCountdown" size="small" @change="store.save()">考试倒计时</el-checkbox>
            <el-checkbox v-model="store.widgetConfig.showDailyReview" size="small" @change="store.save()">每日复盘</el-checkbox>
          </div>
        </div>
      </div>

      <!-- 设备展示（演示） -->
      <div class="card">
        <div class="card-title">
          <span class="t">设备展示（演示）</span>
          <span class="more">{{ devices.filter(d => d.isConnected).length }}台示例设备</span>
        </div>
        <div class="devices">
          <div v-for="device in devices" :key="device.deviceId" class="device">
            <div class="device-icon" :class="{ connected: device.isConnected }">
              {{ device.deviceType === 'pc' ? '💻' : '📱' }}
            </div>
            <div class="device-name">{{ device.deviceName }}</div>
            <div class="device-status">
              <span class="dot" :class="{ on: device.isConnected }"></span>
              {{ device.isConnected ? '示例连接状态' : '未连接' }}
            </div>
            <div class="device-sync">{{ device.lastSyncTime }}</div>
          </div>
        </div>
        <div class="device-note">
          ℹ 当前为本地演示，数据仅保存在此浏览器，尚未接入跨设备同步。
        </div>
      </div>
    </div>

    <!-- 账号与数据(A2：本地账号、数据隔离、导出/删除/退出) -->
    <div class="card account-card">
      <div class="card-title">
        <span class="t">🔑 账号与数据</span>
        <span class="tag" style="background: #4CAF5015; color: #4CAF50">本地演示账号</span>
      </div>
      <div class="ac-info">
        当前账号：<b>{{ store.currentUserName }}</b> · 数据按用户隔离存储在本机浏览器（localStorage）
        ，不同账号之间互不可见。生产环境由服务端完成权限隔离。
      </div>
      <div class="ac-actions">
        <el-button round plain @click="configureBackend">连接受保护的 AI 服务</el-button>
        <el-button round plain type="primary" @click="doExport">📦 导出数据</el-button>
        <el-button round plain type="danger" @click="doDelete">🗑 删除全部数据</el-button>
        <el-button round plain type="warning" @click="doLogout">🚪 退出登录</el-button>
      </div>
    </div>

    <div class="grid-2">
      <!-- 设置 -->
      <div class="card settings">
        <div class="settings-title">设置</div>
        <div class="setting-item" @click="cycleTheme">
          <span class="si-emoji">🌙</span>
          <div class="si-body">
            <div class="si-title">主题模式</div>
            <div class="si-sub">{{ themeLabel }}</div>
          </div>
          <span class="si-arrow">›</span>
        </div>
        <el-divider style="margin: 0" />
        <div class="setting-item" @click="cycleFontSize">
          <span class="si-emoji">📐</span>
          <div class="si-body">
            <div class="si-title">字体大小</div>
            <div class="si-sub">{{ fontSizeLabel }}</div>
          </div>
          <span class="si-arrow">›</span>
        </div>
        <el-divider style="margin: 0" />
        <div class="setting-item">
          <span class="si-emoji">🔔</span>
          <div class="si-body">
            <div class="si-title">通知</div>
            <div class="si-sub">{{ store.settings.notificationEnabled ? '已开启' : '已关闭' }}</div>
          </div>
          <el-switch v-model="store.settings.notificationEnabled" @change="store.save()" />
        </div>
        <el-divider style="margin: 0" />
        <div class="setting-item">
          <span class="si-emoji">📶</span>
          <div class="si-body">
            <div class="si-title">AI语音交互</div>
            <div class="si-sub">{{ store.settings.voiceEnabled ? '已开启' : '已关闭' }}</div>
          </div>
          <el-switch v-model="store.settings.voiceEnabled" @change="store.save()" />
        </div>
        <el-divider style="margin: 0" />
        <div class="setting-item">
          <span class="si-emoji">☁</span>
          <div class="si-body">
            <div class="si-title">跨设备同步（尚未接入）</div>
            <div class="si-sub">当前仅本地保存</div>
          </div>
          <el-switch disabled :model-value="false" @change="store.save()" />
        </div>
        <el-divider style="margin: 0" />
        <div class="setting-item">
          <span class="si-emoji">🛡</span>
          <div class="si-body">
            <div class="si-title">隐私模式</div>
            <div class="si-sub">{{ store.settings.privacyMode ? '已开启' : '已关闭' }}</div>
          </div>
          <el-switch v-model="store.settings.privacyMode" @change="store.save()" />
        </div>
      </div>

      <!-- 加密私有库 -->
      <div class="card">
        <div class="card-title">
          <span class="t">🔒 本地资料库（演示）</span>
          <span class="tag" :style="authStyle">{{ store.authState.isAuthenticated ? '已认证' : '未认证' }}</span>
        </div>
        <div class="lib-desc">
          数据以未加密形式保存在本机浏览器。此处密码校验仅用于演示界面解锁，不提供安全隔离。
        </div>
        <div class="lib-actions" v-if="!libraryUnlocked">
          <el-button type="warning" round disabled>
            <el-icon><View /></el-icon>&nbsp;面容认证（尚未接入）
          </el-button>
          <el-button round plain type="primary" @click="showPassword = true">
            🔒&nbsp;密码认证
          </el-button>
        </div>
        <div class="lib-actions" v-else>
          <span class="lib-unlocked">🔓 私有库已解锁 · 可查看</span>
          <el-button size="small" round @click="libraryUnlocked = false">锁定</el-button>
        </div>
      </div>
    </div>

    <!-- 关于 -->
    <div class="card settings">
      <div class="settings-title">关于</div>
      <div class="about-grid">
        <div class="about-item"><span>应用名称</span><span>学迹 StudyFlow</span></div>
        <div class="about-item"><span>版本号</span><span>1.0.0</span></div>
        <div class="about-item"><span>技术栈</span><span>Vue 3 + Element Plus / FastAPI</span></div>
        <div class="about-item"><span>AI能力</span><span>大模型API + 规则引擎</span></div>
        <div class="about-item"><span>数据存储</span><span>localStorage(演示) / MySQL</span></div>
        <div class="about-item link" @click="resetAll"><span>重置演示数据</span><span style="color: var(--error)">恢复初始状态</span></div>
      </div>
    </div>

    <!-- 编辑资料弹窗 -->
    <el-dialog v-model="showEdit" title="编辑个人资料" width="88%" align-center>
      <div class="edit-row"><span class="er-label">姓名</span><el-input v-model="editForm.name" size="small" /></div>
      <div class="edit-row"><span class="er-label">学校</span><el-input v-model="editForm.school" size="small" /></div>
      <div class="edit-row"><span class="er-label">专业</span><el-input v-model="editForm.major" size="small" /></div>
      <div class="edit-row"><span class="er-label">学号</span><el-input v-model="editForm.studentId" size="small" /></div>
      <template #footer>
        <el-button @click="showEdit = false">取消</el-button>
        <el-button type="primary" @click="saveProfile">保存</el-button>
      </template>
    </el-dialog>

    <!-- 密码认证弹窗 -->
    <el-dialog v-model="showPassword" title="密码认证" width="80%" align-center>
      <el-input v-model="passwordInput" type="password" placeholder="请输入私有库密码" show-password />
      <template #footer>
        <el-button @click="showPassword = false">取消</el-button>
        <el-button type="primary" @click="passwordAuth">解锁</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, reactive } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { setApiToken } from '../services/api'
import { useAppStore } from '../store'
import { todayStr, daysBetween } from '../constants'

const store = useAppStore()

const devices = [
  { deviceId: 'device_001', deviceType: 'phone', deviceName: 'Mate 70 Pro', isConnected: true, lastSyncTime: '刚刚' },
  { deviceId: 'device_002', deviceType: 'tablet', deviceName: 'MatePad Pro', isConnected: true, lastSyncTime: '2分钟前' },
  { deviceId: 'device_003', deviceType: 'pc', deviceName: 'MateBook X Pro', isConnected: false, lastSyncTime: '2小时前' }
]

const libraryUnlocked = ref(false)
const showEdit = ref(false)
const showPassword = ref(false)
const passwordInput = ref('')
const editForm = reactive({ name: '', school: '', major: '', studentId: '' })

const grade = computed(() => {
  const diff = new Date().getFullYear() - (store.userInfo?.enrollmentYear || 2024)
  const grades = ['大一', '大二', '大三', '大四']
  return grades[Math.min(Math.max(diff, 0), 3)]
})

const todayCourses = computed(() => store.todayAgenda?.courses?.length ?? 2)
const pendingCount = computed(() => store.pendingTasks.length)

const todayMinutes = computed(() =>
  store.sessionLogs
    .filter(l => l.date === todayStr())
    .reduce((a, b) => a + b.minutes, 0)
)

const nearestExamDays = computed(() => {
  const days = store.exams
    .map(e => daysBetween(todayStr(), e.date.slice(0, 10)))
    .filter(d => d >= 0)
  return days.length ? Math.min(...days) : '—'
})

const themeLabel = computed(() =>
  store.settings.theme === 'auto' ? '跟随系统' : store.settings.theme === 'dark' ? '深色模式' : '浅色模式'
)

const fontSizeLabel = computed(() =>
  store.settings.fontSize === 'small' ? '小号' : store.settings.fontSize === 'large' ? '大号' : '标准'
)

const authStyle = computed(() => ({
  background: store.authState.isAuthenticated ? '#4CAF5015' : '#F4433615',
  color: store.authState.isAuthenticated ? '#4CAF50' : '#F44336'
}))

function cycleTheme() {
  const next = { light: 'dark', dark: 'auto', auto: 'light' }[store.settings.theme] || 'light'
  store.updateSettings({ theme: next })
  ElMessage.success(`主题: ${themeLabel.value}`)
}

function cycleFontSize() {
  const next = { small: 'medium', medium: 'large', large: 'small' }[store.settings.fontSize] || 'medium'
  store.updateSettings({ fontSize: next })
  ElMessage.success(`字体: ${fontSizeLabel.value}`)
}

async function configureBackend() {
  try {
    const { value } = await ElMessageBox.prompt('输入服务管理员配置的访问令牌，仅此标签页使用。', '连接 AI 服务', { inputType: 'password' })
    setApiToken(value)
    ElMessage.info('访问令牌已设置，下一次 AI 请求将使用此凭据。')
  } catch { /* 取消 */ }
}

function passwordAuth() {
  if (!store.verifyLocalPassword(passwordInput.value)) {
    ElMessage.warning('账号密码错误')
    return
  }
  libraryUnlocked.value = true
  store.unlockPrivateLibrary()
  showPassword.value = false
  passwordInput.value = ''
  ElMessage.success('认证成功！私有库已解锁')
}

function saveProfile() {
  store.updateProfile({ ...editForm })
  showEdit.value = false
  ElMessage.success('资料已更新')
}

function resetAll() {
  ElMessageBox.confirm('确定要重置所有演示数据吗？', '重置数据', {
    confirmButtonText: '重置',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    store.resetData()
    ElMessage.success('已恢复初始演示数据')
  }).catch(() => {})
}

function doExport() {
  store.exportData()
  ElMessage.success('数据已导出为 JSON 文件')
}

function doDelete() {
  ElMessageBox.confirm(
    '将删除当前账号的全部学习数据（任务/计划/测验记录/专注记录），且不可恢复。确定继续？',
    '删除全部数据',
    { confirmButtonText: '删除', cancelButtonText: '取消', type: 'error' }
  ).then(() => {
    store.deleteData()
    ElMessage.success('数据已删除')
  }).catch(() => {})
}

function doLogout() {
  ElMessageBox.confirm('退出登录？数据将保留在本机，下次登录同一账号即可恢复。', '退出登录', {
    confirmButtonText: '退出',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    store.logout()
  }).catch(() => {})
}
</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: var(--section-gap);
}

.account-card {
  margin-bottom: 0;
}

.ac-info {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.7;
}

.ac-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  flex-wrap: wrap;
}

.user-head {
  display: flex;
  align-items: center;
  gap: 16px;
}

.avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 34px;
  cursor: pointer;
  flex-shrink: 0;
}

.uh-body {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
  cursor: pointer;
}

.uh-name {
  font-size: 21px;
  font-weight: bold;
  color: var(--text-primary);
}

.uh-edit {
  font-size: 16px;
  color: var(--text-hint);
}

.uh-school {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 4px;
}

.uh-id {
  font-size: 11px;
  color: var(--text-hint);
  margin-top: 2px;
}

.widget {
  background: var(--primary-dark);
  border-radius: 12px;
  padding: 16px;
}

.widget-badge {
  display: inline-block;
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  background: var(--primary);
  padding: 3px 8px;
  border-radius: 8px;
}

.widget-stats {
  display: flex;
  margin-top: 10px;
}

.ws-item {
  flex: 1;
  text-align: center;
}

.ws-emoji {
  font-size: 18px;
}

.ws-v {
  font-size: 18px;
  font-weight: bold;
  color: #fff;
  margin-top: 4px;
}

.ws-k {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.65);
}

.widget-toggles {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 12px;
}

.widget-toggles :deep(.el-checkbox) {
  margin-right: 0;
}

.widget-toggles :deep(.el-checkbox__label) {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.85);
  padding-left: 4px;
}

.devices {
  display: flex;
}

.device {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
}

.device-icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  background: var(--bg-primary);
  border: 1px solid var(--divider);
  opacity: 0.4;
}

.device-icon.connected {
  background: rgba(100, 181, 246, 0.15);
  border: 2px solid var(--primary);
  opacity: 1;
}

.device-name {
  font-size: 12px;
  color: var(--text-primary);
  margin-top: 6px;
}

.device-status {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: var(--text-hint);
}

.dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--text-hint);
}

.dot.on {
  background: var(--success);
}

.device-sync {
  font-size: 9px;
  color: var(--text-hint);
}

.device-note {
  margin-top: 10px;
  font-size: 11px;
  color: var(--text-hint);
  line-height: 1.6;
}

.settings-title {
  font-size: 16px;
  font-weight: bold;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.setting-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 0;
  cursor: pointer;
}

.si-emoji {
  font-size: 20px;
}

.si-body {
  flex: 1;
}

.si-title {
  font-size: 14px;
  color: var(--text-primary);
}

.si-sub {
  font-size: 11px;
  color: var(--text-hint);
  margin-top: 2px;
}

.si-arrow {
  font-size: 22px;
  color: var(--text-hint);
}

.lib-desc {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.7;
  margin-top: 4px;
}

.lib-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 14px;
}

.lib-unlocked {
  flex: 1;
  font-size: 13px;
  color: var(--success);
}

.about-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0 24px;
}

.about-item {
  display: flex;
  justify-content: space-between;
  padding: 12px 0;
  font-size: 14px;
  color: var(--text-primary);
  border-bottom: 1px solid var(--divider);
}

.about-item span:last-child {
  color: var(--text-secondary);
  font-size: 13px;
}

.about-item.link {
  cursor: pointer;
}

@media (max-width: 1100px) {
  .about-grid {
    grid-template-columns: 1fr;
  }
}

.edit-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.er-label {
  width: 40px;
  font-size: 13px;
  color: var(--text-secondary);
  flex-shrink: 0;
}
@media (max-width: 600px) {
  .user-head { flex-wrap: wrap; }
  .user-head .uh-body { flex: 1 1 calc(100% - 80px); }
  .user-head > .el-button { margin-left: auto; }
  .widget { padding: 16px 10px; }
}
</style>
