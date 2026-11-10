const databaseName = 'studyflow-knowledge-library'
const storeName = 'documents'

function openLibrary() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1)
    request.onupgradeneeded = () => {
      const documents = request.result.createObjectStore(storeName, { keyPath: ['owner', 'id'] })
      documents.createIndex('owner', 'owner')
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function transact(mode, useStore) {
  const database = await openLibrary()
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, mode)
      transaction.onabort = () => reject(transaction.error || new Error('资料存储操作已取消'))
      const request = useStore(transaction.objectStore(storeName))
      transaction.oncomplete = () => resolve(request?.result)
    })
  } finally {
    database.close()
  }
}

export function loadMaterials(owner) {
  return transact('readonly', documents => documents.index('owner').getAll(owner))
}

export function saveMaterials(owner, materials) {
  return transact('readwrite', documents => {
    for (const material of materials) documents.put({ ...material, owner })
  })
}

export function deleteAccountMaterials(owner) {
  if (!owner || typeof indexedDB === 'undefined') return Promise.resolve()
  return transact('readwrite', documents => {
    const cursor = documents.index('owner').openCursor(owner)
    cursor.onsuccess = () => {
      const entry = cursor.result
      if (!entry) return
      entry.delete()
      entry.continue()
    }
  })
}

/** 删除单份资料（含正文索引与原始文件） */
export function deleteMaterial(owner, id) {
  if (!owner || !id || typeof indexedDB === 'undefined') return Promise.resolve()
  return transact('readwrite', documents => documents.delete([owner, id]))
}

export function sourceLabel(chunk) {
  const unit = { page: '页', slide: '张幻灯片', paragraph: '段' }[chunk.kind]
  return '第 ' + chunk.position + ' ' + unit
}

export function searchMaterials(documents, query) {
  const keyword = query.trim().toLowerCase()
  if (!keyword) return documents.map(doc => ({ doc, hits: [] }))

  return documents.flatMap(doc => {
    const fields = [
      ['标题', doc.title], ['课程', doc.courseName], ['类型', doc.type],
      ['标签', doc.tags?.join(' ')], ['摘要', doc.summary]
    ]
    const matched = fields.find(([, value]) => value?.toLowerCase().includes(keyword))
    const hits = []
    for (const [index, chunk] of (doc.file ? doc.chunks : []).entries()) {
      const offset = chunk.text.toLowerCase().indexOf(keyword)
      if (offset < 0) continue
      const start = Math.max(0, offset - 30)
      const end = Math.min(chunk.text.length, offset + keyword.length + 65)
      hits.push({
        index,
        label: sourceLabel(chunk),
        excerpt: (start ? '…' : '') + chunk.text.slice(start, end) + (end < chunk.text.length ? '…' : '')
      })
      if (hits.length === 3) break
    }
    if (!matched && !hits.length) return []
    return [{ doc, hits, field: matched?.[0] || '正文', rank: matched?.[0] === '标题' ? 0 : hits.length ? 1 : 2 }]
  }).sort((a, b) => a.rank - b.rank)
}
