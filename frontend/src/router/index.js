/**
 * 学迹 StudyFlow - 路由
 * 6 个一级模块：首页(仪表盘) / AI任务 / 学业规划 / 考试Agent / 每日复盘 / 个人中心
 */
import { createRouter, createWebHashHistory } from 'vue-router'
import { TabMeta, PersonalSections } from '../constants'

const routes = [
  { path: '/', name: 'home', component: () => import('../views/HomeView.vue'), meta: TabMeta['/'] },
  { path: '/tasks', name: 'tasks', component: () => import('../views/TaskHubView.vue'), meta: TabMeta['/tasks'] },
  { path: '/plan', name: 'plan', component: () => import('../views/AcademicPlanView.vue'), meta: TabMeta['/plan'] },
  { path: '/exam', name: 'exam', component: () => import('../views/ExamAgentView.vue'), meta: TabMeta['/exam'] },
  { path: '/review', name: 'review', component: () => import('../views/DailyReviewView.vue'), meta: TabMeta['/review'] },
  { path: '/me', name: 'me', redirect: '/me/profile', meta: TabMeta['/me'] },
  {
    path: `/me/:section(${PersonalSections.map(item => item.id).join('|')})`,
    name: 'me-section',
    component: () => import('../views/PersonalCenterView.vue'),
    props: true,
    meta: TabMeta['/me']
  },
  { path: '/me/:pathMatch(.*)*', redirect: '/me/profile' }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

router.afterEach(() => {
  window.scrollTo(0, 0)
})

export default router
