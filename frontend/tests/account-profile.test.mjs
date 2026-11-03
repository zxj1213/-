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
    ...constants, ...adaptive, mock, defineStore, localStorage,
    setApiToken() {}, ElMessage: { error() {} },
    window: { matchMedia: () => ({ matches: false }) },
    document: { documentElement: { classList: { toggle() {} }, setAttribute() {}, style: {} } }
  }
  vm.runInNewContext(`${source}\nthis.makeStore = () => useAppStore;`, ctx)
  const freshStore = () => ctx.makeStore()(createPinia())
  return { store: freshStore(), freshStore, localStorage }
}

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
