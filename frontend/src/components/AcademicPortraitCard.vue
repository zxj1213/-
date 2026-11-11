<template>
  <div class="card">
    <!-- 头部 -->
    <div class="head">
      <span class="icon">🪪</span>
      <div>
        <div class="name">{{ portrait.grade }} · GPA {{ portrait.gpa }}</div>
        <div class="sub">专业绩点 {{ portrait.majorGpa }} · 已修学分 {{ portrait.earnedCredits }}/{{ portrait.totalCredits }}</div>
      </div>
    </div>

    <div v-if="portrait.studyReview" class="review-summary">
      <div class="col-label">最近确认的复盘 · {{ portrait.studyReview.date }}</div>
      <div class="col-item">{{ portrait.studyReview.summary }}</div>
    </div>

    <!-- 技能 -->
    <div class="skills">
      <div v-for="skill in portrait.skills" :key="skill.name" class="skill">
        <div class="skill-top">
          <span class="skill-name">{{ skill.name }}</span>
          <span class="skill-level">{{ '★'.repeat(skill.level) }}{{ '☆'.repeat(5 - skill.level) }}</span>
        </div>
        <div class="skill-evidence">{{ skill.evidence.join(' · ') }}</div>
      </div>
    </div>

    <!-- 优势 / 短板 -->
    <div class="two-col">
      <div>
        <div class="col-label good">💪 优势</div>
        <div v-for="s in portrait.strengths" :key="s" class="col-item">• {{ s }}</div>
      </div>
      <div>
        <div class="col-label bad">⚠️ 短板</div>
        <div v-for="w in portrait.weaknesses" :key="w" class="col-item">• {{ w }}</div>
      </div>
    </div>

    <!-- 竞赛与证书 -->
    <div class="badges">
      <el-tag v-for="c in portrait.competitions" :key="c.name" type="warning" size="small" effect="light">
        🏆 {{ c.name }} {{ c.award }}
      </el-tag>
      <el-tag v-for="c in portrait.certificates" :key="c.name" type="success" size="small" effect="light">
        📜 {{ c.name }} {{ c.level }}
      </el-tag>
    </div>
  </div>
</template>

<script setup>
defineProps({
  portrait: { type: Object, required: true }
})
</script>

<style scoped>
.head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.icon {
  font-size: calc(2rem * var(--font-scale));
  line-height: 56.32px;
}

.name {
  font-size: calc(0.9375rem * var(--font-scale));
  font-weight: bold;
  color: var(--text-primary);
  line-height: 26.4px;
}

.sub {
  font-size: calc(0.6875rem * var(--font-scale));
  color: var(--text-secondary);
  margin-top: 2px;
  line-height: 19.36px;
}

.review-summary {
  margin-top: 14px;
}

.skills {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skill-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.skill-name {
  font-size: calc(0.8125rem * var(--font-scale));
  font-weight: 600;
  color: var(--text-primary);
  line-height: 22.88px;
}

.skill-level {
  font-size: calc(0.625rem * var(--font-scale));
  color: #FFB300;
  line-height: 17.6px;
}

.skill-evidence {
  font-size: calc(0.625rem * var(--font-scale));
  color: var(--text-hint);
  margin-top: 2px;
  line-height: 17.6px;
}

.two-col {
  display: flex;
  gap: 12px;
  margin-top: 12px;
}

.two-col > div {
  flex: 1;
}

.col-label {
  font-size: calc(0.75rem * var(--font-scale));
  font-weight: bold;
  margin-bottom: 4px;
  line-height: 21.12px;
}

.col-label.good {
  color: var(--success);
}

.col-label.bad {
  color: var(--error);
}

.col-item {
  font-size: calc(0.6875rem * var(--font-scale));
  color: var(--text-secondary);
  line-height: 20.57px;
}

.badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 12px;
}
</style>
