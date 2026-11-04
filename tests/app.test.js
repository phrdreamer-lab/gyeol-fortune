import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve, extname } from 'node:path'
import { chromium } from 'playwright-core'
import saju from 'saju-fortune'
import naming from 'naming-house'

test('실제 사주 패키지는 시간을 모를 때 시주를 생략한다', () => {
  const result = saju.analyzeSaju({ birthDate: '1990-03-15', gender: 'male' }, { analysisType: 'fortune', fortuneType: 'love' })
  assert.equal(result.pillars.hour, null)
  assert.equal(result.fortune.label, '연애운')
  assert.equal(Object.values(result.fiveElements).reduce((a, b) => a + b), 6)
})

test('실제 작명 패키지가 입력한 후보를 채점한다', async () => {
  const result = await naming.recommendNames({ surname: '김', birthDate: '2024-05-18', gender: 'female', candidates: [{ givenName: '서아' }, { givenName: '하린' }] })
  assert.equal(result.recommendations.length, 2)
  assert.deepEqual(new Set(result.recommendations.map((item) => item.givenName)), new Set(['서아', '하린']))
  assert.equal(result.recommendations[0].strokeProfile.source, 'korean-stroke-hangul')
})

test('배포 빌드에서 운세와 작명 폼이 작동한다', async () => {
  const root = resolve('docs')
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }
  const server = createServer(async (request, response) => {
    try {
      const path = resolve(root, `.${decodeURIComponent(new URL(request.url, 'http://localhost').pathname === '/' ? '/index.html' : new URL(request.url, 'http://localhost').pathname)}`)
      if (!path.startsWith(root)) throw new Error('invalid path')
      const content = await readFile(path)
      response.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream' })
      response.end(content)
    } catch { response.writeHead(404).end() }
  })
  await new Promise((done) => server.listen(0, '127.0.0.1', done))
  let browser
  try {
    browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true })
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto(`http://127.0.0.1:${server.address().port}/`)
    await page.locator('[name=birthDate]').fill('1990-03-15')
    await page.locator('[name=gender]').selectOption('male')
    await page.locator('[name=topic]').selectOption('love')
    await page.locator('[type=submit]').click()
    await page.locator('#result-title').waitFor({ state: 'visible' })
    assert.match(await page.locator('#result-content').innerText(), /연애운/)
    assert.match(await page.locator('#result-content').innerText(), /시간 미상/)
    await page.locator('[data-mode=naming]').click()
    await page.locator('[name=surname]').fill('김')
    await page.locator('[name=candidates]').fill('서아, 하린')
    await page.locator('[type=submit]').click()
    await page.locator('#result-title').waitFor({ state: 'visible' })
    assert.match(await page.locator('#result-content').innerText(), /김서아/)
    assert.match(await page.locator('#result-content').innerText(), /김하린/)
    const overflowing = await page.evaluate(() => Array.from(document.querySelectorAll('*')).filter((el) => el.getBoundingClientRect().right > innerWidth + 1).map((el) => `${el.tagName}.${el.className}(${el.parentElement?.className}) ${Math.round(el.getBoundingClientRect().right)} ${el.textContent.trim().slice(0, 25)}`))
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, overflowing.join(', '))
    assert.deepEqual(errors, [])
  } finally {
    await browser?.close()
    await new Promise((done) => server.close(done))
  }
})
