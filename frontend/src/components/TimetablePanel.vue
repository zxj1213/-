<template>
  <section class="card timetable">
    <div class="timetable-heading">
      <div>
        <h3>我的课表</h3>
        <p v-if="store.timetable">共 {{ store.timetable.rows.length }} 条安排 · 今天 {{ store.scheduledCourses(today).length }} 条</p>
        <p v-else>导入 Excel、CSV 或课表截图，核对后保存到本机。</p>
      </div>
      <div class="timetable-actions">
        <el-button v-if="store.timetable" round @click="openEditor(true)">编辑课表</el-button>
        <el-button type="primary" round @click="openEditor(false)">导入课表</el-button>
      </div>
    </div>
    <ul v-if="store.timetable" class="schedule">
      <li v-for="(row, index) in store.timetable.rows" :key="index">
        <strong>{{ row.courseName }}</strong>
        <span>{{ row.date || weekdays[row.weekday - 1] }} · {{ timeLabel(row) }}</span>
        <span>{{ [row.classroom, row.teacher, row.weeks ? '周次 ' + row.weeks : ''].filter(Boolean).join(' · ') }}</span>
      </li>
    </ul>
  </section>

  <el-dialog v-model="open" :title="editing ? '编辑课表' : '导入课表'" width="min(94vw, 960px)"
    class="timetable-dialog" align-center @close="stopReading">
    <div v-if="!editing" class="timetable-actions">
      <el-button :disabled="busy" @click="workbookInput?.click()">选择课表文件</el-button>
      <el-button :disabled="busy" @click="imageInput?.click()">识别课表截图</el-button>
      <input ref="workbookInput" type="file" accept=".xlsx,.csv,.tsv" hidden @change="readFile($event, 'table')" />
      <input ref="imageInput" type="file" accept="image/png,image/jpeg,image/webp" hidden @change="readFile($event, 'ocr')" />
    </div>
    <p v-if="!editing" class="import-hint">
      支持 XLSX、CSV、TSV 及 PNG、JPEG、WebP，单个文件最大 5 MiB。
      列表课表应有「课程名称」和「星期」或「日期」，周课表应包含星期表头和节次。
      旧版 XLS 可先另存为 XLSX。Excel 和截图由本机服务处理，请先登录学迹账号。
    </p>
    <p v-if="busy" class="import-hint" role="status">正在读取课表…</p>
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
    <p v-if="source" class="import-hint">{{ source }} · {{ rows.length }} 条待核对</p>
    <el-select v-if="sheets.length > 1" v-model="selectedSheet" aria-label="选择工作表" @change="loadSheet">
      <el-option v-for="(sheet, index) in sheets" :key="index" :label="sheet.name || '工作表 ' + (index + 1)" :value="index" />
    </el-select>
    <details v-if="sourceText" class="raw-text">
      <summary>查看原文</summary>
      <pre>{{ sourceText }}</pre>
    </details>
    <p v-if="source && !rows.length" class="import-hint">未能自动分出课程。可以参照原文添加课程，或换一份表格、截图。</p>

    <div v-if="rows.length" class="term-field">
      <label>教学第 1 周的周一 <input v-model="termStart" type="date" /></label>
      <span v-if="requiresTerm">课表含周次，请按学校校历填写。</span>
      <span v-else>没有指定周次时可留空。</span>
      <p v-if="termInvalid" class="field-error">请选择教学第 1 周的周一。</p>
    </div>

    <div class="draft-list">
      <article v-for="(row, index) in rows" :key="row.key" class="draft-row">
        <div class="draft-heading">
          <strong>课程 {{ index + 1 }}</strong>
          <el-button link type="danger" :disabled="busy" @click="rows.splice(index, 1)">移除</el-button>
        </div>
        <div class="draft-fields">
          <label>课程名称<input v-model="row.courseName" maxlength="120" /></label>
          <label>星期<select v-model.number="row.weekday" :disabled="Boolean(row.date)">
            <option :value="0">请选择</option>
            <option v-for="(day, dayIndex) in weekdays" :key="day" :value="dayIndex + 1">{{ day }}</option>
          </select></label>
          <label>日期（单次课）<input v-model="row.date" placeholder="YYYY-MM-DD" /></label>
          <label>周次<input v-model="row.weeks" :disabled="Boolean(row.date)" maxlength="100" placeholder="例如 1-16单" /></label>
          <label>节次<input v-model="row.periods" placeholder="例如 1-2" /></label>
          <label>开始时间<input v-model="row.startTime" placeholder="08:00" /></label>
          <label>结束时间<input v-model="row.endTime" placeholder="09:40" /></label>
          <label>教室<input v-model="row.classroom" maxlength="100" /></label>
          <label>教师<input v-model="row.teacher" maxlength="80" /></label>
        </div>
        <details v-if="row.sourceText" class="raw-text">
          <summary>查看本条原文</summary>
          <pre>{{ row.sourceText }}</pre>
        </details>
        <p v-if="rowErrors[index]" class="field-error">{{ rowErrors[index] }}</p>
      </article>
    </div>
    <el-button :disabled="busy || rows.length >= maxTimetableRows" @click="addRow">添加一行</el-button>
    <p v-if="store.timetable && !editing" class="import-hint">确认保存后会替换当前导入的课表。</p>

    <template #footer>
      <el-button @click="open = false">取消</el-button>
      <el-button type="primary" :disabled="!canSave" @click="save">确认保存课表</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, onUnmounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useAppStore } from '../store'
