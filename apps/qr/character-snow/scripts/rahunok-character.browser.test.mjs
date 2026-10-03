import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const url = process.env.RAHUNOK_PREVIEW_URL ?? 'http://127.0.0.1:4184/qr/'
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })
  page.setDefaultTimeout(30000)
  const errors = []
  const portraits = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('request', request => {
    if (/\.jpg(?:\?|$)/i.test(request.url())) portraits.push(request.url())
  })
  await page.goto(url)
  await page.waitForFunction(() => document.querySelector('.ra-stage')?.dataset.scene === 'snow')
  await page.screenshot({ path: 'test-results/rahunok-3d-desktop.png' })
  const snapshots = await page.evaluate(async () => {
    const { mountRahunokAssistant } = await import('/qr/src/rahunok-assistant.ts')
    const THREE = await import('/qr/node_modules/.vite/deps/three.js')
    const host = document.querySelector('#rahunok-assistant')
    const originalAdd = THREE.Object3D.prototype.add
    let scene
    THREE.Object3D.prototype.add = function (...objects) {
      if (this.isScene && objects.some(object => object.name === 'hero')) scene = this
      return originalAdd.apply(this, objects)
    }
    const controller = mountRahunokAssistant(host, { qrValue: location.href, preview: true })
    controller.setState('idle')
    await controller.visualReady
    THREE.Object3D.prototype.add = originalAdd
    if (!scene) throw new Error('Scene was not captured')
    const nextFrame = () => new Promise(resolve => {
      let remaining = 5
      const next = () => { if (--remaining) requestAnimationFrame(next); else resolve() }
      requestAnimationFrame(next)
    })
    await nextFrame()
    const snow = scene.getObjectByName('snow')
    const morphs = []
    snow.traverse(object => { if (object.morphTargetInfluences) morphs.push(object) })
    const weight = name => morphs[0].morphTargetInfluences[morphs[0].morphTargetDictionary[name]]
    const state = () => ({
      greet: weight('greet'),
      success: weight('success'),
      create: weight('create'),
      invoice: scene.getObjectByName('invoice').scale.x,
      demo: host.querySelector('.ra-demo').checked,
    })
    const idle = state()
    controller.setState('success')
    await nextFrame()
    const success = state()
    controller.setState('create')
    await nextFrame()
    const create = state()
    let meshes = 0
    let textured = 0
    snow.traverse(object => {
      if (object.isMesh) {
        meshes++
        if (object.material.map) textured++
      }
    })
    window.characterTest = { controller, scene, nextFrame, weight, morphs }
    return { idle, success, create, meshes, textured }
  })
  assert.ok(snapshots.meshes >= 15)
  assert.ok(snapshots.textured > 0)
  assert.equal(snapshots.idle.demo, false)
  assert.equal(snapshots.idle.greet, 0.5)
  assert.equal(snapshots.success.success, 1)
  assert.ok(snapshots.create.invoice > 0.99)
  assert.equal(snapshots.create.create, 1)
  const settle = () => page.evaluate(() => window.characterTest.nextFrame())
  const stage = page.locator('.ra-stage')
  const capture = async name => {
    const clip = await stage.boundingBox()
    return page.screenshot({ clip, path: `test-results/rahunok-3d-${name}.png` })
  }
  const invoiceFrame = await capture('invoice')
  await page.locator('.ra-preview select').selectOption('success')
  await settle()
  const waveFrame = await capture('wave')
  assert.notDeepEqual(invoiceFrame, waveFrame)
  await page.locator('.ra-preview select').selectOption('listen')
  await settle()
  const normal = await capture('normal')
  await page.locator('.ra-zoom').fill('100')
  await settle()
  assert.notDeepEqual(normal, await capture('closeup'))
  await page.locator('.ra-angle').fill('75')
  await settle()
  const rotated = await capture('rotated')
  assert.notDeepEqual(normal, rotated)
  await settle()
  assert.deepEqual(rotated, await page.screenshot({ clip: await stage.boundingBox() }))
  await page.locator('.ra-zoom').fill('0')
  await page.locator('.ra-angle').fill('0')
  for (const state of ['idle', 'listen', 'think', 'speak', 'success', 'error', 'payment', 'scan', 'waiting', 'confirm', 'create']) {
    await page.locator('.ra-preview select').selectOption(state)
    await settle()
    assert.equal(await stage.getAttribute('data-morphing'), 'false')
    await capture(`state-${state}`)
  }
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await stage.scrollIntoViewIfNeeded()
  await page.evaluate(() => {
    window.characterTest.controller.setState('idle')
    const context = document.querySelector('.ra-canvas').getContext('webgl2')
    const originalDraw = context.drawElements.bind(context)
    context.drawElements = (...args) => {
      originalDraw(...args)
      const pixels = new Uint8Array(context.drawingBufferWidth * context.drawingBufferHeight * 4)
      context.readPixels(0, 0, context.drawingBufferWidth, context.drawingBufferHeight, context.RGBA, context.UNSIGNED_BYTE, pixels)
      window.characterPixels = { shades: new Set(pixels).size, nonzero: pixels.some(value => value > 0) }
    }
  })
  await page.waitForFunction(() => window.characterPixels?.shades > 8)
  const pixels = await page.evaluate(() => window.characterPixels)
  await page.evaluate(() => window.characterTest.controller.setState('success'))
  await page.waitForFunction(() => window.characterTest.weight('success') + window.characterTest.weight('successPulse') > 0.95)
  const gestures = await page.evaluate(async () => {
    const { controller, weight, nextFrame, morphs } = window.characterTest
    const measure = async (state, name) => {
      controller.setState(state)
      for (let frame = 0; frame < 15; frame++) await nextFrame()
      const values = []
      for (let frame = 0; frame < 20; frame++) { await nextFrame(); values.push(weight(name)) }
      return Math.max(...values) - Math.min(...values)
    }
    const wave = await measure('idle', 'wave')
    const lips = await measure('speak', 'speakOpen')
    const geometryChanges = {}
    for (const [first, second, label] of [['greet', 'wave', 'hand'], ['speak', 'speakOpen', 'mouth']]) {
      let maximum = 0
      for (const mesh of morphs) {
        const positions = mesh.geometry.morphAttributes.position
        const firstPositions = positions[mesh.morphTargetDictionary[first]].array
        const secondPositions = positions[mesh.morphTargetDictionary[second]].array
        for (let index = 0; index < firstPositions.length; index++) maximum = Math.max(maximum, Math.abs(firstPositions[index] - secondPositions[index]))
      }
      geometryChanges[label] = maximum
    }
    controller.setVoiceLevel(0)
    for (let frame = 0; frame < 10; frame++) await nextFrame()
    const silent = weight('speakOpen')
    controller.setVoiceLevel(1)
    for (let frame = 0; frame < 10; frame++) await nextFrame()
    return { wave, lips, geometryChanges, silent, speaking: weight('speakOpen') }
  })
  assert.ok(gestures.wave > 0.2)
  assert.ok(gestures.lips > 0.2)
  assert.ok(gestures.geometryChanges.hand > 0.01)
  assert.ok(gestures.geometryChanges.mouth > 0.001)
  assert.ok(gestures.silent < 0.01)
  assert.ok(gestures.speaking > 0.99)
  await page.evaluate(() => {
    window.characterTest.controller.setState('listen')
    window.characterTest.controller.setState('think')
    window.characterTest.controller.setState('create')
  })
  await page.waitForFunction(() => window.characterTest.weight('create') > 0.98)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await settle()
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 })
    await page.evaluate(() => {
      const assistant = document.querySelector('.hero-assistant')
      scrollTo({ top: assistant.getBoundingClientRect().top + scrollY - 20, behavior: 'instant' })
    })
    await settle()
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    await page.screenshot({ path: `test-results/rahunok-3d-mobile-${width}.png` })
  }
  await page.locator('.ra-canvas').evaluate(canvas => canvas.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext())
  await page.waitForSelector('.ra-canvas', { state: 'detached' })
  assert.equal(await page.locator('.ra-fallback').evaluate(element => getComputedStyle(element).visibility), 'visible')
  await page.evaluate(() => window.characterTest.controller.destroy())
  assert.equal(await page.locator('#rahunok-assistant > *').count(), 0)
  assert.deepEqual(portraits, [])
  assert.deepEqual(errors, [])
  console.log(JSON.stringify({ snapshots, pixels, gestures, checks: 'Snow poses, hand wave, lip motion, voice input, invoice, zoom, orbit, reduced motion, live transitions, rapid changes, mobile 390/320, context loss, destroy, no JPG requests' }, null, 2))
} finally {
  await browser.close()
}