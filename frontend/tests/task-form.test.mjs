import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import { ref, reactive, computed, watch, nextTick } from 'vue'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const constantsUrl = 'data:text/javascript;base64,' + Buffer.from(read('../src/constants/index.js')).toString('base64')
const constants = await import(constantsUrl)
const script = read('../src/views/TaskHubView.vue').match(/<script setup>([\s\S]*?)<\/script>/)[1]
  .replace(/import[\s\S]*?from\s+['"][^'"]+['"]/g, '')
function setup() {
  const added = [], warnings = []
  const store = reactive({ tasks: [], addTask: task => added.push(task), taskPriorityNow: Date.now() })
  const ctx = { ...constants, ref, reactive, computed, watch, nextTick, onMounted() {},
    useAppStore: () => store, useRoute: () => ({ query: {} }), useRouter: () => ({}),
    ElMessage: { success() {}, warning: message => warnings.push(message) } }
  vm.runInNewContext(`${script}\nthis.form = { taskForm, taskPriority, addTaskContent, removeTaskContent, createTask, showAddTask, activeFilter, filteredTasks };`, ctx)
  return { ...ctx.form, store, added, warnings }
}

test('priority thresholds use exact remaining duration including the 1, 3 and 7 day boundaries', () => {
  const now = new Date('2026-11-03T12:00:00').getTime()
  const day = 86400000
  for (const [offset, expected] of [
    [-day, '紧急'], [0, '紧急'], [day - 1, '紧急'], [day, '紧急'], [day + 1, '高'],
    [3 * day - 1, '高'], [3 * day, '高'], [3 * day + 1, '中'],
    [7 * day - 1, '中'], [7 * day, '中'], [7 * day + 1, '低']
  ]) assert.equal(constants.getTaskPriority(new Date(now + offset).toISOString(), now), expected)
  assert.equal(constants.getTaskPriority('', now), '低')
  assert.equal(Number.isNaN(constants.taskDeadlineTime('invalid')), true)
})

test('task contents start with one field, add one at a time up to ten, and retain at least one', () => {
  const form = setup()
  assert.equal(form.taskForm.contents.length, 1)
  form.taskForm.contents[0] = '保留内容'
  for (let count = 2; count <= 10; count++) {
    form.addTaskContent(0)
    assert.equal(form.taskForm.contents.length, count)
  }
  form.addTaskContent(0)
  assert.equal(form.taskForm.contents.length, 10)
  assert.equal(form.taskForm.contents[0], '保留内容')
  for (let i = 0; i < 12; i++) form.removeTaskContent(form.taskForm.contents.length - 1)
  assert.equal(form.taskForm.contents.length, 1)
  assert.equal(form.taskForm.contents[0], '保留内容')
})

test('name, valid deadline and every content field are required without losing the draft', () => {
  const form = setup()
  form.createTask()
  form.taskForm.title = '学习'
  form.createTask()
  form.taskForm.deadline = 'invalid'
  form.createTask()
  form.taskForm.deadline = '2026-11-06 18:00'
  form.createTask()
  form.taskForm.contents = ['已填', '   ']
  form.createTask()
  assert.equal(form.warnings.length, 5)
  assert.equal(form.added.length, 0)
  assert.equal(form.taskForm.contents[0], '已填')
})

test('creation saves exact title/deadline and all contents as independently checkable subtasks', () => {
  const form = setup()
  form.showAddTask.value = true
  form.taskForm.title = '  数据结构实验  '
  form.taskForm.deadline = '2030-01-01 18:30'
  form.taskForm.contents = Array.from({ length: 10 }, (_, i) => ` 内容${i + 1} `)
  form.createTask()
  assert.equal(form.added.length, 1)
  const task = form.added[0]
  assert.equal(task.title, '数据结构实验')
  assert.equal(task.deadline, '2030-01-01 18:30')
  assert.equal(task.priority, '低')
  assert.equal(task.subTasks.length, 10)
  assert.equal(new Set(task.subTasks.map(sub => sub.id)).size, 10)
  assert.equal(task.subTasks[0].title, '内容1')
  assert.ok(task.subTasks.every(sub => sub.completed === false))
  assert.equal(task.description, task.subTasks.map(sub => sub.title).join('\n'))
  assert.equal(form.showAddTask.value, false)
  assert.equal(form.taskForm.contents.length, 1)
  assert.equal(form.taskForm.contents[0], '')
  assert.equal(form.taskForm.title, '')
  assert.equal(form.taskForm.deadline, '')
})

test('priority preview changes as the deadline approaches and urgent filter excludes high priority', () => {
  const form = setup()
  form.taskForm.deadline = '2026-11-06 12:00'
  form.store.taskPriorityNow = new Date('2026-11-03T12:00:00').getTime()
  assert.equal(form.taskPriority.value, '高')
  form.store.taskPriorityNow += 2 * 86400000
  assert.equal(form.taskPriority.value, '紧急')
  form.store.tasks = [{ priority: '高' }, { priority: '紧急' }]
  form.activeFilter.value = '紧急'
  assert.equal(form.filteredTasks.value.length, 1)
  assert.equal(form.filteredTasks.value[0].priority, '紧急')
})

test('AI parsing follows deadline urgency rather than priority words', async () => {
  const aiSource = read('../src/services/ai.js').replace("'../constants'", JSON.stringify(constantsUrl))
  const ai = await import('data:text/javascript;base64,' + Buffer.from(aiSource).toString('base64'))
  const task = ai.parseTaskFromText('紧急：20天后完成阅读')
  assert.equal(task.priority, '低')
})
