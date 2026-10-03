import QRCode from 'qrcode'
import './rahunok-assistant.css'

export const assistantStates = ['idle', 'listen', 'think', 'speak', 'success', 'error', 'payment', 'scan', 'waiting', 'confirm', 'create'] as const
export type AssistantState = typeof assistantStates[number]
type Pose = 'idle' | 'listen' | 'think' | 'create'

export interface AssistantOptions {
  qrValue: string
  onTalk?: () => void
  preview?: boolean
}

const statePoses: Record<AssistantState, Pose> = {
  idle: 'idle', listen: 'listen', think: 'think', speak: 'idle', success: 'idle',
  error: 'idle', payment: 'create', scan: 'think', waiting: 'idle', confirm: 'create', create: 'create',
}
const labels: Record<AssistantState, string> = {
  idle: 'Поруч', listen: 'Слухаю', think: 'Думаю', speak: 'Відповідаю',
  success: 'Готово', error: 'Потрібна увага', payment: 'Очікую оплату',
  scan: 'Сканування', waiting: 'Очікую', confirm: 'Потрібне підтвердження', create: 'Створюю рахунок',
}

export function mountRahunokAssistant(host: HTMLElement, options: AssistantOptions) {
  const qr = QRCode.create(options.qrValue, { errorCorrectionLevel: 'M' })
  const cells: string[] = []
  for (let row = 0; row < qr.modules.size; row++) {
    for (let column = 0; column < qr.modules.size; column++) {
      if (qr.modules.data[row * qr.modules.size + column]) cells.push(`<rect x="${column + 4}" y="${row + 4}" width="1" height="1"/>`)
    }
  }
  host.innerHTML = `
    <div class="rahunok-assistant" data-state="idle" data-pose="idle">
      <div class="ra-caption"><span>RAHUNOK / ₴</span><span class="ra-caption-end">ЗАВЖДИ ПОРУЧ</span></div>
      <div class="ra-stage" role="img" aria-label="Рахунок: поруч" aria-busy="true">
        <svg class="ra-fallback" aria-hidden="true" viewBox="0 0 400 400">
          <ellipse cx="200" cy="369" rx="68" ry="8" fill="#d8dfde"/>
          <path d="M165 275h70l-8 85h-23l-4-65-4 65h-23z" fill="#203c3e"/>
          <path d="M157 170q43-23 86 0l19 110H138z" fill="#203c3e"/>
          <path d="M181 163h38l-19 65z" fill="#f2f5ed"/>
          <path d="M185 172l15 56-34-37 7-26m42 7-15 56 34-37-7-26" fill="#366465"/>
          <path d="M153 177l-16 82m110-82 16 82" stroke="#203c3e" stroke-width="24" stroke-linecap="round"/>
          <path d="M137 267v12m126-12v12" stroke="#d8a78d" stroke-width="17" stroke-linecap="round"/>
          <rect x="190" y="146" width="20" height="27" rx="7" fill="#d8a78d"/>
          <ellipse cx="200" cy="117" rx="38" ry="46" fill="#d8a78d"/>
          <path d="M162 118q-14-66 41-62 43-4 37 62l-10-34q-27 21-56 5z" fill="#bcc8cc"/>
          <path d="M174 74q24-23 53-3m-54 9q23-20 50-8" fill="none" stroke="#e2e7e8" stroke-width="5"/>
          <ellipse cx="185" cy="115" rx="8" ry="6" fill="#f2f5ed"/><ellipse cx="215" cy="115" rx="8" ry="6" fill="#f2f5ed"/>
          <g fill="#438f92"><circle cx="185" cy="115" r="4"/><circle cx="215" cy="115" r="4"/></g>
          <path d="M188 139q12 8 24 0" fill="none" stroke="#85544f" stroke-width="2"/>
          <circle cx="226" cy="188" r="8" fill="#e6b74d"/><text x="226" y="192" font-size="12" text-anchor="middle" fill="#203c3e">₴</text>
        </svg>
        <div class="ra-signal" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
        <span class="ra-outcome" aria-hidden="true"></span>
      </div>
      <div class="ra-footer">
        <div><strong>Рахунок.</strong><span class="ra-status" role="status" aria-live="polite">Поруч</span></div>
        <svg class="ra-link-qr" role="img" aria-label="QR-посилання на сторінку" viewBox="0 0 ${qr.modules.size + 8} ${qr.modules.size + 8}"><rect width="100%" height="100%" fill="white"/><g fill="#162f3b">${cells.join('')}</g></svg>
        <button class="ra-talk" type="button" hidden>Говорити</button>
      </div>
      <div class="ra-controls" hidden>
        <label>Масштаб<input class="ra-zoom" type="range" min="0" max="100" value="0" aria-label="Наближення персонажа"/></label>
        <label>Ракурс<input class="ra-angle" type="range" min="-110" max="110" value="0" aria-label="Поворот персонажа"/></label>
      </div>
      ${options.preview ? `<div class="ra-demo-row"><label class="ra-preview">Стан<select aria-label="Перегляд анімації Rahunok">${assistantStates.map(state => `<option value="${state}">${labels[state]}</option>`).join('')}</select></label><label class="ra-demo-label"><input class="ra-demo" type="checkbox" role="switch"/>Демо</label></div>` : ''}
    </div>`
  const root = host.querySelector<HTMLElement>('.rahunok-assistant')!
  const stage = root.querySelector<HTMLElement>('.ra-stage')!
  const status = root.querySelector<HTMLElement>('.ra-status')!
  const outcome = root.querySelector<HTMLElement>('.ra-outcome')!
  const selector = root.querySelector<HTMLSelectElement>('select')
  const talk = root.querySelector<HTMLButtonElement>('.ra-talk')!
  const events = new AbortController()
  const controls = root.querySelector<HTMLElement>('.ra-controls')!
  const zoom = root.querySelector<HTMLInputElement>('.ra-zoom')!
  const angle = root.querySelector<HTMLInputElement>('.ra-angle')!
  const demo = root.querySelector<HTMLInputElement>('.ra-demo')
  const reduced = matchMedia('(prefers-reduced-motion: reduce)')
  const sequence: AssistantState[] = ['listen', 'think', 'create', 'payment', 'success', 'speak', 'idle']
  let demoIndex = 0
  let demoTimer: ReturnType<typeof setInterval> | undefined
  let stateWasSet = false
  let destroyed = false
  let currentState: AssistantState = 'idle'
  let voiceLevel = 0
  let morph: ReturnType<typeof import('./rahunok-morph.ts').mountRahunokMorph> | undefined

  function showState(state: AssistantState, message: string) {
    const pose = statePoses[state]
    currentState = state
    morph?.setPose(pose, state)
    root.dataset.pose = pose
    root.dataset.state = state
    stage.setAttribute('aria-label', `Рахунок: ${message.toLowerCase()}`)
    status.textContent = message
    outcome.textContent = state === 'success' ? '✓' : state === 'error' ? '!' : state === 'confirm' ? '?' : ''
  }

  function stopDemo() {
    clearInterval(demoTimer)
    demoTimer = undefined
    if (demo) demo.checked = false
  }

  function setState(state: AssistantState, message?: string) {
    if (destroyed) return
    if (!assistantStates.includes(state)) throw new Error(`Unknown assistant state: ${state}`)
    stateWasSet = true
    stopDemo()
    root.style.setProperty('--voice', '0')
    voiceLevel = 0
    morph?.setVoiceLevel(0)
    if (selector) selector.value = state
    showState(state, message ?? labels[state])
  }
  if (options.onTalk) {
    talk.hidden = false
    talk.addEventListener('click', options.onTalk, { signal: events.signal })
  }
  selector?.addEventListener('change', () => {
    const state = selector.value as AssistantState
    setState(state, `Ескіз: ${labels[state].toLowerCase()}`)
  }, { signal: events.signal })
  function startDemo() {
    stopDemo()
    if (!demo || !morph || destroyed || reduced.matches) return
    demo.checked = true
    demoTimer = setInterval(() => {
      if (document.hidden || !stage.getBoundingClientRect().height) return
      const bounds = stage.getBoundingClientRect()
      if (bounds.bottom < 0 || bounds.top > innerHeight) return
      const state = sequence[demoIndex++ % sequence.length]
      if (selector) selector.value = state
      showState(state, `Ескіз: ${labels[state].toLowerCase()}`)
    }, 3600)
  }
  demo?.addEventListener('change', () => { if (demo.checked) startDemo(); else stopDemo() }, { signal: events.signal })
  reduced.addEventListener('change', () => { if (reduced.matches) stopDemo() }, { signal: events.signal })
  zoom.addEventListener('input', () => morph?.setZoom(Number(zoom.value) / 100), { signal: events.signal })
  angle.addEventListener('input', () => morph?.setAngle(Number(angle.value)), { signal: events.signal })
  stage.addEventListener('webglcontextlost', () => { controls.hidden = true; stopDemo() }, { capture: true, signal: events.signal })
  showState('idle', labels.idle)
  const ready = Promise.resolve()
  const visualReady = (async () => {
    try {
      const { mountRahunokMorph } = await import('./rahunok-morph.ts')
      if (destroyed) return
      morph = mountRahunokMorph(stage, statePoses[currentState])
      await morph.ready
      if (destroyed) return
      morph.setPose(statePoses[currentState], currentState)
      morph.setVoiceLevel(voiceLevel)
      controls.hidden = false
      if (!stateWasSet) startDemo()
    } catch {
      if (!destroyed) stage.dataset.renderer = 'vector'
    } finally {
      if (!destroyed) stage.setAttribute('aria-busy', 'false')
    }
  })()
  return {
    ready,
    visualReady,
    setState,
    setVoiceLevel(level: number) {
      if (destroyed) return
      voiceLevel = Number.isFinite(level) ? Math.min(1, Math.max(0, level)) : 0
      root.style.setProperty('--voice', String(voiceLevel))
      morph?.setVoiceLevel(voiceLevel)
    },
    destroy() {
      destroyed = true
      stopDemo()
      events.abort()
      morph?.dispose()
      root.remove()
    },
  }
}