import { todayStr } from '../constants'
import { readTimetableUpload } from '../services/api'
import {
  createTimetableRow, isMonday, maxTimetableRows, parseCsv, parseTimetableScreenshot,
  parseTimetableTable, timetableRowError, timeLabel, weekdays, weekNumbers
} from '../services/timetable'

const store = useAppStore()
const today = todayStr()
const open = ref(false)
const editing = ref(false)
const busy = ref(false)
const error = ref('')
const rows = ref([])
const termStart = ref('')
const source = ref('')
const sourceText = ref('')
const sheets = ref([])
const selectedSheet = ref(0)
const workbookInput = ref(null)
const imageInput = ref(null)
const requiresTerm = computed(() => rows.value.some(row => !row.date && weekNumbers(row.weeks)?.length))
const termInvalid = computed(() => (termStart.value || requiresTerm.value) && !isMonday(termStart.value))
const rowErrors = computed(() => rows.value.map(timetableRowError))
const canSave = computed(() => !busy.value && rows.value.length > 0 && !termInvalid.value && !rowErrors.value.some(Boolean))

let request
let nextKey = 0

function stopReading() {
  request?.abort()
  request = undefined
  busy.value = false
}
onUnmounted(stopReading)

function openEditor(edit) {
  editing.value = edit
  rows.value = edit ? store.timetable.rows.map(row => ({ ...row, key: ++nextKey })) : []
  termStart.value = edit ? store.timetable.termStart : ''
  source.value = ''
  sourceText.value = ''
  sheets.value = []
  error.value = ''
  open.value = true
}

function addRow() {
  rows.value.push(createTimetableRow({ key: ++nextKey }))
}

function setDrafts(drafts) {
  if (drafts.length > maxTimetableRows) {
    rows.value = []
    error.value = `识别出超过 ${maxTimetableRows} 条安排，请拆分课表后再导入。`
    return
  }
  rows.value = drafts.map(row => ({ ...row, key: ++nextKey }))
}

function loadSheet() {
  const sheet = sheets.value[selectedSheet.value]
  error.value = ''
  loadTable(sheet.rows, sheet.name || 'Excel 课表')
}

function loadTable(table, name) {
  const drafts = parseTimetableTable(table)
  source.value = name
  sourceText.value = drafts.length ? '' : table.slice(0, 20).map(row => row.join('  ')).join('\n').slice(0, 4000)
  setDrafts(drafts)
}

