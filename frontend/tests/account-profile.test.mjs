import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import { createPinia, defineStore } from 'pinia'
import { computed, nextTick, reactive, ref, watch } from 'vue'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const moduleUrl = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64')
const constantsUrl = moduleUrl(read('../src/constants/index.js'))
const constants = await import(constantsUrl)
const mock = await import(moduleUrl(read('../src/mock/data.js').replace("'../constants'", JSON.stringify(constantsUrl))))
const adaptive = await import(moduleUrl(read('../src/services/adaptive.js')))
const { buildDailyReview } = await import(moduleUrl(read('../src/services/dailyReview.js')))
const timetable = await import(moduleUrl(read('../src/services/timetable.js').replace("'../constants'", JSON.stringify(constantsUrl))))
const stripImports = source => source.replace(/import[\s\S]*?from\s+['"][^'"]+['"]/g, '')
const source = stripImports(read('../src/store/index.js')).replace('export const useAppStore', 'const useAppStore')

function setup() {
  const saved = new Map()
  const localStorage = {
    getItem: key => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, String(value)),
    removeItem: key => saved.delete(key)
  }
  const ctx = {
    ...constants, ...adaptive, ...timetable, mock, buildDailyReview, defineStore, localStorage,
    setApiToken() {}, ElMessage: { error() {} },
    window: { matchMedia: () => ({ matches: false }) },
    document: { documentElement: { classList: { toggle() {} }, setAttribute() {}, style: { setProperty(key, value) { this[key] = value } } } }
  }
  vm.runInNewContext(`${source}\nthis.makeStore = () => useAppStore;`, ctx)
  const freshStore = () => ctx.makeStore()(createPinia())
  return { store: freshStore(), freshStore, localStorage, document: ctx.document }
}

test('a confirmed timetable is private to the local account and survives refresh', () => {
  const { store, freshStore } = setup()
  store.login('我的课表', 'pass1234')
  const today = constants.todayStr()
  const row = timetable.createTimetableRow({ courseName: '大学物理', date: today, periods: '3-4' })
  assert.equal(store.saveTimetable([row], ''), true)
  assert.equal(store.scheduledCourses(today)[0].courseName, '大学物理')
  assert.equal(store.saveTimetable([{ ...row, periods: '' }], ''), false)
  const restored = freshStore()
  restored.init()
  assert.equal(restored.scheduledCourses(today)[0].periods, '3-4')
  restored.logout()
  restored.login('另一位同学', 'pass5678')
  assert.equal(restored.timetable, null)
})

test('daily review preserves notes and confirmation and updates one saved summary per date', () => {
  const { store, freshStore } = setup()
  store.login('复盘测试', 'pass1234')
  const date = constants.todayStr()
  assert.deepEqual(Array.from(store.reviews), [])
  const empty = store.generateTodayReview()
  assert.equal(empty.hasActivity, false)
  assert.equal(empty.efficiencyScore, null)
  assert.equal(store.confirmReview(date), null)

  const task = store.addTask({ title: '练习', deadline: date, status: '待完成', estimatedDuration: 30 })
  store.completeTask(task.id)
  store.addSessionLog({ date, minutes: 30 })
  assert.equal(store.generateTodayReview().efficiencyScore, 100)
  store.addReviewNote(date, '复习错题')
  store.confirmReview(date)
  store.addSessionLog({ date, minutes: 10 })
  const updated = store.generateTodayReview()
  assert.equal(updated.id, empty.id)
  assert.equal(updated.userConfirmed, true)
  assert.deepEqual(Array.from(updated.notes), ['复习错题'])
  assert.equal(updated.focusMinutes, 40)
  assert.equal(updated.efficiencyScore, 100)

  const restored = freshStore()
  restored.init()
  assert.equal(restored.reviews.length, 1)
  assert.equal(restored.reviews[0].userConfirmed, true)
  assert.equal(restored.reviews[0].notes[0], '复习错题')
  assert.match(restored.portrait.studyReview.summary, /40 分钟/)
  const memories = restored.aiMemories.filter(memory => memory.id === 'daily-review-' + date)
  assert.equal(memories.length, 1)
  assert.match(memories[0].content, /40 分钟/)
})

