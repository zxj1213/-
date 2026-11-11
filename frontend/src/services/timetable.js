import { daysBetween } from '../constants'

export const weekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
export const maxTimetableRows = 200

const aliases = {
  courseName: ['课程', '课程名称', '课程名', '科目'],
  teacher: ['教师', '任课教师', '老师', '授课教师', '教师姓名'],
  classroom: ['教室', '上课地点', '地点', '教学地点'],
  weekday: ['星期', '星期几', '上课星期', '周几'],
  date: ['日期', '上课日期'],
  weeks: ['周次', '教学周', '上课周次', '上课周'],
  periods: ['节次', '上课节次', '上课节数'],
  startTime: ['开始时间', '上课时间', '起始时间'],
  endTime: ['结束时间', '下课时间']
}

const clean = value => String(value ?? '').normalize('NFKC').trim()
const titleKey = value => clean(value).replace(/\s/g, '')
const headerField = value => Object.keys(aliases).find(key => aliases[key].includes(titleKey(value)))
const rangeMark = /[–—－~～至]/g
const periodInText = /第?\s*(\d{1,2})(?:\s*[-–—~至]\s*(\d{1,2}))?\s*节/
const weekInText = /(?:第\s*)?(\d{1,2}(?:\s*[-–—~至]\s*\d{1,2})?(?:\s*[,，、]\s*\d{1,2}(?:\s*[-–—~至]\s*\d{1,2})?)*)\s*([单双])?\s*周\s*(?:[(（]?\s*([单双])周?\s*[)）]?)?/
const timeRange = /(\d{1,2}[:：]\d{2})\s*[-–—~至]\s*(\d{1,2}[:：]\d{2})/

function weekdayFrom(value, allowNumber = true) {
  const text = titleKey(value)
  const day = text.match(/^(?:星期|礼拜|周)([一二三四五六日天1-7])$/)?.[1]
    ?? (allowNumber && /^[1-7一二三四五六日天]$/.test(text) ? text : '')
  return Number(day) || '一二三四五六日'.indexOf(day === '天' ? '日' : day || '-') + 1
}

function periodsFrom(value) {
  const text = clean(value).replace(rangeMark, '-')
  const match = text.match(/^\s*第?\s*(\d{1,2})(?:\s*-\s*(\d{1,2}))?\s*节?\s*$/)
  if (!match) return ''
  const first = Number(match[1])
  const last = Number(match[2] || first)
  return first >= 1 && first <= last && last <= 30 ? (first === last ? String(first) : `${first}-${last}`) : ''
}

function timeFrom(value) {
  const text = clean(value)
  if (/^0(?:\.\d+)?$/.test(text)) {
    const minutes = Math.round(Number(text) * 1440)
    if (minutes < 1440) return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
  }
  const match = text.match(/^(\d{1,2}):(\d{2})(?::00)?$/)
  return match && Number(match[1]) < 24 && Number(match[2]) < 60 ? match[1].padStart(2, '0') + ':' + match[2] : ''
}

