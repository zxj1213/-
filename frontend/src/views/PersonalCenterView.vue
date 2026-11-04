<template>
  <div class="personal-center">
    <nav class="personal-menu" aria-label="我的二级菜单">
      <div class="personal-menu-title">个人中心</div>
      <div class="personal-menu-items">
        <router-link v-for="item in PersonalSections" :key="item.id" :to="`/me/${item.id}`"
          class="personal-menu-link" :class="{ active: activeSection.id === item.id }"
          :style="{ '--menu-label-length': item.label.length }"
          :aria-current="activeSection.id === item.id ? 'page' : undefined">
          <el-icon><component :is="item.icon" /></el-icon>
          <span>{{ item.label }}</span>
        </router-link>
      </div>
    </nav>
    <section class="page" aria-labelledby="personal-section-title">
      <h1 id="personal-section-title" class="personal-section-title">{{ activeSection.label }}</h1>
    <!-- 用户头部 -->
    <div v-if="activeSection.id === 'profile'" class="card user-head">
      <div class="avatar" @click="showEdit = true">👤</div>
      <div class="uh-body" @click="showEdit = true">
        <div class="uh-name">{{ store.currentUserName }} <span class="uh-edit">›</span></div>
        <div class="uh-school">{{ store.userInfo?.school || '学校待填写' }} · {{ store.userInfo?.major || '专业待填写' }}</div>
        <div class="uh-id">{{ grade }} · {{ store.userInfo?.email || '邮箱待填写' }}</div>
      </div>
      <el-button round plain type="primary" @click="showEdit = true">编辑资料</el-button>
    </div>

      <!-- 桌面服务卡片预览 -->
      <div v-if="activeSection.id === 'widgets'" class="card">
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
      <div v-if="activeSection.id === 'devices'" class="card">
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

    <!-- 账号与数据(A2：本地账号、数据隔离、导出/删除/退出) -->
    <div v-if="activeSection.id === 'account'" class="card account-card">
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

      <!-- 设置 -->
      <div v-if="activeSection.id === 'settings'" class="card settings">
        <div class="settings-title">设置</div>
        <div class="setting-item preference-item">
          <span class="si-emoji">🌙</span>
          <div class="si-body">
            <div class="si-title">主题模式</div>
            <div class="si-sub">{{ themeLabel }}</div>
          </div>
          <button ref="themeTrigger" type="button" class="theme-trigger" :aria-label="showThemePicker ? '收起主题选项' : '展开主题选项'"
            aria-controls="theme-options" :aria-expanded="showThemePicker" @click="showThemePicker = !showThemePicker">
            <el-icon aria-hidden="true"><ArrowDown /></el-icon>
          </button>
        </div>
        <el-collapse-transition>
          <div v-show="showThemePicker" @keydown.esc.stop.prevent="closeThemePicker">
            <div id="theme-options" class="theme-options" role="group" aria-label="主题模式选项">
              <button v-for="option in themeOptions" :key="option.value" type="button" class="theme-option"
                :class="{ selected: store.settings.theme === option.value }" :aria-pressed="store.settings.theme === option.value"
                @click="selectTheme(option.value)">
                <span>{{ option.label }}</span>
                <el-icon v-if="store.settings.theme === option.value" aria-hidden="true"><Check /></el-icon>
              </button>
            </div>
          </div>
        </el-collapse-transition>
        <el-divider style="margin: 0" />
        <div class="setting-item preference-item font-size-row">
          <span class="si-emoji">📐</span>
          <div class="si-body">
            <div class="si-title">字体大小</div>
            <div class="si-sub">{{ fontSizeLabel }}</div>
          </div>
          <div class="font-size-control">
            <el-slider v-model="fontSizeStep" :min="0" :max="2" :step="1" :marks="fontSizeMarks"
              :show-tooltip="false" show-stops aria-label="字体大小：小号、标准、大号" />
          </div>
        </div>
        <div class="font-size-preview">学迹，让学习更有计划</div>
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
      <div v-if="activeSection.id === 'library'" class="card">
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

    <!-- 关于 -->
    <div v-if="activeSection.id === 'about'" class="card settings">
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
      <div class="edit-row"><span class="er-label">用户名</span><el-input :model-value="store.currentUserName" size="small" readonly /></div>
      <div class="edit-row"><span class="er-label">学校</span><el-input v-model="editForm.school" size="small" /></div>
      <div class="edit-row"><span class="er-label">专业</span><el-input v-model="editForm.major" size="small" /></div>
      <div class="edit-row">
        <span class="er-label">年级</span>
        <button type="button" class="grade-picker" aria-haspopup="dialog" :aria-expanded="showGradePicker" @click="showGradePicker = true">
          <span>{{ editForm.grade || '请选择年级' }}</span><span aria-hidden="true">›</span>
        </button>
      </div>
      <div class="edit-row"><span class="er-label">邮箱</span><el-input v-model="editForm.email" size="small" /></div>
      <el-drawer v-model="showGradePicker" title="选择年级" direction="btt" size="auto" append-to-body>
        <div class="grade-options">
          <button v-for="option in gradeOptions" :key="option" type="button" class="grade-option"
            :class="{ selected: editForm.grade === option }" :aria-pressed="editForm.grade === option" @click="selectGrade(option)">
            <span>{{ option }}</span><span v-if="editForm.grade === option" aria-hidden="true">✓</span>
          </button>
        </div>
      </el-drawer>
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
    </section>
  </div>
