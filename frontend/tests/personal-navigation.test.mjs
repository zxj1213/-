import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import { createRouter, createMemoryHistory } from 'vue-router'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const constants = await import('data:text/javascript;base64,' + Buffer.from(read('../src/constants/index.js')).toString('base64'))
const routerSource = read('../src/router/index.js')
  .replace(/^import .+from .+$/gm, '')
  .replace(/\(\) => import\('[^']+'\)/g, 'Page')
  .replace('export default router', 'this.router = router')

function setup() {
  const ctx = { ...constants, createRouter, createWebHashHistory: createMemoryHistory,
    Page: { render: () => null }, window: { scrollTo() {} } }
  vm.runInNewContext(routerSource, ctx)
  return ctx.router
}

test('entering My opens profile and every menu leads to its own page', async () => {
  const router = setup()
  await router.push('/me')
  assert.equal(router.currentRoute.value.path, '/me/profile')
  for (const item of constants.PersonalSections) {
    await router.push(`/me/${item.id}`)
    const route = router.currentRoute.value
    assert.equal(route.path, `/me/${item.id}`)
    assert.equal(route.params.section, item.id)
    assert.equal(route.name, 'me-section')
    assert.equal(route.matched[0].props.default, true)
    assert.equal(route.meta.title, '个人中心')
  }
})

test('direct links and invalid My links resolve predictably', async () => {
  const router = setup()
  await router.push('/me/settings')
  assert.equal(router.currentRoute.value.params.section, 'settings')
  await router.push('/me/unknown')
  assert.equal(router.currentRoute.value.path, '/me/profile')
})

test('browser back returns to the previously selected card', async () => {
  const router = setup()
  await router.push('/me/profile')
  await router.push('/me/account')
  const navigated = new Promise(resolve => {
    const remove = router.afterEach(() => { remove(); resolve() })
  })
  router.back()
  await navigated
  assert.equal(router.currentRoute.value.path, '/me/profile')
})
