<template>
  <!-- 未登录：登录/注册页(账号数据按用户隔离) -->
  <div v-if="restoringSession" class="session-loading" role="status">正在恢复登录状态…</div>
  <LoginView v-else-if="!isLoggedIn" />

  <div v-else class="stage">
    <div class="app-shell">
      <!-- 顶部栏：Logo + 当前模块标题 + AI助手 -->
      <header class="app-header">
        <div class="logo" @click="goHome">
          <span class="logo-mark">迹</span>
          <span class="logo-name">学迹 <small>StudyFlow</small></span>
        </div>
        <span class="app-title">{{ currentTitle }}</span>
        <div class="header-spacer"></div>
        <div class="header-actions">
          <button class="ai-chip" @click="goAiChat">
            <span>✨</span> AI助手
          </button>
          <div class="header-user" @click="goMe">
            <span class="avatar"><img v-if="store.userInfo?.avatar" :src="store.userInfo.avatar" alt="" /><template v-else>👤</template></span>
            <span class="name">{{ store.userInfo?.name || '同学' }}</span>
          </div>
        </div>
      </header>

      <!-- 主体：左侧导航 + 内容区 -->
      <div class="app-body">
        <nav ref="mainNavigation" class="app-sidebar" aria-label="主导航" @wheel="scrollNavigation">
          <button
            v-for="tab in tabs"
            :key="tab.path"
            class="menu-item"
            :class="{ active: route.path === tab.path || route.path.startsWith(tab.path + '/') }"
            :aria-current="route.path === tab.path || route.path.startsWith(tab.path + '/') ? 'page' : undefined"
            @click="goTab(tab.path)"
          >
            <el-icon class="menu-icon"><component :is="tab.icon" /></el-icon>
            <span>{{ tab.label }}</span>
          </button>

          <div class="sidebar-spacer"></div>

          <div class="sidebar-user" @click="goMe">
            <span class="avatar"><img v-if="store.userInfo?.avatar" :src="store.userInfo.avatar" alt="" /><template v-else>👤</template></span>
            <div class="info">
              <div class="name">{{ store.userInfo?.name || store.currentUserName || '同学' }}</div>
              <div class="school">{{ store.userInfo?.school }} · {{ store.userInfo?.major }}</div>
            </div>
          </div>
        </nav>

        <main class="app-main">
          <div class="content-wrap">
            <router-view />
          </div>
        </main>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import { TABS, TabMeta } from './constants'
import { useAppStore } from './store'
import LoginView from './views/LoginView.vue'
import { getAccountProfile, refreshSession, setSessionAccount, setSessionExpiredHandler } from './services/api'

const route = useRoute()
const router = useRouter()
const store = useAppStore()

const tabs = TABS
const currentTitle = computed(() => route.meta?.title || '学迹')
const mainNavigation = ref(null)

const isLoggedIn = computed(() => !!store.currentUserId)
const savedAccount = store.authState?.serverAccountId
const restoringSession = ref(!!savedAccount)
setSessionAccount(savedAccount || null)
setSessionExpiredHandler(owner => {
  if (store.authState?.serverAccountId !== owner) return
  store.logout()
  ElMessage.warning('登录已过期，请重新登录')
})
if (savedAccount) {
  refreshSession().catch(() => {}).finally(() => { restoringSession.value = false })
}

let profileRequest
async function syncProfile() {
  const owner = store.authState?.serverAccountId
  if (!owner || restoringSession.value || document.hidden || profileRequest === owner) return
  profileRequest = owner
  try {
    const profile = await getAccountProfile(store.userInfo?.profileVersion, !!store.userInfo?.accountIdentifier)
    store.applyAccountProfile(profile)
  } catch {
    // Preserve the cached profile while disconnected.
  } finally {
    if (profileRequest === owner) profileRequest = undefined
  }
}
watch([() => store.authState?.serverAccountId, restoringSession], syncProfile, { immediate: true })

let priorityInterval
let profileInterval
let systemTheme
function refreshPriorities() {
  store.refreshTaskPriorities()
}
function followSystemTheme() {
  if (store.settings?.theme === 'auto') store.applyTheme()
}
onMounted(() => {
  refreshPriorities()
  priorityInterval = setInterval(refreshPriorities, 1000)
  profileInterval = setInterval(syncProfile, 8000)
  window.addEventListener('focus', syncProfile)
  document.addEventListener('visibilitychange', syncProfile)
  window.addEventListener('focus', refreshPriorities)
  window.addEventListener('resize', revealActiveTab)
  document.addEventListener('visibilitychange', refreshPriorities)
  systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
  systemTheme.addEventListener('change', followSystemTheme)
})
onUnmounted(() => {
  setSessionExpiredHandler(null)
  clearInterval(priorityInterval)
  clearInterval(profileInterval)
  window.removeEventListener('focus', syncProfile)
  document.removeEventListener('visibilitychange', syncProfile)
  window.removeEventListener('focus', refreshPriorities)
  window.removeEventListener('resize', revealActiveTab)
  document.removeEventListener('visibilitychange', refreshPriorities)
  systemTheme?.removeEventListener('change', followSystemTheme)
})

watch([mainNavigation, () => route.path], revealActiveTab, { flush: 'post' })

function scrollNavigation(event) {
  const nav = event.currentTarget
  const maxScroll = nav.scrollWidth - nav.clientWidth
  if (maxScroll <= 0 || event.ctrlKey || event.deltaX || !event.deltaY || !event.cancelable) return

  let distance = event.deltaY
  if (event.deltaMode === 1) distance *= 16
  if (event.deltaMode === 2) distance *= nav.clientWidth
  const position = Math.max(0, Math.min(maxScroll, nav.scrollLeft + distance))
  if (position === nav.scrollLeft) return

  event.preventDefault()
  nav.scrollLeft = position
}

function revealActiveTab() {
  const nav = mainNavigation.value
  if (!nav || nav.scrollWidth <= nav.clientWidth) return
  const active = nav.querySelector('[aria-current="page"]')
  if (!active) return

  const bounds = nav.getBoundingClientRect()
  const tab = active.getBoundingClientRect()
  const style = getComputedStyle(nav)
  const left = bounds.left + parseFloat(style.paddingLeft)
  const right = bounds.left + nav.clientWidth - parseFloat(style.paddingRight)
  if (tab.left < left) nav.scrollLeft += tab.left - left
  else if (tab.right > right) nav.scrollLeft += tab.right - right
}

function goTab(path) {
  if (route.path !== path) router.push(path)
}

function goHome() {
  router.push('/')
}

function goAiChat() {
  router.push({ path: '/tasks', query: { chat: '1' } })
}

function goMe() {
  router.push('/me')
}
</script>

<style scoped>
.avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
</style>