</template>

<script setup>
import { ref, computed, reactive, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { setApiToken } from '../services/api'
import { useAppStore } from '../store'
import { todayStr, daysBetween, PersonalSections } from '../constants'

const store = useAppStore()
const props = defineProps({ section: { type: String, default: 'profile' } })
const activeSection = computed(() => PersonalSections.find(item => item.id === props.section) || PersonalSections[0])

watch(() => props.section, () => {
  showEdit.value = false
  showPassword.value = false
  passwordInput.value = ''
  showThemePicker.value = false
})

const devices = [
  { deviceId: 'device_001', deviceType: 'phone', deviceName: 'Mate 70 Pro', isConnected: true, lastSyncTime: '刚刚' },
  { deviceId: 'device_002', deviceType: 'tablet', deviceName: 'MatePad Pro', isConnected: true, lastSyncTime: '2分钟前' },
  { deviceId: 'device_003', deviceType: 'pc', deviceName: 'MateBook X Pro', isConnected: false, lastSyncTime: '2小时前' }
]

const libraryUnlocked = ref(false)
const showEdit = ref(false)
const showThemePicker = ref(false)
const themeTrigger = ref(null)
const themeOptions = [
  { value: 'light', label: '浅色模式' },
  { value: 'dark', label: '深色模式' },
  { value: 'auto', label: '跟随系统' }
]
const fontSizes = ['small', 'medium', 'large']
const fontSizeMarks = { 0: '小号', 1: '标准', 2: '大号' }
const fontSizeStep = computed({
  get: () => Math.max(0, fontSizes.indexOf(store.settings?.fontSize || 'medium')),
  set: (step) => {
    if (Number.isInteger(step) && fontSizes[step]) store.updateSettings({ fontSize: fontSizes[step] })
  }
})
const showGradePicker = ref(false)
const gradeOptions = ['大一', '大二', '大三', '大四']
const showPassword = ref(false)
const passwordInput = ref('')
const editForm = reactive({ school: '', major: '', grade: '', email: '' })

watch(showEdit, (open) => {
  if (!open) {
    showGradePicker.value = false
    return
  }
  for (const key of Object.keys(editForm)) {
    editForm[key] = store.userInfo?.[key] || ''
  }
  editForm.grade = gradeOptions.includes(grade.value) ? grade.value : ''
})

const grade = computed(() => {
  if (gradeOptions.includes(store.userInfo?.grade)) return store.userInfo.grade
  if (!store.userInfo?.enrollmentYear) return '年级待完善'
  const diff = new Date().getFullYear() - store.userInfo.enrollmentYear
  const grades = ['大一', '大二', '大三', '大四']
  return grades[Math.min(Math.max(diff, 0), 3)]
})

function selectGrade(value) {
  if (!gradeOptions.includes(value)) return
  editForm.grade = value
  showGradePicker.value = false
}

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

function selectTheme(theme) {
  if (!themeOptions.some(option => option.value === theme)) return
  store.updateSettings({ theme })
  closeThemePicker()
}

function closeThemePicker() {
  showThemePicker.value = false
  themeTrigger.value?.focus()
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
  if (!store.updateProfile({ ...editForm })) return
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
.personal-center {
  display: grid;
  grid-template-columns: 210px minmax(0, 1fr);
  align-items: start;
  gap: 28px;
}

.personal-menu {
  position: sticky;
  top: 20px;
  padding: 16px 10px;
  border: 1px solid var(--divider);
  border-radius: 16px;
  background: var(--bg-card);
}

.personal-menu-title {
  padding: 4px 12px 16px;
  font-size: calc(0.8125rem * var(--font-scale));
  font-weight: 600;
  color: var(--text-secondary);
  line-height: 22.88px;
}

.personal-menu-items {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.personal-menu-link {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  border-radius: 10px;
  color: var(--text-secondary);
  font-size: calc(0.8125rem * var(--font-scale));
  text-decoration: none;
  line-height: 22.88px;
}

.personal-menu-link:hover,
.personal-menu-link.active {
  background: var(--bg-primary);
  color: var(--primary);
}

.personal-menu-link.active {
  font-weight: 600;
}

.personal-menu-link:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

.personal-section-title {
  margin: 0;
  font-size: calc(1.375rem * var(--font-scale));
  font-weight: 600;
  color: var(--text-primary);
  line-height: 38.72px;
}

.page {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--section-gap);
}

.account-card {
  margin-bottom: 0;
}

.ac-info {
  font-size: calc(0.75rem * var(--font-scale));
  color: var(--text-secondary);
  line-height: 22.44px;
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
  font-size: calc(2.125rem * var(--font-scale));
  cursor: pointer;
  flex-shrink: 0;
  line-height: 59.84px;
}

.uh-body {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
  cursor: pointer;
}

.uh-name {
  font-size: calc(1.3125rem * var(--font-scale));
  font-weight: bold;
  color: var(--text-primary);
  line-height: 36.96px;
}

.uh-edit {
  font-size: calc(1rem * var(--font-scale));
  color: var(--text-hint);
  line-height: 28.16px;
}

.uh-school {
  font-size: calc(0.8125rem * var(--font-scale));
  color: var(--text-secondary);
  margin-top: 4px;
  line-height: 22.88px;
}

.uh-id {
  font-size: calc(0.6875rem * var(--font-scale));
  color: var(--text-hint);
  margin-top: 2px;
  line-height: 19.36px;
}

.widget {
  background: var(--primary-dark);
  border-radius: 12px;
  padding: 16px;
}

.widget-badge {
  display: inline-block;
  font-size: calc(0.75rem * var(--font-scale));
  font-weight: 600;
  color: #fff;
  background: var(--primary);
  padding: 3px 8px;
  border-radius: 8px;
  line-height: 21.12px;
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
  font-size: calc(1.125rem * var(--font-scale));
  line-height: 31.68px;
}

.ws-v {
  font-size: calc(1.125rem * var(--font-scale));
  font-weight: bold;
  color: #fff;
  margin-top: 4px;
  line-height: 31.68px;
}

.ws-k {
  font-size: calc(0.625rem * var(--font-scale));
  color: rgba(255, 255, 255, 0.65);
  line-height: 17.6px;
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
  font-size: calc(0.625rem * var(--font-scale));
  color: rgba(255, 255, 255, 0.85);
  padding-left: 4px;
  line-height: 17.6px;
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
  font-size: calc(1.75rem * var(--font-scale));
  background: var(--bg-primary);
  border: 1px solid var(--divider);
  opacity: 0.4;
  line-height: 49.28px;
}

.device-icon.connected {
  background: rgba(100, 181, 246, 0.15);
  border: 2px solid var(--primary);
  opacity: 1;
}

.device-name {
  font-size: calc(0.75rem * var(--font-scale));
  color: var(--text-primary);
  margin-top: 6px;
  line-height: 21.12px;
}

.device-status {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: calc(0.625rem * var(--font-scale));
  color: var(--text-hint);
  line-height: 17.6px;
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
  font-size: calc(0.5625rem * var(--font-scale));
  color: var(--text-hint);
  line-height: 15.84px;
}

.device-note {
  margin-top: 10px;
  font-size: calc(0.6875rem * var(--font-scale));
  color: var(--text-hint);
  line-height: 19.36px;
}

.settings-title {
  font-size: calc(1rem * var(--font-scale));
  font-weight: bold;
  color: var(--text-primary);
  margin-bottom: 6px;
  line-height: 28.16px;
}

.setting-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 0;
  min-height: 80px;
  cursor: pointer;
}

.si-emoji {
  flex: 0 0 28px;
  width: 28px;
  height: 32px;
  font-size: 20px;
  line-height: 32px;
}

.si-body {
  flex: 1;
  min-width: 0;
}

.si-title {
  font-size: calc(0.875rem * var(--font-scale));
  color: var(--text-primary);
  line-height: 24px;
}

.si-sub {
  font-size: calc(0.6875rem * var(--font-scale));
  color: var(--text-hint);
  margin-top: 2px;
  line-height: 20px;
}

.si-arrow {
  font-size: calc(1.375rem * var(--font-scale));
  color: var(--text-hint);
  line-height: 38.72px;
}

.preference-item { cursor: default; }
.theme-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid var(--divider);
  border-radius: 50%;
  font: inherit;
  font-size: calc(0.875rem * var(--font-scale));
  line-height: 15.4px;
  color: var(--text-secondary);
  background: var(--bg-primary);
  cursor: pointer;
}
.theme-trigger .el-icon { transition: transform 180ms ease; }
.theme-trigger[aria-expanded='true'] .el-icon { transform: rotate(180deg); }
.theme-trigger:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
.theme-options {
  width: calc(100% - 44px);
  max-width: 320px;
  margin: 0 0 16px 44px;
  padding: 6px;
  border: 1px solid var(--divider);
  border-radius: 10px;
  background: var(--bg-primary);
}
.theme-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  min-height: 36px;
  padding: 8px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font: inherit;
  font-size: calc(0.8125rem * var(--font-scale));
  text-align: left;
  cursor: pointer;
  line-height: 22.88px;
}
.theme-option:hover,
.theme-option.selected { color: var(--primary); background: var(--accent-soft); }
.theme-option.selected { font-weight: 600; }
.theme-option:focus-visible { outline: 2px solid var(--primary); outline-offset: -2px; }
.font-size-row .si-body { min-width: 72px; }
.font-size-control {
  flex: 0 1 200px;
  width: 200px;
  min-width: 120px;
  height: 60px;
  margin-left: auto;
  padding: 0 10px 20px;
}
.font-size-preview {
  display: flex;
  align-items: center;
  height: 64px;
  margin: 0 0 20px 44px;
  padding: 12px 16px;
  border-radius: 10px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: calc(1rem * var(--font-scale));
  line-height: 28px;
}

