import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const moduleUrl = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64')
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const constantsUrl = moduleUrl(read('../src/constants/index.js'))
const {
  coursesOnDate, finalizeTimetable, parseCsv, parseTimetableScreenshot, parseTimetableTable
} = await import(moduleUrl(read('../src/services/timetable.js').replace("'../constants'", JSON.stringify(constantsUrl))))

test('CSV list imports quoted fields and resolves odd weeks and a one-time course', () => {
  const csv = '\uFEFF课程名称,星期,周次,节次,日期,上课地点,开始时间,结束时间\r\n' +
    '"数据结构,实验",周一,1-8单,第1-2节,,东院 A201,8:00,9:40\r\n' +
    '调课,,,3,2026-11-09,东院 B302,,\r\n'
  const drafts = parseTimetableTable(parseCsv(csv))
  assert.equal(drafts[0].courseName, '数据结构,实验')
  assert.equal(drafts[0].startTime, '08:00')
  assert.equal(finalizeTimetable(drafts, ''), null)
  assert.equal(finalizeTimetable(drafts, '2026-11-03'), null)
  const schedule = finalizeTimetable([...drafts, drafts[0]], '2026-11-02')
  assert.equal(schedule.rows.length, 2)
  assert.deepEqual(coursesOnDate(schedule, '2026-11-02').map(row => row.courseName), ['数据结构,实验'])
  assert.deepEqual(coursesOnDate(schedule, '2026-11-09').map(row => row.courseName), ['调课'])
  assert.deepEqual(coursesOnDate(schedule, '2026-11-16').map(row => row.courseName), ['数据结构,实验'])
  assert.deepEqual(coursesOnDate(schedule, '2026-10-26'), [])
})

test('week-grid cells and OCR positions preserve day, period and text without inventing hours', () => {
  const rows = [
    ['2026 秋季课表'],
    ['节次', '星期一', '星期二'],
    ['第1-2节', '高等数学\n第1-12周\n教室：A201', ''],
    ['第3-4节', '', '大学英语\n教师：李老师']
  ]
  const parsed = parseTimetableTable(rows)
  assert.equal(parsed[0].periods, '1-2')
  assert.equal(parsed[0].weeks, '1-12')
  assert.equal(parsed[0].classroom, 'A201')
  assert.equal(parsed[0].startTime, '')
  assert.equal(parsed[1].weekday, 2)
  assert.equal(parsed[1].teacher, '李老师')

  const box = (text, x, y) => ({ text, box: [x - 30, y - 7, x + 30, y + 7] })
  const screenshot = parseTimetableScreenshot([
    box('节次', 60, 20), box('星期一', 200, 20), box('星期二', 400, 20),
    box('第1-2节', 60, 100), box('高等数学', 200, 90), box('1-12周', 200, 112),
    box('第3-4节', 60, 230), box('大学英语', 400, 225), box('B301', 400, 247)
  ])
  assert.deepEqual(screenshot.rows.map(row => [row.courseName, row.weekday, row.periods]), [
    ['高等数学', 1, '1-2'], ['大学英语', 2, '3-4']
  ])
  assert.match(screenshot.text, /B301/)
  assert.deepEqual(parseTimetableScreenshot([box('不明图片', 50, 30)]).rows, [])
})
