import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import vm from 'node:vm'
const source = readFileSync('frontend/src/services/adaptive.js', 'utf8')
const { replanByResults, recordPractice } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))
const sum = p => [...p.chapters, ...p.practiceTasks].reduce((a, b) => a + b.estimatedMinutes, 0)
for (const budget of [1, 30, 90, 150]) {
  const result = replanByResults({ exam: { id:'e', dailyMinutes:budget }, course:{id:'c'}, kpMastery:{c:{a:{mastery:30},b:{mastery:40},c:{mastery:50}}}, daysLeft:3,targetScore:85,prevPlans:[] })
  for (const p of result.plans) { assert.ok(sum(p) <= budget); assert.ok(Math.abs(sum(p) - p.estimatedHours*60) < 1e-8) }
  assert.equal(result.plans.reduce((n,p)=>n+sum(p),0)+result.unscheduledMinutes,300)
}
const today = new Date().toLocaleDateString('sv-SE')
const old = { date:today, completed:true, completedHours:1, chapters:[{estimatedMinutes:120}],practiceTasks:[] }
const params = { exam:{id:'e',dailyMinutes:30},course:{id:'c'},kpMastery:{c:{}},daysLeft:1,targetScore:85,prevPlans:[old] }
assert.deepEqual(replanByResults(params).plans[0], old)
assert.equal(replanByResults(params).overBudgetDays,1)
assert.equal(replanByResults({...params,daysLeft:0}).plans.length,0)
assert.equal(recordPractice({mastery:50},20,10).mastery,50)
// 执行真实组件函数，模拟目标时长到达，验证不会递归且只暂停一次。
const component = readFileSync('frontend/src/components/StudyTimer.vue','utf8')
function fn(name) { const start=component.indexOf(`function ${name}(`); const end=component.indexOf('\n}',start)+2; return component.slice(start,end) }
const ctx = {session:{value:{status:'running',lastTick:Date.now()-61000,accumulatedSeconds:0}},accumulated:{value:0},targetMinutes:{value:1},showFinish:{value:false},interval:null,clearInterval(){},store:{pauseSession(n){ctx.session.value.status='paused';ctx.pauses++;assert.equal(n,60)}},pauses:0}
vm.createContext(ctx);vm.runInContext([fn('tick'),fn('pause'),fn('openFinish'),'tick();tick();'].join('\n'),ctx)
assert.equal(ctx.pauses,1);assert.equal(ctx.showFinish.value,true)
console.log('PASS: budget conservation, locked/completed plans, expired exams, invalid practice, real timer functions')