function dateFrom(value) {
  const text = clean(value).replace(/[年/.]/g, '-').replace('月', '-').replace(/日$/, '')
  if (/^[3-9]\d{4}$/.test(text)) {
    return new Date(Date.UTC(1899, 11, 30) + Number(text) * 86400000).toISOString().slice(0, 10)
  }
  const match = text.match(/^(20\d{2})-(\d{1,2})-(\d{1,2})$/)
  if (!match) return ''
  const date = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`
  const parsed = new Date(date + 'T00:00:00Z')
  return Number.isFinite(+parsed) && parsed.toISOString().slice(0, 10) === date ? date : ''
}

export function weekNumbers(value) {
  let text = titleKey(value).replace(rangeMark, '-').replace(/[、;；]/g, ',')
  if (!text || /^(每周|全周|全部)$/.test(text)) return []
  const parity = text.match(/\(?([单双])周?\)?$/)?.[1]
  text = text.replace(/\(?[单双]周?\)?$/, '').replace(/第|周/g, '')
  const weeks = new Set()
  for (const part of text.split(',')) {
    const match = part.match(/^(\d{1,2})(?:-(\d{1,2}))?$/)
    if (!match) return null
    const first = Number(match[1])
    const last = Number(match[2] || first)
    if (first < 1 || first > last || last > 60) return null
    for (let week = first; week <= last; week++) {
      if (!parity || week % 2 === (parity === '单' ? 1 : 0)) weeks.add(week)
    }
  }
  return weeks.size ? [...weeks] : null
}

export function createTimetableRow(values = {}) {
  return {
    courseName: '', teacher: '', classroom: '', weekday: 0, date: '', weeks: '',
    periods: '', startTime: '', endTime: '', sourceText: '', ...values
  }
}

export function parseCsv(text) {
  const source = text.replace(/^\uFEFF/, '')
  const separator = source.split(/\r?\n/).find(line => line.trim())?.includes('\t') ? '\t' : ','
  const rows = []
  let row = []
  let cell = ''
  let quoted = false
  const addCell = () => {
    row.push(cell)
    cell = ''
    if (row.length > 40) throw new Error('课表列数过多，请只保留课程相关列。')
  }
  const addRow = () => {
    addCell()
    if (row.some(value => value.trim())) rows.push(row)
    row = []
    if (rows.length > 500) throw new Error('课表超过 500 行，请拆分文件后重试。')
  }
  for (let i = 0; i < source.length; i++) {
    const char = source[i]
    if (char === '"' && (quoted || !cell)) {
      if (quoted && source[i + 1] === '"') {
        cell += '"'
        i++
      } else quoted = !quoted
    } else if (quoted) cell += char
    else if (char === separator) addCell()
    else if (char === '\r' || char === '\n') {
      addRow()
      if (char === '\r' && source[i + 1] === '\n') i++
    } else cell += char
  }
  if (quoted) throw new Error('CSV 引号未闭合，请重新导出文件。')
  addRow()
  return rows
}

function tableHeader(row) {
  const fields = row.map(headerField)
  if (fields.includes('courseName') && (fields.includes('weekday') || fields.includes('date'))) {
    return { fields }
  }
  const days = row.map(value => weekdayFrom(value, false))
  if (days.filter(Boolean).length >= 2) return { days }
  return null
}

function fromListRow(fields, cells) {
  const values = {}
  fields.forEach((field, index) => { if (field) values[field] = clean(cells[index]) })
  if (!values.courseName) return []
  const times = values.startTime?.match(timeRange)
  const start = times?.[1] || values.startTime || ''
  const end = times?.[2] || values.endTime || ''
  return [createTimetableRow({
    ...values, weekday: weekdayFrom(values.weekday),
    date: dateFrom(values.date) || values.date || '',
    periods: periodsFrom(values.periods) || values.periods || '',
    startTime: timeFrom(start) || start, endTime: timeFrom(end) || end,
    sourceText: cells.filter(Boolean).join(' · ')
  })]
}

function fromGridCell(text, weekday, slot) {
  return clean(text).split(/\n\s*\n|\n(?=课程(?:名称)?\s*[:：])/)
    .filter(part => part.trim())
    .map(part => {
      const lines = part.split(/\n/).map(clean).filter(Boolean)
      const periods = part.match(periodInText)
      const weeks = part.match(weekInText)
      const times = part.match(timeRange)
      const name = lines[0].replace(/^课程(?:名称)?\s*:\s*/, '').split(/\s+(?:第?\d.*?[周节]|教师:|教室:)/)[0]
      const getField = pattern => lines.map(line => line.match(pattern)?.[1]).find(Boolean) || ''
      return createTimetableRow({
        courseName: name, weekday,
        periods: periodsFrom(periods?.[0]) || slot,
        weeks: weeks ? weeks[1] + (weeks[2] || weeks[3] || '') : '',
        startTime: timeFrom(times?.[1]), endTime: timeFrom(times?.[2]),
        teacher: getField(/^(?:教师|任课教师|老师)\s*:\s*(.+)$/),
        classroom: getField(/^(?:教室|地点|上课地点)\s*:\s*(.+)$/) ||
          getField(/^((?:[A-Za-z]?\d+号?)?教学楼[^\s]*|教[一二三四五六七八九十]\S+|[A-Za-z]\d{3,})$/),
        sourceText: part
      })
    })
}

export function parseTimetableTable(rows) {
  const index = rows.findIndex(row => tableHeader(row))
  if (index < 0) return []
  const header = tableHeader(rows[index])
  if (header.fields) return rows.slice(index + 1).flatMap(row => fromListRow(header.fields, row))
  const firstDay = header.days.findIndex(Boolean)
  return rows.slice(index + 1).flatMap(row => {
    const slot = row.slice(0, firstDay).map(periodsFrom).find(Boolean) || ''
    return header.days.flatMap((day, column) => day ? fromGridCell(row[column], day, slot) : [])
  })
}

function groupTextRows(blocks) {
  const lines = blocks.map(({ text, box: [left, top, right, bottom] }) =>
    ({ text, left, x: (left + right) / 2, y: (top + bottom) / 2, height: bottom - top }))
    .sort((a, b) => a.y - b.y)
  const heights = lines.map(line => line.height).sort((a, b) => a - b)
  const tolerance = Math.max(3, heights[Math.floor(heights.length / 2)] * 0.55)
  const rows = []
  for (const line of lines) {
    const last = rows.at(-1)
    if (last && line.y - last[0].y <= tolerance) last.push(line)
    else rows.push([line])
  }
  return rows.map(row => row.sort((a, b) => a.x - b.x))
}

function columnOf(block, headers, coordinate) {
  return headers.reduce((nearest, header, index) =>
    Math.abs(header[coordinate] - block[coordinate]) < Math.abs(headers[nearest][coordinate] - block[coordinate])
      ? index : nearest, 0)
}

export function parseTimetableScreenshot(blocks) {
  if (!blocks.length) return { rows: [], text: '' }
  const groups = groupTextRows(blocks)
  const text = groups.map(row => row.map(item => item.text).join('  ')).join('\n')
  const headerIndex = groups.findIndex(row => tableHeader(row.map(item => item.text)))
  if (headerIndex < 0) return { rows: [], text }

  const header = groups[headerIndex]
  const following = groups.slice(headerIndex + 1)
  const { fields, days } = tableHeader(header.map(item => item.text))
  if (fields) {
    const columns = header.filter((_, index) => fields[index])
    const parsed = following.flatMap(line => {
      const cells = columns.map(() => '')
      for (const block of line) {
        const index = columnOf(block, columns, 'left')
        cells[index] = [cells[index], block.text].filter(Boolean).join(' ')
      }
      return fromListRow(columns.map(item => headerField(item.text)), cells)
    })
    return { rows: parsed, text }
  }

  const columns = header.filter((_, index) => days[index])
  const spacing = (columns.at(-1).x - columns[0].x) / (columns.length - 1)
  const left = columns[0].x - spacing / 2
  const anchors = following.flat().filter(block => block.x < left && periodsFrom(block.text))
  const typicalGap = anchors.length > 1 ? (anchors.at(-1).y - anchors[0].y) / (anchors.length - 1) : Infinity
  const cells = anchors.map(() => columns.map(() => []))
  for (const block of following.flat()) {
    if (!anchors.length || block.x < left || block.x > columns.at(-1).x + spacing / 2 ||
        block.y > anchors.at(-1).y + typicalGap / 2) continue
    const row = columnOf(block, anchors, 'y')
    cells[row][columnOf(block, columns, 'x')].push(block.text)
  }
  const rows = cells.flatMap((row, index) => row.flatMap((lines, column) =>
    fromGridCell(lines.join('\n'), weekdayFrom(columns[column].text, false), periodsFrom(anchors[index].text))))
  return { rows, text }
}

export function timetableRowError(row) {
  if (!clean(row.courseName)) return '请填写课程名称'
  if (row.date ? !dateFrom(row.date) : !Number.isInteger(row.weekday) || row.weekday < 1 || row.weekday > 7) {
    return '请选择星期或填写有效的日期'
  }
  if (!row.date && weekNumbers(row.weeks) === null) return '周次格式有误，例如 1-16、1-16单、1-8,10-16'
  if (row.periods && !periodsFrom(row.periods)) return '节次格式有误，例如 1-2'
  if (row.startTime || row.endTime) {
    const start = timeFrom(row.startTime)
    const end = timeFrom(row.endTime)
    if (!start || !end || start >= end) return '请填写有效的起止时间，结束时间应晚于开始时间'
  } else if (!row.periods) return '请填写节次或起止时间'
  return ''
}

export function isMonday(value) {
  const date = dateFrom(value)
  return Boolean(date && new Date(date + 'T00:00:00').getDay() === 1)
}

export function finalizeTimetable(rows, termStart) {
  if (!rows.length || rows.length > maxTimetableRows || rows.some(row => timetableRowError(row))) return null
  if ((termStart || rows.some(row => !row.date && weekNumbers(row.weeks)?.length)) && !isMonday(termStart)) return null
  const distinct = new Map()
  for (const row of rows) {
    const date = dateFrom(row.date)
    const data = {
      courseName: clean(row.courseName).slice(0, 120), teacher: clean(row.teacher).slice(0, 80),
      classroom: clean(row.classroom).slice(0, 100), weekday: date ? 0 : row.weekday,
      date, weeks: date ? '' : clean(row.weeks), periods: periodsFrom(row.periods),
      startTime: timeFrom(row.startTime), endTime: timeFrom(row.endTime)
    }
    distinct.set(JSON.stringify(data), data)
  }
  return { termStart: dateFrom(termStart), rows: [...distinct.values()] }
}

export function timeLabel(row) {
  const periods = row.periods ? `第 ${row.periods} 节` : ''
  const hours = row.startTime && row.endTime ? `${row.startTime}–${row.endTime}` : ''
  return [periods, hours].filter(Boolean).join(' · ')
}

export function coursesOnDate(timetable, date) {
  const weekday = new Date(date + 'T00:00:00').getDay() || 7
  const week = timetable.termStart ? Math.floor(daysBetween(timetable.termStart, date) / 7) + 1 : null
  return timetable.rows.map((row, index) => ({ ...row, id: `timetable-${index}` }))
    .filter(row => {
      if (row.date) return row.date === date
      if (row.weekday !== weekday || (week !== null && week < 1)) return false
      const weeks = weekNumbers(row.weeks)
      return weeks && (!weeks.length || weeks.includes(week))
    })
    .sort((a, b) => (Number(a.periods.split('-')[0]) || 0) - (Number(b.periods.split('-')[0]) || 0) ||
      a.startTime.localeCompare(b.startTime))
}