async function readFile(event, kind) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file || busy.value) return
  error.value = ''
  if (file.size > 5 * 1024 * 1024) {
    error.value = '文件超过 5 MiB，请缩小或拆分后重试。'
    return
  }
  const controller = new AbortController()
  request = controller
  busy.value = true
  try {
    if (kind === 'ocr') {
      const { blocks } = await readTimetableUpload(file, 'ocr', controller.signal)
      if (request !== controller) return
      if (!Array.isArray(blocks)) throw new Error('截图识别结果无法读取。')
      const parsed = parseTimetableScreenshot(blocks)
      sheets.value = []
      source.value = file.name
      sourceText.value = parsed.text
      setDrafts(parsed.rows)
    } else if (/\.xlsx$/i.test(file.name)) {
      const { sheets: parsed } = await readTimetableUpload(file, 'workbook', controller.signal)
      if (request !== controller) return
      if (!Array.isArray(parsed) || !parsed.length) throw new Error('Excel 课表没有可读取的工作表。')
      sheets.value = parsed
      selectedSheet.value = Math.max(0, parsed.findIndex(sheet => parseTimetableTable(sheet.rows).length))
      loadSheet()
    } else if (/\.(csv|tsv)$/i.test(file.name)) {
      const bytes = await file.arrayBuffer()
      if (request !== controller) return
      let text
      try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
      } catch {
        text = new TextDecoder('gb18030').decode(bytes)
      }
      sheets.value = []
      loadTable(parseCsv(text), file.name)
    } else {
      throw new Error('请选择 XLSX、CSV 或 TSV。旧版 XLS 可先在表格软件中另存为 XLSX。')
    }
  } catch (e) {
    if (request === controller) error.value = e.message || '无法读取课表文件。'
  } finally {
    if (request === controller) {
      busy.value = false
      request = undefined
    }
  }
}

function save() {
  if (!canSave.value || !store.saveTimetable(rows.value, termStart.value)) return
  open.value = false
  ElMessage.success(`已保存 ${store.timetable.rows.length} 条课程安排`)
}
</script>

<style scoped>
.timetable h3, .timetable p { margin: 0; }
.timetable-heading, .draft-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px 16px;
}
.timetable-heading p, .import-hint, .term-field span { color: var(--text-secondary); }
.timetable-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.timetable-actions :deep(.el-button) { margin: 0; }
.schedule { list-style: none; padding: 0; margin: 14px 0 0; }
.schedule li {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr) minmax(0, 1fr);
  gap: 4px 14px;
  border-top: 1px solid var(--divider);
  padding: 8px 0;
  overflow-wrap: anywhere;
}
.import-hint, .term-field { margin: 10px 0; }
.term-field label { display: inline-flex; align-items: center; flex-wrap: wrap; gap: 6px 10px; margin-right: 12px; }
.draft-list {
  display: grid;
  gap: 8px;
  max-height: min(47vh, 470px);
  overflow: auto;
  margin: 8px 0;
}
.draft-row { border: 1px solid var(--divider); border-radius: 10px; padding: 10px; }
.draft-fields { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px 10px; }
.draft-fields label { display: grid; gap: 2px; min-width: 0; }
.draft-fields input, .draft-fields select, .term-field input {
  min-width: 0;
  min-height: 32px;
  padding: 4px 7px;
  border: 1px solid var(--divider);
  border-radius: 5px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font: inherit;
}
.field-error { color: var(--error); margin: 4px 0; }
.raw-text { margin: 5px 0; color: var(--text-secondary); }
.raw-text pre { white-space: pre-wrap; overflow-wrap: anywhere; max-height: 130px; overflow: auto; margin: 4px 0; }
:global(.el-dialog.timetable-dialog) { max-width: min(94vw, 960px); max-height: 94dvh; overflow: auto; }
@media (max-width: 600px) {
  .schedule li { grid-template-columns: 1fr; }
  .draft-fields { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
