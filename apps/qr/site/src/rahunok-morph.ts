type Pose = 'idle' | 'listen' | 'think' | 'create'

const portraits = import.meta.glob('../../img/*.jpg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const names: Record<Pose, string> = { idle: '(Idle)', listen: '(Listening)', think: '(Thinking)', create: '(Creating Invoice)' }

export function mountRahunokMorph(stage: HTMLElement, initial: Pose) {
  const canvas = document.createElement('canvas')
  canvas.className = 'ra-canvas'
  canvas.setAttribute('aria-hidden', 'true')
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D is unavailable')
  const composite = document.createElement('canvas')
  const previous = document.createElement('canvas')
  composite.width = composite.height = previous.width = previous.height = 1024
  const paint = composite.getContext('2d')!
  const history = previous.getContext('2d')!
  const images = new Map<Pose, HTMLImageElement>()
  const events = new AbortController()
  const reduced = matchMedia('(prefers-reduced-motion: reduce)')
  let pose = initial
  let state: string = initial
  let loaded = false
  let disposed = false
  let visible = true
  let dirty = true
  let transition = 1
  let last = 0
  let clock = 0
  let zoom = 0
  let angle = 0
  let voice = 0
  let pointer = 0
  let frameId = 0

  function drawPortrait(image: HTMLImageElement) {
    const scale = Math.min(1024 / image.naturalWidth, 1024 / image.naturalHeight)
    const width = image.naturalWidth * scale
    const height = image.naturalHeight * scale
    paint.drawImage(image, (1024 - width) / 2, (1024 - height) / 2, width, height)
  }

  function blend() {
    paint.globalAlpha = 1
    paint.fillStyle = '#f5f6f7'
    paint.fillRect(0, 0, 1024, 1024)
    paint.drawImage(previous, 0, 0)
    paint.globalAlpha = transition * transition * (3 - 2 * transition)
    drawPortrait(images.get(pose)!)
    paint.globalAlpha = 1
  }

  const ready = Promise.all(Object.entries(names).map(async ([name, marker]) => {
    const source = Object.entries(portraits).find(([path]) => path.includes(marker))?.[1]
    if (!source) throw new Error(`Missing portrait: ${name}`)
    const image = new Image()
    image.src = source
    await image.decode()
    images.set(name as Pose, image)
  })).then(() => {
    if (disposed) return
    loaded = true
    blend()
    dirty = true
  }).catch(error => { dispose(); throw error })

  const resize = new ResizeObserver(() => {
    const bounds = stage.getBoundingClientRect()
    const ratio = Math.min(devicePixelRatio, 2)
    canvas.width = Math.max(1, Math.round(bounds.width * ratio))
    canvas.height = Math.max(1, Math.round(bounds.height * ratio))
    dirty = true
  })
  resize.observe(stage)
  const visibility = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; dirty = true })
  visibility.observe(stage)
  reduced.addEventListener('change', () => { dirty = true }, { signal: events.signal })
  stage.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse') return
    const bounds = stage.getBoundingClientRect()
    pointer = (event.clientX - bounds.left) / bounds.width - 0.5
    dirty = true
  }, { signal: events.signal })
  stage.addEventListener('pointerleave', () => { pointer = 0; dirty = true }, { signal: events.signal })

  function frame(now: number) {
    if (disposed) return
    frameId = requestAnimationFrame(frame)
    if (now - last < 1000 / 30) return
    const delta = Math.min((now - last) / 1000, 0.05)
    last = now
    if (!loaded || !visible || document.hidden || (reduced.matches && !dirty)) return
    if (!reduced.matches) clock += delta
    transition = reduced.matches ? 1 : Math.min(1, transition + delta / 0.75)
    blend()
    const animated = reduced.matches ? 0 : 1
    const closeup = ['listen', 'speak'].includes(state) ? 0.07 : 0
    const scale = 1 + zoom * 0.25 + closeup + Math.sin(clock * 1.5) * 0.004 * animated
    const horizontal = angle / 110 * 0.025 + pointer * 0.018 * animated
    context!.resetTransform()
    context!.fillStyle = '#f5f6f7'
    context!.fillRect(0, 0, canvas.width, canvas.height)
    context!.translate(canvas.width * (0.5 + horizontal), canvas.height * (0.5 + zoom * 0.06 + closeup * 0.2))
    context!.rotate((angle / 110 * 0.018 + Math.sin(clock * 3) * voice * 0.002) * animated)
    context!.scale(scale, scale)
    context!.drawImage(composite, -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height)
    stage.dataset.renderer = 'jpeg'
    stage.dataset.scene = 'jpeg'
    stage.dataset.pose = pose
    stage.dataset.morphing = String(transition < 1)
    dirty = false
  }

  function dispose() {
    if (disposed) return
    disposed = true
    cancelAnimationFrame(frameId)
    resize.disconnect()
    visibility.disconnect()
    events.abort()
    images.clear()
    canvas.remove()
    delete stage.dataset.renderer
    delete stage.dataset.scene
    delete stage.dataset.pose
    delete stage.dataset.morphing
  }

  stage.prepend(canvas)
  frameId = requestAnimationFrame(frame)
  return {
    ready,
    setPose(next: Pose, nextState: string) {
      if (disposed) return
      if (loaded && next !== pose) {
        history.clearRect(0, 0, 1024, 1024)
        history.drawImage(composite, 0, 0)
        transition = 0
      }
      pose = next
      state = nextState
      dirty = true
    },
    setVoiceLevel(level: number) { voice = Number.isFinite(level) ? Math.min(1, Math.max(0, level)) : 0; dirty = true },
    setZoom(level: number) { zoom = Number.isFinite(level) ? Math.min(1, Math.max(0, level)) : 0; dirty = true },
    setAngle(degrees: number) { angle = Number.isFinite(degrees) ? Math.min(110, Math.max(-110, degrees)) : 0; dirty = true },
    dispose,
  }
}