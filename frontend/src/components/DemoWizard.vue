<template>
  <div class="wizard">
    <div class="wz-note">
      ⚠️ 演示数据为示例数据，已与真实学习结果分开标注，不代表实际测试结论
    </div>

    <div
      v-for="(step, i) in steps"
      :key="step.key"
      class="wz-step"
      :class="{ done: step.done, active: i === currentStep && !step.done }"
    >
      <div class="wz-head">
        <span class="wz-num" :class="{ ok: step.done }">{{ step.done ? '✓' : i + 1 }}</span>
        <div class="wz-title">{{ step.title }}</div>
        <el-button
          v-if="!step.done && i === currentStep"
          size="small"
          type="primary"
          round
          :loading="running"
          @click="runStep(step)"
        >{{ step.btn }}</el-button>
      </div>
      <div class="wz-desc">{{ step.desc }}</div>
      <div v-if="step.done && step.result" class="wz-result">{{ step.result }}</div>
    </div>

    <div v-if="allDone" class="wz-footer">
      <el-button type="primary" round size="large" style="width: 100%" @click="$emit('done')">
        前往「考试Agent」查看调整后的计划对比 →
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { useAppStore } from '../store'
import { addDays, todayStr } from '../constants'

const emit = defineEmits(['done'])
const store = useAppStore()

const running = ref(false)
const currentStep = ref(0)

const steps = reactive([
  {
    key: 'reset',
    title: '第 1 步 · 加载演示数据',
    desc: '重置为「数据结构」示例课程与演示任务数据',
    btn: '执行',
    done: false,
    result: ''
  },
  {
    key: 'materials',
    title: '第 2 步 · 上传资料 → AI 提取知识点',
    desc: '模拟上传数据结构课件，解析出「二叉树遍历 / 线索二叉树 / 哈夫曼树」等知识点（可人工确认）',
    btn: '执行',
    done: false,
    result: ''
  },
  {
    key: 'exam',
    title: '第 3 步 · 设置考试 → 生成计划',
    desc: '设置「7 天后考试，每天可学习 90 分钟」，系统按硬约束生成逐日计划',
    btn: '执行',
    done: false,
    result: ''
  },
  {
    key: 'quiz',
    title: '第 4 步 · 完成知识点测验',
    desc: '学生完成测验：线索二叉树题目全部答错，其他知识点正常',
    btn: '执行',
    done: false,
    result: ''
  },
  {
    key: 'adjust',
    title: '第 5 步 · 计划自动调整 + 前后对比',
    desc: '系统降低「线索二叉树」掌握度，重排计划并输出调整说明与逐日差异',
    btn: '执行',
    done: false,
    result: ''
  }
])

const allDone = computed(() => steps.every(s => s.done))

async function runStep(step) {
  running.value = true
  try {
    switch (step.key) {
      case 'reset': {
        store.resetData()
        step.result = '✓ 演示数据已就绪：数据结构课程、5 项任务、3 场考试（数据已标注示例）'
        break
      }
      case 'materials': {
        store.addKnowledgeDoc({
          title: '数据结构课件-演示版.pdf',
          type: 'PDF',
          courseName: '数据结构',
          summary: '【示例】解析出 3 个知识点：二叉树遍历、线索二叉树、哈夫曼树（来源：第6章 P45-72）'
        })
        store.addKnowledgePoints('course_001', [
          { name: '线索二叉树', source: '数据结构课件-演示版.pdf 第6章 P58-66' },
          { name: '哈夫曼树', source: '数据结构课件-演示版.pdf 第6章 P67-72' }
        ])
        step.result = '✓ 解析完成并已人工确认：二叉树遍历（掌握度45%）、线索二叉树（38%）、哈夫曼树（52%）已进入计划流程'
        break
      }
      case 'exam': {
        store.updateExam('exam1', {
          date: `${addDays(todayStr(), 7)} 09:00`,
          dailyMinutes: 90,
          targetScore: 88
        })
        const r = store.replanExam('exam1')
        step.result = `✓ 考试设置：7天后 · 每日预算90分钟\n${r.explanation.split('\n').slice(-2).join('\n')}`
        break
      }
      case 'quiz': {
        // 模拟测验作答：线索二叉树 2 题全错，其余知识点正确
        const after = store.submitQuiz('course_001', [
          { kp: '线索二叉树', correct: false },
          { kp: '线索二叉树', correct: false },
          { kp: '二叉树', correct: true },
          { kp: '图结构', correct: true },
          { kp: '排序', correct: true }
        ])
        const lines = Object.entries(after).map(([kp, s]) =>
          `• ${kp}：${s.correct}/${s.total} 题 → 掌握度 ${s.mastery}%`
        ).join('\n')
        step.result = `✓ 测验完成（5 题）：\n${lines}`
        break
      }
      case 'adjust': {
        const r = store.replanExam('exam1')
        const diffLines = (r.changes || []).slice(0, 3).map(c =>
          `• Day${c.day} ${c.date.slice(5)}：${c.from} → ${c.to}（${c.reason}）`
        ).join('\n')
        step.result = `✓ 计划已重排：\n${diffLines || '（计划与调整前一致）'}\n\n${r.explanation}`
        break
      }
    }
    step.done = true
    const next = steps.findIndex(s => !s.done)
    currentStep.value = next === -1 ? steps.length : next
  } finally {
    running.value = false
  }
}
</script>

<script>
export default { name: 'DemoWizard' }
</script>

<style scoped>
.wizard {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.wz-note {
  font-size: calc(0.6875rem * var(--font-scale));
  color: var(--warning);
  background: rgba(255, 152, 0, 0.08);
  border-radius: 6px;
  padding: 8px;
  line-height: 18.15px;
}

.wz-step {
  border: 1px solid var(--divider);
  border-radius: 10px;
  padding: 12px;
  transition: all 0.2s;
}

.wz-step.active {
  border-color: var(--primary);
  background: rgba(30, 136, 229, 0.04);
}

.wz-step.done {
  border-color: rgba(76, 175, 80, 0.4);
}

.wz-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.wz-num {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--bg-primary);
  border: 1px solid var(--divider);
  color: var(--text-secondary);
  font-size: calc(0.6875rem * var(--font-scale));
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  line-height: 19.36px;
}

.wz-num.ok {
  background: var(--success);
  border-color: var(--success);
  color: #fff;
}

.wz-title {
  flex: 1;
  font-size: calc(0.8125rem * var(--font-scale));
  font-weight: 600;
  color: var(--text-primary);
  line-height: 22.88px;
}

.wz-desc {
  font-size: calc(0.6875rem * var(--font-scale));
  color: var(--text-hint);
  margin: 6px 0 0 32px;
  line-height: 19.36px;
}

.wz-result {
  font-size: calc(0.6875rem * var(--font-scale));
  color: var(--secondary);
  background: rgba(38, 166, 154, 0.06);
  border-radius: 6px;
  padding: 8px;
  margin: 8px 0 0 32px;
  white-space: pre-wrap;
  line-height: 20.57px;
}

.wz-footer {
  padding: 8px 0 4px;
}
</style>
