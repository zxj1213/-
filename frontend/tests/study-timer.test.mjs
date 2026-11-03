import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import { computed, reactive, ref } from 'vue'

// Exercise the component's actual setup code with a controlled clock and store.
const component = readFileSync(new URL('../src/components/StudyTimer.vue', import.meta.url), 'utf8')
const script = component.match(/<script setup>([\s\S]*?)<\/script>/)[1]
  .replace(/import[\s\S]*?from\s+['"][^'"]+['"]/g, '')

function setup(savedSession = null) {
  let now = 1000000
  let mount, unmount
  let pauses = 0
  const timers = new Set()
  const store = reactive({
    courses: [{ id: 'course', name: '课程' }],
    tasks: [{ id: 'task', title: '学习任务', courseName: '课程' }],
    todayTasks: [], kpMastery: {}, activeSession: savedSession,
    startSession(data) {
      this.activeSession = { ...data, status: 'running', accumulatedSeconds: 0, lastTick: now }
    },
    pauseSession(seconds) {
      pauses++
      this.activeSession.accumulatedSeconds = seconds
      this.activeSession.status = 'paused'
    },
    resumeSession() {
      this.activeSession.status = 'running'
      this.activeSession.lastTick = now
    },
    updateSessionSeconds(seconds) {
      this.activeSession.accumulatedSeconds = seconds
      this.activeSession.lastTick = now
    },
    save() {}
  })
  const context = {
    ref, computed, watch() {},
    onMounted(fn) { mount = fn }, onUnmounted(fn) { unmount = fn },
    defineProps: () => ({ initialTask: store.tasks[0], initialCourseId: '' }),
    defineExpose() {}, useAppStore: () => store,
    ElMessage: { info() {}, warning() {} },
    Date: { now: () => now },
    setInterval(fn) { timers.add(fn); return fn },
    clearInterval(id) { timers.delete(id) }
  }
  vm.runInNewContext(`${script}\nthis.timer = { display, accumulated, showFinish, start, pause, tick, finishEarly, setTarget, targetMinutes, durationInput, progress, dashOffset };`, context)
  mount()
  return {
    ...context.timer, store, timers,
    advance(seconds) { now += seconds * 1000 },
    unmount: () => unmount(), pauses: () => pauses
  }
}

test('display uses hours:minutes:seconds and carries at minute/hour boundaries', () => {
  const timer = setup()
  for (const [seconds, expected] of [
    [0, '00:00:00'], [3, '00:00:03'], [59, '00:00:59'],
    [60, '00:01:00'], [63, '00:01:03'], [1500, '00:25:00'],
    [3599, '00:59:59'], [3600, '01:00:00']
  ]) {
    timer.accumulated.value = seconds
    assert.equal(timer.display.value, expected)
  }
})

test('pause excludes paused time and repeated start keeps a single interval', () => {
  const timer = setup()
  timer.start()
  timer.start()
  assert.equal(timer.timers.size, 1)
  timer.advance(3)
  timer.pause()
  assert.equal(timer.display.value, '00:00:03')
  timer.advance(120)
  timer.tick()
  assert.equal(timer.display.value, '00:00:03')
  timer.start()
  timer.advance(2)
  timer.tick()
  assert.equal(timer.display.value, '00:00:05')
})

test('reaching target pauses once and opens finish without recursion or overshoot', () => {
  const timer = setup()
  timer.start()
  timer.advance(1508)
  timer.tick()
  assert.equal(timer.display.value, '00:25:00')
  assert.equal(timer.store.activeSession.accumulatedSeconds, 1500)
  assert.equal(timer.store.activeSession.status, 'paused')
  assert.equal(timer.showFinish.value, true)
  assert.equal(timer.pauses(), 1)
  assert.equal(timer.timers.size, 0)
})

