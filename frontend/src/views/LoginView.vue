<template>
  <div class="login-stage">
    <div class="login-card">
      <div class="login-logo">
        <span class="logo-mark">迹</span>
        <span class="login-name">学迹 <small>StudyFlow</small></span>
      </div>
      <div class="login-slogan">AI 自适应学习管家 · 根据真实学习结果动态改变决策</div>

      <el-input v-model="name" placeholder="用户名" size="large" class="login-input">
        <template #prefix><el-icon><User /></el-icon></template>
      </el-input>
      <el-input
        v-model="password"
        type="password"
        placeholder="密码（至少4位）"
        size="large"
        class="login-input"
        show-password
        @keyup.enter="doLogin"
      >
        <template #prefix><el-icon><Lock /></el-icon></template>
      </el-input>

      <div class="login-tip">
        🔑 本地演示账号：首次输入新用户名即自动注册；数据按账号隔离保存在本机
      </div>

      <el-button type="primary" size="large" round class="login-btn" :loading="loading" @click="doLogin">
        {{ isRegister ? '注册并进入' : '登录 / 注册' }}
      </el-button>

      <el-button size="large" round plain class="login-btn" @click="doDemo">
        以演示账号直接体验
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { useAppStore } from '../store'

const store = useAppStore()
const name = ref('')
const password = ref('')
const loading = ref(false)

const isRegister = computed(() => {
  const users = store._readUsers()
  return name.value.trim() && !users.some(u => u.name === name.value.trim())
})

function doLogin() {
  if (!name.value.trim() || !password.value) {
    ElMessage.warning('请输入用户名和密码')
    return
  }
  loading.value = true
  setTimeout(() => {
    const r = store.login(name.value, password.value)
    loading.value = false
    if (r.ok) {
      ElMessage.success(r.msg + (r.registered ? '（已自动注册）' : ''))
    } else {
      ElMessage.error(r.msg)
    }
  }, 400)
}

function doDemo() {
  loading.value = true
  setTimeout(() => {
    const r = store.login('演示同学', 'demo1234')
    loading.value = false
    if (r.ok) ElMessage.success('欢迎使用演示账号')
  }, 400)
}
</script>

<style scoped>
.login-stage {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #E3F2FD 0%, #F5F5F5 45%, #E0F2F1 100%);
  padding: 24px;
}

[data-theme='dark'] .login-stage {
  background: linear-gradient(135deg, #0D2B4A 0%, #121212 50%, #10312E 100%);
}

.login-card {
  width: 400px;
  max-width: 100%;
  background: var(--bg-card);
  border-radius: 18px;
  padding: 36px 32px;
  box-shadow: 0 16px 48px rgba(32, 52, 86, 0.08);
  border: 1px solid var(--divider);
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.login-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: center;
}

.logo-mark {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: linear-gradient(135deg, #1E88E5, #26A69A);
  color: #fff;
  font-size: 22px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
}

.login-name {
  font-size: 24px;
  font-weight: bold;
  color: var(--text-primary);
}

.login-name small {
  font-size: 12px;
  font-weight: normal;
  color: var(--text-hint);
  letter-spacing: 1px;
}

.login-slogan {
  text-align: center;
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.login-input {
  margin-top: 4px;
}

.login-tip {
  font-size: 11px;
  color: var(--text-hint);
  line-height: 1.6;
  background: var(--bg-primary);
  border-radius: 8px;
  padding: 8px 10px;
}

.login-btn {
  width: 100%;
  margin: 0;
}
</style>
