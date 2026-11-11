<template>
  <div class="page">
    <!-- 快捷入口(子页面切换) -->
    <div class="card quick-entries">
      <div
        v-for="entry in entries"
        :key="entry.key"
        class="quick-entry"
        :class="{ active: currentSub === entry.key }"
        @click="currentSub = entry.key"
      >
        <span class="qe-icon">{{ entry.emoji }}</span>
        <span class="qe-label" :style="{ color: currentSub === entry.key ? entry.color : '' }">{{ entry.label }}</span>
      </div>
    </div>

    <div class="sub-body">
      <!-- ============ 画像(总览) ============ -->
      <template v-if="currentSub === 'overview'">
        <div class="grid-side-main">
          <AcademicPortraitCard :portrait="store.portrait" class="fade-up" />

          <div class="right-col">
            <!-- AI记忆库预览 -->
            <div class="card mem-preview fade-up" @click="currentSub = 'memory'">
              <div class="card-title">
                <span class="t">AI记忆库</span>
                <span class="more">{{ store.aiMemories.length }}条记忆 ›</span>
              </div>
              <div v-for="mem in store.aiMemories.slice(0, 3)" :key="mem.id" class="mem-item">
                <span class="mem-icon" :style="{ background: memoryColor(mem.type) + '20' }">{{ memoryEmoji(mem.type) }}</span>
                <div class="mem-body">
                  <div class="mem-content">{{ mem.content }}</div>
                  <div class="mem-meta">
                    <span class="tag" :style="{ background: memoryColor(mem.type) + '20', color: memoryColor(mem.type) }">{{ memoryLabel(mem.type) }}</span>
                    <span class="mem-star">重要性: {{ '⭐'.repeat(Math.min(mem.importance, 5)) }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- 目标方向 -->
            <div class="card fade-up">
              <div class="card-title">
                <span class="t">目标方向</span>
                <span class="more" @click.stop="currentSub = 'career'">查看全部 →</span>
              </div>
              <div v-for="goal in store.portrait.goals" :key="goal.id" class="goal-item">
                <span class="tag" :style="careerColorStyle(goal.type)">{{ goal.type }}</span>
                <div class="goal-body">
                  <div class="goal-name">{{ goal.name }}</div>
                  <div class="goal-match">
                    <el-progress
                      :percentage="goal.matchScore"
                      :stroke-width="5"
                      :color="matchColor(goal.matchScore)"
                      style="width: 120px"
                    />
                    <span class="gm-text">{{ goal.matchScore }}%匹配</span>
                  </div>
                  <div v-if="goal.skillGaps.length" class="goal-gap">⚠️ 缺口: {{ goal.skillGaps.join(', ') }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 课程→能力→竞赛→岗位 路径图 -->
        <div class="card fade-up path-card">
          <div class="path-title">🔀 课程→能力→竞赛→岗位 路径图</div>
          <div class="path-row">
            <div class="path-node" style="background: #2196F3">数据结构<br/>算法设计</div>
            <span class="path-arrow">→</span>
            <div class="path-node" style="background: #4CAF50">算法能力<br/>编程能力</div>
            <span class="path-arrow">→</span>
            <div class="path-node" style="background: #FF9800">ACM竞赛<br/>蓝桥杯</div>
            <span class="path-arrow">→</span>
            <div class="path-node" style="background: #1E88E5">保研<br/>大厂就业</div>
            <span class="path-arrow">→</span>
            <div class="path-node" style="background: #26A69A">科研论文<br/>系统设计</div>
          </div>
        </div>
      </template>

      <!-- ============ 竞赛库与推荐 ============ -->
      <template v-else-if="currentSub === 'competition'">
        <el-tabs v-model="competitionTab">
          <el-tab-pane label="认定竞赛库" name="catalog">
            <CompetitionCatalog />
          </el-tab-pane>
          <el-tab-pane label="竞赛推荐（演示）" name="recommendations" lazy>
            <div class="grid-3">
              <div v-for="comp in store.competitions" :key="comp.id" class="card comp-card fade-up">
                <div class="comp-top">
                  <div>
                    <div class="comp-name">{{ comp.name }}</div>
                    <div class="comp-meta">{{ comp.level }} · {{ comp.category }}</div>
                  </div>
                  <div class="comp-score">
                    <div class="cs-v" :style="{ color: matchColor(comp.matchScore) }">{{ comp.matchScore }}%</div>
                    <div class="cs-k">匹配度</div>
                  </div>
                </div>
                <div class="comp-desc">{{ comp.description }}</div>
                <div v-if="comp.skillGaps?.length" class="comp-gap">💡 需提升: {{ comp.skillGaps.join('、') }}</div>
                <div class="comp-foot">
                  <span class="comp-deadline">报名截止: {{ comp.registrationDeadline }}</span>
                  <el-button size="small" round plain type="primary">查看详情</el-button>
                </div>
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>
      </template>

      <!-- ============ 升学/就业推荐 ============ -->
      <template v-else-if="currentSub === 'career'">
        <div class="sub-title">升学/就业推荐</div>
        <div class="grid-2">
          <div v-for="career in store.portrait.goals" :key="career.id" class="card career-card fade-up">
            <div class="career-head">
              <span class="tag" :style="careerColorStyle(career.type)">{{ career.type }}</span>
              <span class="career-name">{{ career.name }}</span>
            </div>
            <div class="career-reqs">
              <div v-for="req in career.requirements" :key="req" class="req-item">✓ {{ req }}</div>
            </div>
            <div class="career-actions">
              <div class="ca-title">AI 建议行动</div>
              <div v-for="action in career.suggestedActions" :key="action" class="ca-item">➡ {{ action }}</div>
            </div>
          </div>
        </div>
      </template>

      <!-- ============ 知识库 ============ -->
      <KnowledgeLibrary v-else-if="currentSub === 'knowledge'" />

      <!-- ============ 课程管理 ============ -->
      <template v-else-if="currentSub === 'courses'">
        <div class="sub-title">课程管理</div>
        <TimetablePanel />
        <div class="card train-card">
          <div class="train-info">ℹ {{ store.trainingPlan.school }} · {{ store.trainingPlan.major }}</div>
          <div class="train-stats">
            <div v-for="s in creditStats" :key="s.label" class="train-stat">
              <div class="ts-v">{{ s.value }}</div>
              <div class="ts-k">{{ s.label }}</div>
            </div>
          </div>
          <div class="train-reqs">
            <div class="tr-title">毕业要求</div>
            <div v-for="r in store.trainingPlan.graduationRequirements" :key="r" class="tr-item">✓ {{ r }}</div>
          </div>
        </div>
        <div class="grid-2">
          <div v-for="course in store.courses" :key="course.id" class="card course-row">
            <div class="course-top">
              <span class="course-name">{{ course.name }}</span>
              <span class="tag" style="background: rgba(30,136,229,0.1); color: var(--primary)">{{ course.type }}</span>
              <span class="course-credit">{{ course.credits }}学分 · {{ course.hours }}学时</span>
            </div>
            <div class="course-meta">
              <span>{{ course.teacher }}</span>
              <span v-if="course.score" :style="{ color: course.score >= 90 ? 'var(--success)' : '' }"> · {{ course.grade }}({{ course.score }}分)</span>
              <span v-if="course.examDate" style="color: var(--warning)"> · 考试: {{ course.examDate.slice(0, 10) }}</span>
            </div>
            <div class="course-desc">{{ course.description }}</div>
          </div>
        </div>
      </template>

      <!-- ============ AI记忆库 ============ -->
      <template v-else-if="currentSub === 'memory'">
        <div class="sub-title">AI记忆库</div>
        <div class="mem-desc">查看已记录的学习偏好、目标和确认后的复盘摘要。</div>
        <div class="grid-2">
          <div v-for="mem in store.aiMemories" :key="mem.id" class="card mem-card">
            <span class="mem-icon" :style="{ background: memoryColor(mem.type) + '20' }">{{ memoryEmoji(mem.type) }}</span>
            <div class="mem-body">
              <div class="mem-content">{{ mem.content }}</div>
              <div class="mem-meta">
                <span class="tag" :style="{ background: memoryColor(mem.type) + '20', color: memoryColor(mem.type) }">{{ memoryLabel(mem.type) }}</span>
                <span class="mem-star">最近访问: {{ mem.lastAccessedAt }} · 访问{{ mem.accessCount }}次</span>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAppStore } from '../store'
import KnowledgeLibrary from '../components/KnowledgeLibrary.vue'
import AcademicPortraitCard from '../components/AcademicPortraitCard.vue'
import CompetitionCatalog from '../components/CompetitionCatalog.vue'
import TimetablePanel from '../components/TimetablePanel.vue'

const store = useAppStore()
const route = useRoute()

const currentSub = ref('overview')
watch(() => route.query.tab, tab => {
  if (tab === 'courses') currentSub.value = tab
}, { immediate: true })
const competitionTab = ref('catalog')
const entries = [
  { key: 'overview', label: '画像', emoji: '🪪', color: '#1E88E5' },
  { key: 'competition', label: '竞赛', emoji: '🏆', color: '#FF9800' },
  { key: 'career', label: '升学', emoji: '🎓', color: '#4CAF50' },
  { key: 'knowledge', label: '知识库', emoji: '📝', color: '#2196F3' },
  { key: 'courses', label: '课程', emoji: '📖', color: '#26A69A' },
  { key: 'memory', label: '记忆', emoji: '🧠', color: '#F44336' }
]

const creditStats = computed(() => {
  const t = store.trainingPlan
  if (!t) return []
  return [
    { label: '总学分', value: t.totalCredits },
    { label: '必修', value: t.requiredCredits },
    { label: '选修', value: t.electiveCredits },
    { label: '通识', value: t.generalCredits },
    { label: '实践', value: t.practiceCredits }
  ]
})

function matchColor(score) {
  if (score >= 80) return '#4CAF50'
  if (score >= 50) return '#FF9800'
  return '#F44336'
}

function careerColorStyle(type) {
  const map = {
    保研: '#4CAF50', 考研: '#2196F3', 就业: '#FF9800', 出国: '#26A69A'
  }
  const color = map[type] || '#1E88E5'
  return { background: color + '20', color }
}

function memoryEmoji(type) {
  const map = { preference: '❤', habit: '🔄', goal: '🎯', context: '☰' }
  return map[type] || '🧠'
}

function memoryColor(type) {
  const map = { preference: '#F44336', habit: '#FF9800', goal: '#4CAF50', context: '#2196F3' }
  return map[type] || '#757575'
}

function memoryLabel(type) {
  const map = { preference: '偏好', habit: '习惯', goal: '目标', context: '上下文' }
  return map[type] || '其他'
}

</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: var(--section-gap);
}