test('legacy review migration drops stock examples and retains authored notes and confirmation', () => {
  const { store, freshStore, localStorage } = setup()
  store.login('旧版复盘', 'pass1234')
  const key = constants.StorageConstants.stateKeyOf(store.currentUserId)
  const saved = JSON.parse(localStorage.getItem(key))
  delete saved.reviewDataVersion
  const date = constants.todayStr()
  saved.reviews = [
    { id: 'sample', date: constants.addDays(date, -1), userConfirmed: true,
      deviationExplanation: '上午完成了数据结构和机器学习课程，下午完成了二叉树作业。' },
    { id: 'confirmed', date, userConfirmed: true, deviationExplanation: '旧版统计\n\n📝 补充：保留的备注' }
  ]
  localStorage.setItem(key, JSON.stringify(saved))
  const restored = freshStore()
  restored.init()
  assert.equal(restored.reviews.length, 1)
  assert.equal(restored.reviews[0].legacy, true)
  const updated = restored.generateTodayReview()
  assert.equal(updated.id, 'confirmed')
  assert.equal(updated.userConfirmed, true)
  assert.deepEqual(Array.from(updated.notes), ['保留的备注'])
})

test('daily review leaves the last saved report intact when browser storage is unavailable', () => {
  const { store, localStorage } = setup()
  store.login('存储测试', 'pass1234')
  const date = constants.todayStr()
  store.addSessionLog({ date, minutes: 20 })
  const review = store.generateTodayReview()
  localStorage.setItem = () => { throw new Error('storage unavailable') }
  assert.equal(store.addReviewNote(date, '本次未写入'), null)
  assert.equal(store.confirmReview(date), null)
  assert.equal(store.reviews[0].id, review.id)
  assert.equal(store.reviews[0].userConfirmed, false)
  assert.equal(store.reviews[0].notes.length, 0)
  assert.equal(store.portrait.studyReview, undefined)
  assert.equal(store.aiMemories.some(memory => memory.id === 'daily-review-' + date), false)
})

test('binding a legacy account keeps its local identity and removes the local password hash', () => {
  const { store, freshStore } = setup()
  store.login('迁移同学', 'old-password')
  const oldId = store.currentUserId
  store.updateProfile({ school: '武汉理工大学' })
  store.connectServerAccount('迁移同学', 'a'.repeat(32))
  assert.equal(store.currentUserId, oldId)
  assert.equal(store.userInfo.school, '武汉理工大学')
  assert.equal(store._readUsers()[0].hash, undefined)
  assert.equal(store.authState.serverAccountId, 'a'.repeat(32))
  assert.throws(() => store.connectServerAccount('迁移同学', 'b'.repeat(32)))
  const restored = freshStore()
  restored.init()
  assert.equal(restored.authState.serverAccountId, 'a'.repeat(32))
  assert.equal(restored.currentUserId, oldId)
})

test('registration links profile identity to account and starts with empty personal fields', () => {
  const { store } = setup()
  const result = store.login('  小林  ', 'pass1234')
  assert.equal(result.ok, true)
  assert.equal(result.registered, true)
  assert.equal(store.currentUserName, '小林')
  assert.equal(store.userInfo.name, '小林')
  assert.equal(store.userInfo.id, store.currentUserId)
  for (const key of ['school', 'major', 'grade', 'email']) assert.equal(store.userInfo[key], '')
})

test('personal fields persist across logout/login and refresh, without changing credentials', () => {
  const { store, freshStore } = setup()
  store.login('小林', 'pass1234')
  assert.equal(store.updateProfile({ name: 'other', id: 'other', school: ' 北京大学 ',
    major: '数学', grade: '大二', email: 'lin@example.com' }), true)
  assert.equal(store.userInfo.name, '小林')
  assert.equal(store.userInfo.school, '北京大学')
  store.logout()
  assert.equal(store.login('小林', 'wrong').ok, false)
  const result = store.login('小林', 'pass1234')
  assert.equal(result.registered, false)
  assert.equal(store.userInfo.email, 'lin@example.com')
  const refreshed = freshStore()
  refreshed.init()
  assert.equal(refreshed.currentUserName, '小林')
  assert.equal(refreshed.userInfo.name, '小林')
  assert.equal(refreshed.userInfo.school, '北京大学')
  assert.equal(refreshed.userInfo.major, '数学')
  assert.equal(refreshed.userInfo.grade, '大二')
})

