<template>
  <!-- 未登录：登录/注册页(账号数据按用户隔离) -->
  <LoginView v-if="!isLoggedIn" />

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
            <span class="avatar">👤</span>
            <span class="name">{{ store.userInfo?.name || '同学' }}</span>
          </div>
        </div>
      </header>

      <!-- 主体：左侧导航 + 内容区 -->
      <div class="app-body">
        <aside class="app-sidebar">
          <button
            v-for="tab in tabs"
            :key="tab.path"
            class="menu-item"
            :class="{ active: route.path === tab.path }"
            @click="goTab(tab.path)"
          >
            <el-icon class="menu-icon"><component :is="tab.icon" /></el-icon>
            <span>{{ tab.label }}</span>
          </button>

          <div class="sidebar-spacer"></div>

          <div class="sidebar-user" @click="goMe">
            <span class="avatar">👤</span>
            <div class="info">
              <div class="name">{{ store.currentUserName || store.userInfo?.name || '同学' }}</div>
              <div class="school">{{ store.userInfo?.school }} · {{ store.userInfo?.major }}</div>
            </div>
          </div>
        </aside>

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
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { TABS, TabMeta } from './constants'
import { useAppStore } from './store'
import LoginView from './views/LoginView.vue'

const route = useRoute()
const router = useRouter()
const store = useAppStore()

const tabs = TABS
const currentTitle = computed(() => route.meta?.title || '学迹')

const isLoggedIn = computed(() => !!store.currentUserId)

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