.lib-desc {
  font-size: calc(0.75rem * var(--font-scale));
  color: var(--text-secondary);
  line-height: 22.44px;
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
  font-size: calc(0.8125rem * var(--font-scale));
  color: var(--success);
  line-height: 22.88px;
}

.about-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 24px;
}

.about-item {
  display: flex;
  justify-content: space-between;
  padding: 12px 0;
  font-size: calc(0.875rem * var(--font-scale));
  color: var(--text-primary);
  border-bottom: 1px solid var(--divider);
  line-height: 24.64px;
}

.about-item span:last-child {
  color: var(--text-secondary);
  font-size: calc(0.8125rem * var(--font-scale));
  line-height: 22.88px;
}

.about-item.link {
  cursor: pointer;
}

@media (max-width: 1100px) {
  .about-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 900px) {
  .personal-center {
    grid-template-columns: minmax(0, 1fr);
    gap: 20px;
  }
  .personal-menu {
    position: static;
    min-width: 0;
    padding: 8px;
  }
  .personal-menu-title { display: none; }
  .personal-menu-items {
    flex-direction: row;
    overflow-x: auto;
    padding: 3px;
  }
  .personal-menu-link {
    flex-shrink: 0;
    width: calc(var(--menu-label-length) * 14.3px + 52px);
    white-space: nowrap;
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
  font-size: calc(0.8125rem * var(--font-scale));
  color: var(--text-secondary);
  flex-shrink: 0;
  line-height: 22.88px;
}

.grade-picker,
.grade-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font: inherit;
  color: var(--text-primary);
  background: var(--bg-primary);
  border: 1px solid var(--divider);
  border-radius: 6px;
  cursor: pointer;
}

.grade-picker {
  flex: 1;
  padding: 6px 12px;
  font-size: calc(0.75rem * var(--font-scale));
  text-align: left;
  line-height: 21.12px;
}

.grade-options {
  display: grid;
  gap: 10px;
  max-width: 640px;
  margin: 0 auto;
  padding-bottom: max(16px, env(safe-area-inset-bottom));
}

.grade-option {
  padding: 16px;
}

.grade-option.selected {
  color: var(--primary);
  border-color: var(--primary);
}
@media (max-width: 600px) {
  .user-head { flex-wrap: wrap; }
  .user-head .uh-body { flex: 1 1 calc(100% - 80px); }
  .user-head > .el-button { margin-left: auto; }
  .widget { padding: 16px 10px; }
}
</style>
