import QRCode from 'qrcode'

type Bank = { id: string; name: string; color: string; logo: string | null }
const endpoint = 'https://bank-api.dmitrishen.workers.dev/v1/banks'
const fallback: Bank = { id: 'privat', name: 'ПриватБанк', color: '#287c38', logo: '/banks/privatbank.png' }
const safeColor = (value: unknown) => typeof value === 'string' && /^#[\da-f]{6}$/i.test(value) ? value : '#266d59'
const safeLogo = (value: unknown) => {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null
  } catch { return null }
}

export function mountBankDemo() {
  const section = document.querySelector<HTMLElement>('#banks')!
  const canvas = section.querySelector<HTMLCanvasElement>('#bank-canvas')!
  const sceneLogo = section.querySelector<HTMLImageElement>('#bank-scene-logo')!
  const name = section.querySelector<HTMLElement>('#bank-demo-name')!
  const status = section.querySelector<HTMLElement>('#bank-demo-state')!
  const play = section.querySelector<HTMLButtonElement>('#bank-play')!
  const list = section.querySelector<HTMLElement>('#bank-list')!
  const message = section.querySelector<HTMLElement>('#bank-list-message')!
  const search = section.querySelector<HTMLInputElement>('#bank-search')!
  const countLabel = section.querySelector<HTMLElement>('#bank-count')!
  const previous = section.querySelector<HTMLButtonElement>('#bank-prev')!
  const next = section.querySelector<HTMLButtonElement>('#bank-next')!
  const motion = matchMedia('(prefers-reduced-motion: reduce)')
  const steps = ['QR → реквізити → підтвердження', 'Демо: реквізити зчитано', 'Демо: перевірте отримувача, IBAN і суму', 'Демо завершено. Платіж не здійснювався.']
  let banks: Bank[] = [fallback]
  let selected = 0
  let step = 0
  let updateScene = () => {}
  let disposeScene = () => {}
  const reset = () => {
    step = 0
    status.textContent = steps[step]!
    play.textContent = 'Переглянути демо →'
  }
  const renderList = () => {
    const query = search.value.trim().toLocaleLowerCase('uk')
    const position = list.scrollLeft
    list.replaceChildren()
    const matches = banks.filter(bank => bank.name.toLocaleLowerCase('uk').includes(query))
    matches.forEach(bank => {
      const button = document.createElement('button')
      button.type = 'button'
      button.setAttribute('aria-label', bank.name)
      button.setAttribute('aria-pressed', String(bank.id === banks[selected]?.id))
      button.style.setProperty('--tile-accent', bank.color)
      const mark = document.createElement('span')
      mark.className = 'bank-mark'
      mark.textContent = bank.name.slice(0, 2).toLocaleUpperCase('uk')
      if (bank.logo) {
        const image = document.createElement('img')
        image.src = bank.logo
        image.alt = ''
        image.loading = 'lazy'
        image.onerror = () => image.remove()
        mark.append(image)
      }
      button.append(mark)
      button.addEventListener('click', () => {
        selected = banks.indexOf(bank)
        list.querySelectorAll('button').forEach(item => item.setAttribute('aria-pressed', String(item === button)))
        name.textContent = `${bank.name} / ДЕМО`
        if (bank.logo) { sceneLogo.src = bank.logo; sceneLogo.hidden = false }
        else sceneLogo.hidden = true
        sceneLogo.alt = `Логотип ${bank.name}`
        section.style.setProperty('--bank-accent', bank.color)
        reset()
        updateScene()
      })
      list.append(button)
    })
    list.scrollLeft = position
    message.textContent = matches.length ? '' : 'За цим запитом банків не знайдено.'
  }
  search.addEventListener('input', () => { list.scrollLeft = 0; renderList() })
  previous.addEventListener('click', () => list.scrollBy({ left: -list.clientWidth * .8, behavior: 'smooth' }))
  next.addEventListener('click', () => list.scrollBy({ left: list.clientWidth * .8, behavior: 'smooth' }))
  void (async () => {
    try {
      const response = await fetch(endpoint, { signal: AbortSignal.timeout(8000) })
      if (!response.ok) throw new Error('Catalog unavailable')
      const rows: unknown = await response.json()
      if (!Array.isArray(rows)) throw new Error('Invalid catalog')
      const entries = rows.filter((row): row is { id: string; name: string; color?: unknown } =>
        row && row.active === true && typeof row.id === 'string' && typeof row.name === 'string' && !!row.id.trim() && !!row.name.trim())
      if (!entries.length) throw new Error('Empty catalog')
      banks = entries.map(row => ({ id: row.id, name: row.name, color: safeColor(row.color), logo: null }))
      const first = banks.findIndex(bank => bank.id === fallback.id)
      selected = first < 0 ? 0 : first
      name.textContent = `${banks[selected]!.name} / ДЕМО`
      countLabel.textContent = `${banks.length} БАНКІВ / ОБЕРІТЬ СВІЙ`
      renderList()
      let cursor = 0
      await Promise.all(Array.from({ length: 6 }, async () => {
        while (cursor < banks.length) {
          const bank = banks[cursor++]!
          try {
            const detail = await fetch(`${endpoint}/${encodeURIComponent(bank.id)}`, { signal: AbortSignal.timeout(4000) })
            if (detail.ok) {
              const data = await detail.json()
              bank.logo = safeLogo(data.logo)
              bank.color = safeColor(data.color)
              if (bank.id === banks[selected]?.id) {
                section.style.setProperty('--bank-accent', bank.color)
                updateScene()
              }
            }
          } catch { /* Keep the bank visible without an image. */ }
          const tile = Array.from(list.querySelectorAll<HTMLButtonElement>('button')).find(button => button.getAttribute('aria-label') === bank.name)
          if (tile) {
            tile.style.setProperty('--tile-accent', bank.color)
            if (bank.logo && !tile.querySelector('img')) {
              const image = document.createElement('img')
              image.src = bank.logo
              image.alt = ''
              image.loading = 'lazy'
              image.onerror = () => image.remove()
              tile.querySelector('.bank-mark')?.append(image)
            }
          }
          if (bank.id === banks[selected]?.id && bank.logo) { sceneLogo.src = bank.logo; sceneLogo.hidden = false }
        }
      }))
    } catch {
      countLabel.textContent = 'БАНКИ / КАТАЛОГ НЕДОСТУПНИЙ'
      renderList()
      message.textContent = 'Каталог тимчасово недоступний. Показано демонстраційний банк.'
    }
  })()
  play.addEventListener('click', () => {
    step = (step + 1) % steps.length
    status.textContent = steps[step]!
    play.textContent = step === 3 ? 'Повторити демо ↻' : step === 0 ? 'Переглянути демо →' : 'Далі →'
    updateScene()
  })

  let initialized = false
  let visible = false
  const observer = new IntersectionObserver(async entries => {
    visible = entries[0]?.isIntersecting ?? false
    if (initialized) { updateScene(); return }
    if (!visible) return
    initialized = true
    try {
      const THREE = await import('three')
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true })
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5))
      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100)
      camera.position.set(0, 0, 11)
      scene.add(new THREE.HemisphereLight(0xffffff, 0x8190a0, 3))
      const light = new THREE.DirectionalLight(0xffffff, 4)
      light.position.set(-3, 4, 6)
      scene.add(light)
      const group = new THREE.Group()
      scene.add(group)
      const modules = QRCode.create('https://example.invalid/bank-demo', { errorCorrectionLevel: 'H' }).modules
      const geometry = new THREE.BoxGeometry(0.105, 0.105, 0.28)
      const material = new THREE.MeshStandardMaterial({ color: banks[selected]!.color, roughness: 0.3, metalness: 0.22 })
      const count = modules.data.reduce((total, value) => total + (value ? 1 : 0), 0)
      const mesh = new THREE.InstancedMesh(geometry, material, count)
      const matrix = new THREE.Matrix4()
      let index = 0
      for (let row = 0; row < modules.size; row++) {
        for (let column = 0; column < modules.size; column++) {
          if (!modules.data[row * modules.size + column]) continue
          matrix.makeTranslation((column - (modules.size - 1) / 2) * 0.12, ((modules.size - 1) / 2 - row) * 0.12, 0)
          mesh.setMatrixAt(index++, matrix)
        }
      }
      group.add(mesh)
      const signCanvas = document.createElement('canvas')
      signCanvas.width = 256
      signCanvas.height = 256
      const signContext = signCanvas.getContext('2d')!
      signContext.fillStyle = '#f7f5ed'
      signContext.beginPath()
      signContext.arc(128, 128, 112, 0, Math.PI * 2)
      signContext.fill()
      signContext.fillStyle = '#202726'
      signContext.font = 'bold 176px Georgia'
      signContext.textAlign = 'center'
      signContext.textBaseline = 'middle'
      signContext.fillText('₴', 128, 137)
      const signTexture = new THREE.CanvasTexture(signCanvas)
      const signMaterial = new THREE.MeshBasicMaterial({ map: signTexture, transparent: true, side: THREE.DoubleSide })
      const signGeometry = new THREE.PlaneGeometry(1.25, 1.25)
      const sign = new THREE.Mesh(signGeometry, signMaterial)
      sign.position.z = 0.3
      group.add(sign)
      let pointerX = 0
      let pointerY = 0
      let frame = 0
      const render = (time = 0) => {
        frame = 0
        material.color.set(banks[selected]!.color)
        group.rotation.set(motion.matches ? 0.08 : Math.sin(time * 0.0006) * 0.10 + pointerY * 0.13, motion.matches ? -0.12 : Math.sin(time * 0.0004) * 0.25 + pointerX * 0.2, -0.05)
        group.position.y = motion.matches ? 0 : Math.sin(time * 0.001) * 0.08
        mesh.scale.z = 1 + step * 0.7
        renderer.render(scene, camera)
        if (visible && !document.hidden && !motion.matches) frame = requestAnimationFrame(render)
      }
      updateScene = () => {
        cancelAnimationFrame(frame)
        render(performance.now())
      }
      const resize = new ResizeObserver(() => {
        const { width, height } = canvas.getBoundingClientRect()
        renderer.setSize(width, height, false)
        camera.aspect = width / Math.max(height, 1)
        camera.position.z = camera.aspect < 0.9 ? 14 : 11
        camera.updateProjectionMatrix()
        updateScene()
      })
      resize.observe(canvas)
      canvas.addEventListener('pointermove', event => {
        const bounds = canvas.getBoundingClientRect()
        pointerX = (event.clientX - bounds.left) / bounds.width - 0.5
        pointerY = (event.clientY - bounds.top) / bounds.height - 0.5
      })
      canvas.addEventListener('pointerleave', () => { pointerX = 0; pointerY = 0 })
      motion.addEventListener('change', updateScene)
      document.addEventListener('visibilitychange', updateScene)
      disposeScene = () => {
        cancelAnimationFrame(frame)
        resize.disconnect()
        motion.removeEventListener('change', updateScene)
        document.removeEventListener('visibilitychange', updateScene)
        geometry.dispose()
        material.dispose()
        signGeometry.dispose()
        signMaterial.dispose()
        signTexture.dispose()
        renderer.dispose()
      }
      updateScene()
    } catch {
      canvas.hidden = true
      const fallback = document.createElement('div')
      fallback.className = 'bank-scene-fallback'
      fallback.innerHTML = await QRCode.toString('https://example.invalid/bank-demo', { type: 'svg', margin: 2 })
      canvas.parentElement!.append(fallback)
    }
  }, { rootMargin: '160px' })
  observer.observe(section)
  if (import.meta.hot) import.meta.hot.dispose(() => { observer.disconnect(); disposeScene() })
}