/* 快捷入口 */
.quick-entries {
  display: flex;
  padding: 12px;
  gap: 4px;
}

.quick-entry {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px 10px;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.2s;
}

.quick-entry:hover {
  background: var(--bg-primary);
}

.quick-entry.active {
  background: rgba(30, 136, 229, 0.08);
}

.qe-icon {
  font-size: calc(1.125rem * var(--font-scale));
  opacity: 0.4;
  transition: opacity 0.2s;
  line-height: 31.68px;
}

.quick-entry.active .qe-icon {
  opacity: 1;
}

.qe-label {
  font-size: calc(0.8125rem * var(--font-scale));
  color: var(--text-secondary);
  line-height: 22.88px;
}

.quick-entry.active .qe-label {
  font-weight: 600;
}

.sub-title {
  font-size: calc(1.125rem * var(--font-scale));
  font-weight: bold;
  color: var(--text-primary);
  margin-bottom: 12px;
  line-height: 31.68px;
}

.sub-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.right-col {
  display: flex;
  flex-direction: column;
  gap: var(--grid-gap);
}

.path-card {
  margin-top: var(--section-gap);
}

.mem-preview {
  cursor: pointer;
}

.mem-item,
.mem-card {
  display: flex;
  gap: 10px;
  padding: 8px 0;
  align-items: flex-start;
}