test('manual finish exactly at target also pauses without recursion', () => {
  const timer = setup()
  timer.start()
  timer.advance(1500)
  timer.finishEarly()
  assert.equal(timer.display.value, '00:25:00')
  assert.equal(timer.showFinish.value, true)
  assert.equal(timer.pauses(), 1)
})

test('refresh restores elapsed time from timestamps without double counting', () => {
  const timer = setup({ taskId: 'task', targetMinutes: 25, status: 'running',
    accumulatedSeconds: 60, lastTick: 997000 })
  assert.equal(timer.display.value, '00:01:03')
  timer.advance(1)
  timer.tick()
  assert.equal(timer.display.value, '00:01:04')
})

test('refresh after target completes immediately, without starting an interval', () => {
  const timer = setup({ taskId: 'task', targetMinutes: 25, status: 'running',
    accumulatedSeconds: 0, lastTick: -1000000 })
  assert.equal(timer.display.value, '00:25:00')
  assert.equal(timer.showFinish.value, true)
  assert.equal(timer.store.activeSession.status, 'paused')
  assert.equal(timer.timers.size, 0)
})

test('paused refresh stays paused and navigation preserves elapsed seconds', () => {
  const timer = setup({ taskId: 'task', targetMinutes: 25, status: 'paused',
    accumulatedSeconds: 63, lastTick: 0 })
  assert.equal(timer.display.value, '00:01:03')
  assert.equal(timer.timers.size, 0)
  timer.start()
  timer.advance(2)
  timer.unmount()
  assert.equal(timer.store.activeSession.accumulatedSeconds, 65)
  assert.equal(timer.timers.size, 0)
})

test('slider, manual input and presets share the same target within 0–120 minutes', () => {
  const timer = setup()
  timer.durationInput.value = 37
  assert.equal(timer.targetMinutes.value, 37)
  timer.setTarget(60)
  assert.equal(timer.durationInput.value, 60)
  timer.durationInput.value = 200
  assert.equal(timer.targetMinutes.value, 120)
  timer.durationInput.value = -1
  assert.equal(timer.targetMinutes.value, 0)
  timer.durationInput.value = 25.6
  assert.equal(timer.targetMinutes.value, 26)
  for (const invalid of [undefined, null, NaN, Infinity, '']) {
    timer.durationInput.value = invalid
    assert.equal(timer.targetMinutes.value, 26)
  }
})

test('zero target keeps ring valid and cannot create an empty session', () => {
  const timer = setup()
  timer.durationInput.value = 0
  assert.equal(timer.progress.value, 0)
  assert.equal(Number.isFinite(timer.dashOffset.value), true)
  timer.start()
  assert.equal(timer.store.activeSession, null)
  assert.equal(timer.timers.size, 0)
  assert.equal(timer.showFinish.value, false)
})

test('custom target is used for completion and stays locked while running or paused', () => {
  const timer = setup()
  timer.durationInput.value = 2
  timer.start()
  assert.equal(timer.store.activeSession.targetMinutes, 2)
  timer.durationInput.value = 45
  assert.equal(timer.targetMinutes.value, 2)
  timer.advance(3)
  timer.pause()
  timer.setTarget(25)
  assert.equal(timer.targetMinutes.value, 2)
  timer.start()
  timer.advance(117)
  timer.tick()
  assert.equal(timer.display.value, '00:02:00')
  assert.equal(timer.showFinish.value, true)
})

test('two-hour custom session restores and completes at 02:00:00', () => {
  const timer = setup({ taskId: 'task', targetMinutes: 120, status: 'running',
    accumulatedSeconds: 7190, lastTick: 997000 })
  assert.equal(timer.durationInput.value, 120)
  assert.equal(timer.display.value, '01:59:53')
  timer.advance(7)
  timer.tick()
  assert.equal(timer.display.value, '02:00:00')
  assert.equal(timer.showFinish.value, true)
  assert.equal(timer.store.activeSession.accumulatedSeconds, 7200)
})
