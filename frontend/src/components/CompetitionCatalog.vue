<template>
  <section class="card catalog" aria-labelledby="competition-catalog-title">
    <header class="catalog-header">
      <h2 id="competition-catalog-title">本科生学科竞赛认定库</h2>
      <p>武汉理工大学 2024 版认定目录，共 {{ catalog.length }} 项。赛程为往届或已公布安排，参赛前请核对当届通知。</p>
    </header>

    <div class="catalog-filters">
      <el-input v-model="query" clearable placeholder="搜索竞赛名称或目录编号" aria-label="搜索竞赛名称或目录编号" />
      <el-select v-model="level" placeholder="全部等级" aria-label="筛选认定等级">
        <el-option label="全部等级" value="" />
        <el-option v-for="item in levels" :key="item" :label="item" :value="item" />
      </el-select>
    </div>
    <p class="result-count" aria-live="polite">找到 {{ filtered.length }} 项竞赛</p>

    <ul v-if="filtered.length" class="catalog-list">
      <li v-for="entry in visibleEntries" :key="entry.id" class="catalog-entry">
        <div class="entry-heading">
          <span class="entry-number">#{{ entry.id }}</span>
          <el-tag size="small" effect="plain">{{ entry.level }}</el-tag>
          <h3>{{ entry.name }}</h3>
        </div>
        <p class="entry-schedule"><b>赛程参考</b> {{ entry.schedule }}</p>
        <div class="entry-links">
          <span v-if="!entry.hasWebsite" class="website-pending">独立官网待核实</span>
          <el-link v-for="link in entry.links" :key="link.url" :href="link.url"
            type="primary" target="_blank" rel="noopener noreferrer">{{ link.label }} ↗</el-link>
        </div>
      </li>
    </ul>
    <el-empty v-else description="没有符合筛选条件的竞赛" :image-size="70" />

    <el-pagination v-if="filtered.length > pageSize" v-model:current-page="page"
      :page-size="pageSize" :total="filtered.length" :pager-count="5"
      small background layout="prev, pager, next" />
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import catalog from '../data/whut-competition-catalog-2024.json'

const query = ref('')
const level = ref('')
const page = ref(1)
const pageSize = 12
const levels = [...new Set(catalog.map(entry => entry.level))]
const normalize = value => value.trim().toLowerCase().replace(/\s+/g, '')

const filtered = computed(() => {
  const term = normalize(query.value)
  return catalog.filter(entry =>
    (!level.value || entry.level === level.value) &&
    (!term || normalize(entry.name).includes(term) || String(entry.id) === term.replace(/^#/, ''))
  )
})
const visibleEntries = computed(() => filtered.value.slice((page.value - 1) * pageSize, page.value * pageSize))
watch([query, level], () => { page.value = 1 })
</script>

<style scoped>
.catalog-header h2 {
  margin: 0 0 6px;
  color: var(--text-primary);
  font-size: calc(1.125rem * var(--font-scale));
}
.catalog-header p, .result-count {
  margin: 0;
  color: var(--text-secondary);
  font-size: calc(0.8125rem * var(--font-scale));
}
.catalog-filters {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 130px;
  gap: 12px;
  margin: 18px 0 10px;
}
.catalog-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  padding: 0;
  margin: 12px 0 18px;
  list-style: none;
}
.catalog-entry {
  padding: 14px;
  border: 1px solid var(--divider);
  border-radius: 12px;
  background: var(--bg-primary);
}
.entry-heading, .entry-links {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 8px;
}
.entry-heading h3 {
  flex: 1;
  min-width: 150px;
  margin: 0;
  color: var(--text-primary);
  font-size: calc(0.9375rem * var(--font-scale));
  overflow-wrap: anywhere;
}
.entry-number {
  color: var(--text-secondary);
  font-size: calc(0.75rem * var(--font-scale));
  font-variant-numeric: tabular-nums;
}
.entry-schedule {
  margin: 8px 0;
  color: var(--text-secondary);
  font-size: calc(0.8125rem * var(--font-scale));
  overflow-wrap: anywhere;
}
.entry-schedule b {
  margin-inline-end: 6px;
  color: var(--text-primary);
}
.website-pending {
  color: var(--text-secondary);
  font-size: calc(0.75rem * var(--font-scale));
}
@media (max-width: 900px) {
  .catalog-list { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 480px) {
  .catalog-filters { grid-template-columns: minmax(0, 1fr); }
}
</style>