.mem-icon {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: calc(1.125rem * var(--font-scale));
  flex-shrink: 0;
  line-height: 31.68px;
}

.mem-body {
  flex: 1;
  min-width: 0;
}

.mem-content {
  font-size: calc(0.8125rem * var(--font-scale));
  color: var(--text-primary);
  line-height: 21.45px;
}

.mem-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

.mem-star {
  font-size: calc(0.625rem * var(--font-scale));
  color: var(--text-hint);
  line-height: 17.6px;
}

.goal-item {
  display: flex;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid var(--divider);
  align-items: flex-start;
}

.goal-item:last-child {
  border-bottom: none;
}

.goal-body {
  flex: 1;
}

.goal-name {
  font-size: calc(0.875rem * var(--font-scale));
  font-weight: 600;
  color: var(--text-primary);
  line-height: 24.64px;
}

.goal-match {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 5px;
}

.gm-text {
  font-size: calc(0.6875rem * var(--font-scale));
  color: var(--text-hint);
  line-height: 19.36px;
}

.goal-gap {
  font-size: calc(0.6875rem * var(--font-scale));
  color: var(--warning);
  margin-top: 4px;
  line-height: 19.36px;
}

.path-title {
  font-size: calc(0.875rem * var(--font-scale));
  font-weight: 600;
  color: var(--text-primary);
  line-height: 24.64px;
}

.path-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  margin-top: 10px;
  background: var(--bg-primary);
  border-radius: 8px;
  padding: 14px 10px;
}

