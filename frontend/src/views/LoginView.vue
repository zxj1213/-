<template>
  <div class="login-stage">
    <div class="login-card">
      <div class="login-logo">
        <span class="logo-mark">迹</span>
        <span class="login-name">学迹 <small>StudyFlow</small></span>
      </div>
      <div class="login-slogan">AI 自适应学习管家 · 根据真实学习结果动态改变决策</div>

      <el-input v-model="name" :placeholder="registering ? '手机号或邮箱' : '手机号或邮箱（旧账号可用原登录名）'"
        size="large" class="login-input" autocomplete="username" maxlength="254">
        <template #prefix><el-icon><User /></el-icon></template>
      </el-input>
      <el-input v-if="registering" v-model="displayName" placeholder="用户名（可在个人资料中修改）"
        size="large" class="login-input" maxlength="40" autocomplete="nickname" />
      <el-input
        v-model="password"
        type="password"
        placeholder="密码（新账号至少 8 位）"
        :autocomplete="registering ? 'new-password' : 'current-password'"
        size="large"
        class="login-input"
        show-password
        @keyup.enter="doLogin"
      >
        <template #prefix><el-icon><Lock /></el-icon></template>
      </el-input>

      <div class="login-tip">
        {{ registering ? '请选择一种登录账号。注册后，手机号或邮箱固定，用户名可修改。'
          : '同一账号可在连接同一服务的设备上同步个人资料和头像。' }}
      </div>

      <el-button type="primary" size="large" round class="login-btn" :loading="loading" @click="doLogin">
        {{ registering ? '注册并登录' : '登录' }}
      </el-button>
      <el-button link type="primary" :disabled="loading" @click="registering = !registering">
        {{ registering ? '已有账号，返回登录' : '注册账号' }}
      </el-button>

      <el-button size="large" round plain class="login-btn" :disabled="loading" @click="doDemo">
        以演示账号直接体验
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useAppStore } from '../store'
import { registerAccount, signIn, signOut } from '../services/api'

const store = useAppStore()
const name = ref('')
const password = ref('')
const loading = ref(false)

const registering = ref(false)
const displayName = ref('')

async function doLogin() {
  if (loading.value) return
  const username = name.value.trim()
  const secret = password.value
  if (!username || !secret) {
    ElMessage.warning('请输入用户名和密码')
    return
  }
  const local = !registering.value && store._readUsers().find(user => user.name === username)
  const legacy = local && !local.serverId
  if (legacy && !store.matchesLegacyPassword(local, secret)) {
    ElMessage.error('密码错误')
    return
  }
  if (legacy && (secret.length < 8 || username === '演示同学')) {
    const result = store.login(username, secret)
    if (result.ok) ElMessage.info(username === '演示同学' ? '已进入本地演示模式' : '已进入本地模式，可在个人资料中绑定手机号或邮箱。')
    else ElMessage.error(result.msg)
    return
  }
  if (secret.length < 8 || secret.length > 128 || (registering.value && !displayName.value.trim())) {
    ElMessage.warning(registering.value ? '请填写用户名，密码需为 8 至 128 位' : '密码需为 8 至 128 位')
    return
  }

  loading.value = true
  let serverId
  try {
    serverId = registering.value ? await registerAccount(username, secret, displayName.value.trim()) : await signIn(username, secret)
    store.connectServerAccount(username, serverId, { reuseLocal: !!legacy })
    password.value = ''
    ElMessage.success('已登录学迹')
  } catch (error) {
    if (serverId) {
      await signOut(serverId).catch(() => {})
      ElMessage.error('无法绑定本地账号记录，请检查浏览器存储后重试')
      return
    }
    const status = error.response?.status
    if (legacy && (!status || status === 401 || status >= 500)) {
      const result = store.login(username, secret)
      if (result.ok) ElMessage.info('已进入本地模式，可在个人资料中绑定手机号或邮箱。')
      else ElMessage.error(result.msg)
      return
    }
    if (status === 401) ElMessage.error('账号或密码错误')
    else if (status === 409) ElMessage.error('该手机号或邮箱已被使用')
    else if (status === 422) ElMessage.error('请输入有效的手机号或邮箱，并填写用户名')
    else if (status === 403) ElMessage.error('当前地址未开放登录或注册，请使用本地学迹地址或联系管理员')
    else if (status === 429) ElMessage.error('尝试次数过多，请稍后重试')
    else ElMessage.error('登录服务暂不可用，请稍后重试')
  } finally {
    loading.value = false
  }
}

function doDemo() {
  if (loading.value) return
  loading.value = true
  setTimeout(() => {
    const r = store.login('演示同学', 'demo1234')
    loading.value = false
    if (r.ok) {
      ElMessage.success('欢迎使用演示账号')
    } else {
      name.value = '演示同学'
      password.value = ''
      ElMessage.warning('请输入演示账号的当前密码登录')
    }
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
  font-size: calc(1.375rem * var(--font-scale));
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 38.72px;
}

.login-name {
  font-size: calc(1.5rem * var(--font-scale));
  font-weight: bold;
  color: var(--text-primary);
  line-height: 42.24px;
}

.login-name small {
  font-size: calc(0.75rem * var(--font-scale));
  font-weight: normal;
  color: var(--text-hint);
  letter-spacing: 1px;
  line-height: 21.12px;
}

.login-slogan {
  text-align: center;
  font-size: calc(0.75rem * var(--font-scale));
  color: var(--text-secondary);
  margin-bottom: 8px;
  line-height: 21.12px;
}

.login-input {
  margin-top: 4px;
}

.login-tip {
  font-size: calc(0.6875rem * var(--font-scale));
  color: var(--text-hint);
  line-height: 19.36px;
  background: var(--bg-primary);
  border-radius: 8px;
  padding: 8px 10px;
}

.login-btn {
  width: 100%;
  margin: 0;
}
</style>