test('switching accounts keeps personal fields isolated', () => {
  const { store } = setup()
  store.login('甲同学', 'pass1234')
  store.updateProfile({ school: '甲学校' })
  store.logout()
  store.login('乙同学', 'pass5678')
  assert.equal(store.userInfo.name, '乙同学')
  assert.equal(store.userInfo.school, '')
  store.updateProfile({ school: '乙学校' })
  store.logout()
  store.login('甲同学', 'pass1234')
  assert.equal(store.userInfo.name, '甲同学')
  assert.equal(store.userInfo.school, '甲学校')
})

test('changing the password persists for the same account and keeps its data', () => {
  const { store, freshStore } = setup()
  store.login('小林', 'old-pass')
  const accountId = store.currentUserId
  store.updateProfile({ school: '原学校' })

  assert.equal(store.changePassword('old-pass', 'new-pass').ok, true)
  const refreshed = freshStore()
  refreshed.init()
  assert.equal(refreshed.currentUserId, accountId)
  assert.equal(refreshed.verifyLocalPassword('old-pass'), false)
  assert.equal(refreshed.verifyLocalPassword('new-pass'), true)
  refreshed.logout()
  assert.equal(refreshed.login('小林', 'old-pass').ok, false)
  assert.equal(refreshed.login('小林', 'new-pass').ok, true)
  assert.equal(refreshed.userInfo.school, '原学校')
})

test('validation and storage failures leave the current password usable', () => {
  const { store, localStorage } = setup()
  store.login('小林', 'old-pass')
  assert.equal(store.changePassword('wrong-pass', 'new-pass').ok, false)
  assert.equal(store.changePassword('old-pass', '123').ok, false)
  assert.equal(store.changePassword('old-pass', 'old-pass').ok, false)
  localStorage.setItem = () => { throw new Error('Storage unavailable') }
  assert.equal(store.changePassword('old-pass', 'new-pass').ok, false)
  assert.equal(store.verifyLocalPassword('old-pass'), true)
  assert.equal(store.verifyLocalPassword('new-pass'), false)
})

test('existing profiles are linked on refresh without losing school information', () => {
  const { store, freshStore, localStorage } = setup()
  store.login('老用户', 'pass1234')
  const key = constants.StorageConstants.stateKeyOf(store.currentUserId)
  const old = JSON.parse(localStorage.getItem(key))
  old.userInfo = { ...old.userInfo, id: 'user_001', name: '张同学', school: '已填学校', major: '已填专业' }
  localStorage.setItem(key, JSON.stringify(old))
  const refreshed = freshStore()
  refreshed.init()
  assert.equal(refreshed.userInfo.name, '老用户')
  assert.equal(refreshed.userInfo.id, refreshed.currentUserId)
  assert.equal(refreshed.userInfo.school, '已填学校')
  assert.equal(refreshed.userInfo.major, '已填专业')
})

test('resetting learning demo data preserves account and personal details', () => {
  const { store } = setup()
  store.login('小林', 'pass1234')
  store.updateProfile({ school: '原学校', grade: '大三' })
  const id = store.currentUserId
  store.resetData()
  assert.equal(store.currentUserId, id)
  assert.equal(store.userInfo.name, '小林')
  assert.equal(store.userInfo.school, '原学校')
  assert.equal(store.userInfo.grade, '大三')
})