.path-arrow {
  font-size: calc(1rem * var(--font-scale));
  color: var(--text-hint);
  line-height: 28.16px;
}

.comp-card {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.comp-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.comp-name {
  font-size: calc(0.9375rem * var(--font-scale));
  font-weight: 600;
  color: var(--text-primary);
  line-height: 26.4px;
}

.comp-meta {
  font-size: calc(0.75rem * var(--font-scale));
  color: var(--text-hint);
  margin-top: 2px;
  line-height: 21.12px;
}

.comp-score {
  text-align: center;
}

.cs-v {
  font-size: calc(1.125rem * var(--font-scale));
  font-weight: bold;
  line-height: 31.68px;
}

.cs-k {
  font-size: calc(0.625rem * var(--font-scale));
  color: var(--text-hint);
  line-height: 17.6px;
}

.comp-desc {
  font-size: calc(0.8125rem * var(--font-scale));
  color: var(--text-secondary);
  margin-top: 8px;
  flex: 1;
  line-height: 22.88px;
}

.comp-gap {
  font-size: calc(0.75rem * var(--font-scale));
  color: var(--warning);
  margin-top: 6px;
  line-height: 21.12px;
}

.comp-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
}

.comp-deadline {
  font-size: calc(0.6875rem * var(--font-scale));
  color: var(--text-hint);
  line-height: 19.36px;
}

.career-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.career-name {
  font-size: calc(1rem * var(--font-scale));
  font-weight: bold;
  color: var(--text-primary);
  line-height: 28.16px;
}

.career-reqs {
  margin-top: 8px;
  background: var(--bg-primary);
  border-radius: 6px;
  padding: 10px;
}

.req-item {
  font-size: calc(0.8125rem * var(--font-scale));
  color: var(--text-secondary);
  line-height: 25.74px;
}

.career-actions {
  margin-top: 8px;
}

.ca-title {
  font-size: calc(0.75rem * var(--font-scale));
  font-weight: 600;
  color: var(--secondary);
  line-height: 21.12px;
}

.ca-item {
  font-size: calc(0.8125rem * var(--font-scale));
  color: var(--text-primary);
  margin-top: 3px;
  line-height: 22.88px;
}

.train-card {
  margin-bottom: 16px;
}

.train-info {
  font-size: calc(0.8125rem * var(--font-scale));
  color: var(--text-secondary);
  line-height: 22.88px;
}

.train-stats {
  display: flex;
  margin-top: 12px;
  gap: 12px;
}

.train-stat {
  flex: 1;
  text-align: center;
  background: var(--bg-primary);
  border-radius: 8px;
  padding: 10px 0;
}

.ts-v {
  font-size: calc(1.125rem * var(--font-scale));
  font-weight: bold;
  color: var(--primary);
  line-height: 31.68px;
}

.ts-k {
  font-size: calc(0.6875rem * var(--font-scale));
  color: var(--text-hint);
  margin-top: 2px;
  line-height: 19.36px;
}

.train-reqs {
  margin-top: 12px;
  background: var(--bg-primary);
  border-radius: 8px;
  padding: 10px 12px;
}

.tr-title {
  font-size: calc(0.75rem * var(--font-scale));
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
  line-height: 21.12px;
}

.tr-item {
  font-size: calc(0.75rem * var(--font-scale));
  color: var(--text-secondary);
  line-height: 23.76px;
}

.course-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.course-top {
  display: flex;
  align-items: center;
  gap: 6px;
}

.course-name {
  font-size: calc(0.9375rem * var(--font-scale));
  font-weight: 600;
  color: var(--text-primary);
  line-height: 26.4px;
}

.course-credit {
  font-size: calc(0.625rem * var(--font-scale));
  color: var(--text-hint);
  margin-left: auto;
  line-height: 17.6px;
}

.course-meta {
  font-size: calc(0.75rem * var(--font-scale));
  color: var(--text-secondary);
  line-height: 21.12px;
}

.course-desc {
  font-size: calc(0.75rem * var(--font-scale));
  color: var(--text-hint);
  line-height: 21.12px;
}

.mem-desc {
  font-size: calc(0.8125rem * var(--font-scale));
  color: var(--text-secondary);
  margin-bottom: 14px;
  line-height: 22.88px;
}

.quick-entries { overflow-x: auto; }
.quick-entry { flex-shrink: 0; white-space: nowrap; }
@media (max-width: 600px) {
  .quick-entry { flex: 0 0 auto; }
  .path-row { overflow-x: auto; justify-content: flex-start; gap: 10px; }
  .path-row :deep(.path-node) { flex-shrink: 0; min-width: 72px; }
}
</style>
