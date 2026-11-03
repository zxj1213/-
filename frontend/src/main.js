/**
 * 学迹 StudyFlow - 应用入口
 * 技术栈: Vue 3 + Element Plus + Pinia + Vue Router
 */
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import './styles/global.css'

import App from './App.vue'
import router from './router'
import { useAppStore } from './store'

const app = createApp(App)

// 全局注册 Element Plus 图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(createPinia())
app.use(router)
app.use(ElementPlus, { locale: zhCn })

// 初始化数据(首次启动加载演示数据)并应用主题
useAppStore().init()

app.mount('#app')