test('profile dialog reloads saved values on each open; cancel does not change profile', async () => {
  const { store } = setup()
  store.login('小林', 'pass1234')
  store.updateProfile({ school: '原学校', major: '数学', grade: '大三', email: 'lin@example.com' })
  const component = read('../src/views/PersonalCenterView.vue')
  const script = stripImports(component.match(/<script setup>([\s\S]*?)<\/script>/)[1])
  const ctx = { ref, computed, reactive, watch, useAppStore: () => store,
    defineProps: () => ({ section: 'profile' }), ElMessage: { success() {} }, ...constants }
  vm.runInNewContext(`${script}\nthis.form = { showEdit, editForm, saveProfile, showGradePicker, selectGrade, grade };`, ctx)
  const { showEdit, editForm, saveProfile, showGradePicker, selectGrade, grade } = ctx.form
  showEdit.value = true
  await nextTick()
  assert.equal(editForm.school, '原学校')
  assert.equal(editForm.email, 'lin@example.com')
  assert.equal(editForm.grade, '大三')
  for (const option of ['大一', '大二', '大三', '大四']) {
    showGradePicker.value = true
    selectGrade(option)
    assert.equal(editForm.grade, option)
    assert.equal(showGradePicker.value, false)
    assert.equal(store.userInfo.grade, '大三')
  }
  editForm.school = '取消的学校'
  showGradePicker.value = true
  showEdit.value = false
  await nextTick()
  assert.equal(store.userInfo.school, '原学校')
  assert.equal(showGradePicker.value, false)
  assert.equal(grade.value, '大三')
  showEdit.value = true
  await nextTick()
  assert.equal(editForm.school, '原学校')
  assert.equal(editForm.grade, '大三')
  selectGrade('大四')
  editForm.school = '新学校'
  saveProfile()
  assert.equal(store.userInfo.school, '新学校')
  assert.equal(store.userInfo.major, '数学')
  assert.equal(store.userInfo.grade, '大四')
  assert.equal(grade.value, '大四')
  assert.equal(store.userInfo.name, '小林')
})

test('only the four offered grades can be saved', () => {
  const { store, freshStore } = setup()
  store.login('年级测试', 'pass1234')
  store.updateProfile({ grade: '大二' })
  store.updateProfile({ grade: '大五' })
  assert.equal(store.userInfo.grade, '大二')
  const refreshed = freshStore()
  refreshed.init()
  assert.equal(refreshed.userInfo.grade, '大二')
})

test('task creation, restoration and live refresh use the same deadline priority rules', () => {
  const { store, freshStore } = setup()
  store.login('任务测试', 'pass1234')
  const deadline = '2030-01-08 12:00'
  const task = store.addTask({ title: '内容任务', deadline, priority: '紧急',
    subTasks: [{ id: 's1', title: '内容1', completed: false }] })
  assert.ok(task.id)
  assert.ok(task.createdAt)
  assert.equal(task.priority, '低')
  const refreshed = freshStore()
  refreshed.init()
  const saved = refreshed.tasks.find(item => item.id === task.id)
  assert.equal(saved.subTasks[0].title, '内容1')
  for (const [now, priority] of [
    ['2030-01-01T11:59:59', '低'], ['2030-01-01T12:00:00', '中'],
    ['2030-01-05T12:00:00', '高'], ['2030-01-07T12:00:00', '紧急']
  ]) {
    refreshed.refreshTaskPriorities(new Date(now).getTime())
    assert.equal(saved.priority, priority)
  }
  refreshed.toggleSubTask(task.id, 's1')
  assert.equal(saved.status, '已完成')
})

test('theme choices and three font positions apply directly and survive refresh', () => {
  const { store, freshStore, document } = setup()
  store.login('外观设置测试', 'pass1234')
  const component = read('../src/views/PersonalCenterView.vue')
  const script = stripImports(component.match(/<script setup>([\s\S]*?)<\/script>/)[1])
  const ctx = { ref, computed, reactive, watch, useAppStore: () => store,
    defineProps: () => ({ section: 'settings' }), ElMessage: { success() {} }, ...constants }
  vm.runInNewContext(`${script}\nthis.preferences = { selectTheme, showThemePicker, fontSizeStep };`, ctx)
  const { selectTheme, showThemePicker, fontSizeStep } = ctx.preferences
  for (const theme of ['dark', 'light', 'auto']) {
    showThemePicker.value = true
    selectTheme(theme)
    assert.equal(store.settings.theme, theme)
    assert.equal(showThemePicker.value, false)
  }
  selectTheme('invalid')
  assert.equal(store.settings.theme, 'auto')
  for (const [step, size] of [[2, 'large'], [0, 'small'], [1, 'medium']]) {
    fontSizeStep.value = step
    assert.equal(store.settings.fontSize, size)
    assert.equal(fontSizeStep.value, step)
    assert.equal(document.documentElement.style.fontSize, '16px')
    assert.equal(document.documentElement.style['--font-scale'], { small: '0.92', medium: '1', large: '1.1' }[size])
  }
  fontSizeStep.value = 2
  const refreshed = freshStore()
  refreshed.init()
  assert.equal(refreshed.settings.fontSize, 'large')
  assert.equal(refreshed.settings.theme, 'auto')
})
