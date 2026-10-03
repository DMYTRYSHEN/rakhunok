import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

type Pose = 'idle' | 'listen' | 'think' | 'create'

export function mountRahunokMorph(stage: HTMLElement, initial: Pose) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.25
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.domElement.className = 'ra-canvas'
  renderer.domElement.setAttribute('aria-hidden', 'true')
  const scene = new THREE.Scene()
  const environment = new RoomEnvironment()
  const generator = new THREE.PMREMGenerator(renderer)
  const lighting = generator.fromScene(environment, 0.04)
  scene.environment = lighting.texture
  environment.dispose()
  generator.dispose()
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 30)
  camera.position.set(0.15, 1.85, 5.5)
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.target.set(0, 1.42, 0)
  controls.enablePan = false
  controls.enableZoom = false
  controls.enableDamping = true
  controls.minPolarAngle = Math.PI * 0.36
  controls.maxPolarAngle = Math.PI * 0.56
  controls.minAzimuthAngle = -Math.PI * 0.65
  controls.maxAzimuthAngle = Math.PI * 0.65
  controls.touches.ONE = THREE.TOUCH.ROTATE
  controls.touches.TWO = THREE.TOUCH.ROTATE
  controls.update()
  scene.add(new THREE.HemisphereLight(0xeaf5ff, 0xb1b9b8, 2))
  const key = new THREE.DirectionalLight(0xfff0dc, 4)
  key.position.set(-3, 5, 4)
  key.castShadow = true
    key.shadow.mapSize.set(512, 512)
  key.shadow.camera.left = -3
  key.shadow.camera.right = 3
  key.shadow.camera.top = 4
  key.shadow.camera.bottom = -2
  key.shadow.normalBias = 0.025
  key.shadow.bias = -0.0002
  scene.add(key)
  const rim = new THREE.DirectionalLight(0x8ce4e0, 3)
  rim.position.set(3, 3, -2)
  scene.add(rim)

  const materials: THREE.Material[] = []
  const geometries: THREE.BufferGeometry[] = []
  const material = (color: number, metalness = 0, roughness = 0.48) => {
    const result = new THREE.MeshStandardMaterial({ color, metalness, roughness })
    materials.push(result)
    return result
  }
  const skin = material(0xe9b391, 0, 0.58)
  const ears = material(0xd79380, 0, 0.65)
  const silver = material(0xd7dfe1, 0.35, 0.36)
  const hairShadow = material(0x241d22, 0, 0.42)
  const hairHighlight = material(0x403039, 0, 0.48)
  const suit = material(0x294c48, 0, 0.82)
  const lapel = material(0x3d6960, 0, 0.68)
  const tie = material(0x963c51, 0, 0.62)
  const white = material(0xf2f5ed)
  const dark = material(0x222d32)
  const iris = material(0x438f92, 0.1, 0.25)
  const mouthMaterial = material(0x85544f)
  const gold = material(0xe6b74d, 0.7, 0.27)
  const glow = material(0x61e5d0, 0.3, 0.3)
  glow.emissive.setHex(0x218c77)
  glow.emissiveIntensity = 0.45
  const mesh = (parent: THREE.Object3D, geometry: THREE.BufferGeometry, surface: THREE.Material, position: number[], scale = [1, 1, 1]) => {
    geometries.push(geometry)
    const object = new THREE.Mesh(geometry, surface)
    object.position.set(position[0], position[1], position[2])
    object.scale.set(scale[0], scale[1], scale[2])
    object.castShadow = true
    object.receiveShadow = true
    parent.add(object)
    return object
  }
  const sphere = (parent: THREE.Object3D, surface: THREE.Material, position: number[], scale: number[]) =>
    mesh(parent, new THREE.SphereGeometry(1, 32, 24), surface, position, scale)
  const box = (parent: THREE.Object3D, surface: THREE.Material, position: number[], scale: number[]) =>
    mesh(parent, new THREE.BoxGeometry(1, 1, 1), surface, position, scale)
  const tube = (parent: THREE.Object3D, surface: THREE.Material, points: number[][], radius: number) =>
    mesh(parent, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point))), 24, radius, 8, false), surface, [0, 0, 0])
  const group = (parent: THREE.Object3D, name: string, position: number[]) => {
    const object = new THREE.Group()
    object.name = name
    object.position.set(position[0], position[1], position[2])
    parent.add(object)
    return object
  }
  const tailored = (parent: THREE.Object3D, surface: THREE.Material, outline: number[][], position: number[], depth = 0.018) => {
    const shape = new THREE.Shape()
    shape.moveTo(outline[0][0], outline[0][1])
    for (const point of outline.slice(1)) shape.lineTo(point[0], point[1])
    shape.closePath()
    return mesh(parent, new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.006, bevelSegments: 3, steps: 1 }), surface, position)
  }
  const floorMaterial = new THREE.ShadowMaterial({ opacity: 0.15 })
  materials.push(floorMaterial)
  const floor = mesh(scene, new THREE.PlaneGeometry(200, 200), floorMaterial, [0, 0, 0])
  floor.rotation.x = -Math.PI / 2
  floor.castShadow = false
  const hero = group(scene, 'hero', [0, 0, 0])
  hero.visible = false
  const snow = group(scene, 'snow', [0, 0, 0])
  const snowMeshes: THREE.Mesh[] = []
  const textures = new Set<THREE.Texture>()
  for (const side of [-1, 1]) {
    sphere(hero, suit, [side * 0.17, 0.55, 0], [0.15, 0.52, 0.18])
    sphere(hero, dark, [side * 0.17, 0.1, 0.12], [0.17, 0.1, 0.29])
  }
  const body = group(hero, 'body', [0, 1.15, 0])
  sphere(body, suit, [0, 0.27, 0], [0.43, 0.58, 0.25])
  sphere(body, white, [0, 0.57, 0.195], [0.17, 0.28, 0.065])
  for (const side of [-1, 1]) {
    tailored(body, lapel, [[side * 0.13, 0.79], [side * 0.3, 0.66], [side * 0.23, 0.59], [side * 0.28, 0.55], [side * 0.035, 0.24], [side * 0.1, 0.59]], [0, 0, 0.248])
    tailored(body, white, [[side * 0.015, 0.77], [side * 0.12, 0.8], [side * 0.16, 0.69], [side * 0.065, 0.62]], [0, 0, 0.283])
  }
  tailored(body, tie, [[-0.045, 0.72], [0.045, 0.72], [0.025, 0.64], [-0.025, 0.64]], [0, 0, 0.316])
  tailored(body, tie, [[-0.024, 0.64], [0.024, 0.64], [0.05, 0.36], [0, 0.3], [-0.05, 0.36]], [0, 0, 0.299])
  box(body, gold, [0, 0.48, 0.334], [0.086, 0.013, 0.014])
  for (const height of [0.22, 0.05]) sphere(body, gold, [0.055, height, 0.253], [0.02, 0.02, 0.012])
  tailored(body, white, [[-0.3, 0.53], [-0.29, 0.6], [-0.255, 0.565], [-0.22, 0.61], [-0.19, 0.53]], [0, 0, 0.265])
  box(body, lapel, [-0.245, 0.53, 0.285], [0.15, 0.024, 0.025])
  for (const side of [-1, 1]) tube(body, lapel, [[side * 0.15, 0.04, 0.233], [side * 0.25, 0.04, 0.213], [side * 0.32, 0.05, 0.181]], 0.009)
  sphere(body, skin, [0, 0.84, 0], [0.13, 0.22, 0.13])
  const head = group(body, 'head', [0, 1.13, 0.025])
  sphere(head, skin, [0, 0, 0], [0.35, 0.375, 0.29])
  sphere(head, skin, [0, -0.16, 0.035], [0.285, 0.19, 0.25])
  for (const side of [-1, 1]) {
    sphere(head, skin, [side * 0.343, -0.005, 0], [0.071, 0.104, 0.065])
    sphere(head, ears, [side * 0.367, -0.005, 0.046], [0.027, 0.055, 0.02])
    sphere(head, skin, [side * 0.185, -0.1, 0.196], [0.127, 0.105, 0.076])
  }
  const eyeGroups: THREE.Group[] = []
  for (const side of [-1, 1]) {
    const eye = group(head, `eye${side}`, [side * 0.138, 0.045, 0.249])
    sphere(eye, white, [0, 0, 0], [0.106, 0.081, 0.052])
    sphere(eye, iris, [-side * 0.008, -0.002, 0.044], [0.048, 0.057, 0.019])
    sphere(eye, dark, [-side * 0.008, -0.002, 0.06], [0.024, 0.035, 0.009])
    sphere(eye, white, [-0.023, 0.023, 0.071], [0.012, 0.014, 0.004])
    sphere(eye, white, [0.015, -0.017, 0.07], [0.005, 0.006, 0.003])
    tube(eye, skin, [[-0.1, 0.018, 0.012], [-0.062, 0.07, 0.033], [0, 0.081, 0.04], [0.067, 0.061, 0.032], [0.1, 0.015, 0.009]], 0.014)
    tube(head, hairShadow, [[side * 0.056, 0.165, 0.277], [side * 0.13, 0.19, 0.271], [side * 0.232, 0.155, 0.225]], 0.021)
    eyeGroups.push(eye)
  }
  sphere(head, skin, [0, -0.026, 0.276], [0.048, 0.076, 0.054])
  sphere(head, skin, [0, -0.064, 0.318], [0.069, 0.048, 0.06])
  const mouth = group(head, 'mouth', [0, -0.17, 0.274])
  const smile = new THREE.Shape()
  smile.moveTo(-0.108, 0.016)
  smile.quadraticCurveTo(0, -0.003, 0.108, 0.023)
  smile.quadraticCurveTo(0.035, -0.086, -0.055, -0.035)
  smile.quadraticCurveTo(-0.09, -0.012, -0.108, 0.016)
  mesh(mouth, new THREE.ShapeGeometry(smile, 24), mouthMaterial, [0, 0, 0])
  tube(mouth, white, [[-0.075, 0.006, 0.005], [0, -0.005, 0.013], [0.079, 0.012, 0.005]], 0.013)
  tube(mouth, ears, [[-0.075, -0.027, 0], [0, -0.048, 0.002], [0.076, -0.023, 0]], 0.009)
  sphere(head, hairShadow, [0, 0.15, -0.091], [0.357, 0.267, 0.254])
  const quiff = sphere(head, hairShadow, [-0.066, 0.306, 0.04], [0.292, 0.15, 0.244])
  quiff.rotation.z = 0.2
  const sweep = sphere(head, hairShadow, [-0.12, 0.26, 0.193], [0.205, 0.092, 0.11])
  sweep.rotation.z = 0.29
  for (let index = 0; index < 5; index++) {
    const offset = index * 0.032
    tube(head, hairHighlight, [[-0.285 + offset, 0.26, 0.17], [-0.22 + offset, 0.35, 0.223], [-0.07 + offset, 0.402, 0.18], [0.09 + offset, 0.372, 0.08]], 0.006)
  }
  for (const side of [-1, 1]) sphere(head, hairShadow, [side * 0.316, 0.11, -0.054], [0.047, 0.14, 0.185])

  const makeArm = (side: number, name: string) => {
    const shoulder = group(body, name, [side * 0.38, 0.64, 0])
    sphere(shoulder, suit, [0, -0.21, 0], [0.142, 0.31, 0.155])
    const elbow = group(shoulder, `${name}Elbow`, [0, -0.44, 0])
    sphere(elbow, suit, [0, -0.18, 0], [0.108, 0.24, 0.117])
    sphere(elbow, white, [0, -0.35, 0], [0.103, 0.047, 0.112])
    sphere(elbow, gold, [side * 0.083, -0.35, 0.068], [0.017, 0.017, 0.012])
    if (side === -1) {
      const watch = mesh(elbow, new THREE.TorusGeometry(0.09, 0.015, 8, 32), dark, [0, -0.385, 0])
      watch.rotation.x = Math.PI / 2
      sphere(elbow, gold, [0, -0.385, 0.092], [0.051, 0.047, 0.015])
      sphere(elbow, white, [0, -0.385, 0.106], [0.041, 0.037, 0.007])
      tube(elbow, dark, [[-0.022, -0.375, 0.115], [0, -0.385, 0.117], [0, -0.36, 0.115]], 0.003)
    }
    const hand = group(elbow, `${name}Hand`, [0, -0.43, 0])
    sphere(hand, skin, [0, -0.045, 0], [0.105, 0.13, 0.049])
    for (let digit = 0; digit < 4; digit++) {
      const finger = mesh(hand, new THREE.CapsuleGeometry(0.022, 0.105 - Math.abs(digit - 1.5) * 0.02, 4, 8), skin,
        [-0.074 + digit * 0.049, -0.17 + Math.abs(digit - 1.5) * 0.014, 0])
      finger.rotation.z = (digit - 1.5) * -0.09
    }
    const thumb = sphere(hand, skin, [-side * 0.11, -0.06, 0.015], [0.034, 0.085, 0.036])
    thumb.rotation.z = -side * 0.6
    return { shoulder, elbow, hand }
  }
  const left = makeArm(-1, 'leftArm')
  const right = makeArm(1, 'rightArm')

  const badge = group(body, 'badge', [0.235, 0.61, 0.254])
  const coin = mesh(badge, new THREE.CylinderGeometry(0.064, 0.064, 0.017, 32), gold, [0, 0, 0])
  coin.rotation.x = Math.PI / 2
  tube(badge, dark, [[-0.027, 0.032, 0.014], [0.022, 0.023, 0.014], [-0.022, -0.022, 0.014], [0.027, -0.031, 0.014]], 0.005)
  for (const height of [-0.008, 0.009]) box(badge, dark, [0, height, 0.015], [0.073, 0.006, 0.006])

  const invoice = group(scene, 'invoice', [0.72, 1.23, 0.55])
  box(invoice, lapel, [0, 0, 0], [0.63, 0.82, 0.055])
  box(invoice, white, [0, 0, 0.035], [0.57, 0.75, 0.025])
  box(invoice, glow, [-0.12, 0.25, 0.06], [0.22, 0.035, 0.01])
  for (let line = 0; line < 4; line++) box(invoice, line === 3 ? lapel : silver, [-0.04, 0.12 - line * 0.08, 0.06], [0.37 - line * 0.035, 0.02, 0.01])
  const seal = mesh(invoice, new THREE.CylinderGeometry(0.07, 0.07, 0.015, 24), gold, [0.16, -0.23, 0.06])
  seal.rotation.x = Math.PI / 2
  const effect = group(scene, 'effect', [-0.72, 1.75, 0.35])
  const ring = mesh(effect, new THREE.TorusGeometry(0.22, 0.014, 12, 64), glow, [0, 0, 0])
  const check = group(effect, 'check', [0, 0, 0.025])
  tube(check, glow, [[-0.11, 0, 0], [-0.025, -0.085, 0], [0.12, 0.1, 0]], 0.018)
  const alert = group(effect, 'alert', [0, 0, 0.025])
  const red = material(0xdc554b)
  box(alert, red, [0, 0.04, 0], [0.035, 0.16, 0.025])
  sphere(alert, red, [0, -0.095, 0], [0.022, 0.022, 0.022])
  const dots = group(effect, 'dots', [0, 0, 0.025])
  for (const offset of [-0.1, 0, 0.1]) sphere(dots, glow, [offset, 0, 0], [0.025, 0.025, 0.025])

  const mixer = new THREE.AnimationMixer(body)
  const poses: Record<string, number[]> = {
    idle: [0.12, -0.12, -0.12, -0.12, 0],
    listen: [0.12, -0.2, 0.88, -2.25, -0.12],
    think: [0.12, -0.25, 0.36, -2.55, 0.12],
    speak: [-0.6, -0.6, 0.75, -0.9, 0],
    success: [-0.28, -0.25, 2.15, -0.45, -0.04],
    error: [-0.35, -0.65, 0.45, -0.65, 0.1],
    payment: [-0.18, -0.2, 0.62, -1.2, 0],
    scan: [-0.25, -0.6, 0.8, -1.3, 0.08],
    waiting: [0.18, -0.18, -0.18, -0.18, 0.03],
    confirm: [-0.4, -0.4, 0.85, -1.25, -0.08],
    create: [-0.2, -0.35, 0.72, -1.35, 0.04],
  }
  const tracks = ['leftArm.rotation[z]', 'leftArmElbow.rotation[x]', 'rightArm.rotation[z]', 'rightArmElbow.rotation[x]', 'head.rotation[z]']
  const actions = new Map(Object.entries(poses).map(([name, values]) => {
    const clip = new THREE.AnimationClip(name, 3, values.map((value, index) => new THREE.NumberKeyframeTrack(tracks[index], [0, 1.5, 3], [value, value, value])))
    return [name, mixer.clipAction(clip)]
  }))
  let state: string = initial
  let active = actions.get(state)!
  active.play()
  let changed = performance.now()
  let lastFrame = changed
  let voice = 0
  let voiceDriven = false
  let zoom = 0
  let visible = true
  let disposed = false
  let loaded = false
  let dirty = true
  let interacting = false
  let clock = 0
  const reduced = matchMedia('(prefers-reduced-motion: reduce)')
  const ready = new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/rahunok-snow.glb?v=gestures-2`).then(asset => {
    const bounds = new THREE.Box3()
    asset.scene.updateMatrixWorld(true)
    asset.scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return
      const surfaces = Array.isArray(object.material) ? object.material : [object.material]
      for (const surface of surfaces) {
        for (const value of Object.values(surface)) if (value instanceof THREE.Texture) textures.add(value)
        materials.push(surface)
      }
      geometries.push(object.geometry)
      const positions = object.geometry.getAttribute('position') as THREE.BufferAttribute
      bounds.union(new THREE.Box3().setFromBufferAttribute(positions).applyMatrix4(object.matrixWorld))
      object.castShadow = true
      object.receiveShadow = true
      object.frustumCulled = false
      if (object.morphTargetInfluences) snowMeshes.push(object)
    })
    if (disposed) {
      for (const geometry of geometries) geometry.dispose()
      for (const surface of materials) surface.dispose()
      for (const texture of textures) texture.dispose()
      return
    }
    const scale = 2.65 / bounds.getSize(new THREE.Vector3()).y
    asset.scene.scale.setScalar(scale)
    asset.scene.position.copy(bounds.getCenter(new THREE.Vector3())).multiplyScalar(-scale)
    asset.scene.position.y = -bounds.min.y * scale
    snow.add(asset.scene)
    loaded = true
    dirty = true
  }).catch(error => { dispose(); throw error })
  const events = new AbortController()
  const pointer = new THREE.Vector2()
  const viewDirection = new THREE.Vector3()
  const change = () => { dirty = true }
  controls.addEventListener('change', change)
  controls.addEventListener('start', () => { interacting = true })
  controls.addEventListener('end', () => { interacting = false })
  const resize = new ResizeObserver(() => {
    const bounds = stage.getBoundingClientRect()
    if (!bounds.width || !bounds.height) return
    renderer.setSize(bounds.width, bounds.height, false)
    camera.aspect = bounds.width / bounds.height
    camera.updateProjectionMatrix()
    dirty = true
  })
  resize.observe(stage)
  const visibility = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; dirty = true })
  visibility.observe(stage)
  stage.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse') return
    const bounds = stage.getBoundingClientRect()
    pointer.set((event.clientX - bounds.left) / bounds.width - 0.5, (event.clientY - bounds.top) / bounds.height - 0.5)
    dirty = true
  }, { signal: events.signal })
  stage.addEventListener('pointerleave', () => { pointer.set(0, 0); dirty = true }, { signal: events.signal })
  reduced.addEventListener('change', change, { signal: events.signal })
  renderer.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); dispose() }, { signal: events.signal })

  function frame(now: number) {
    if (now - lastFrame < 1000 / 30) return
    const delta = Math.min((now - lastFrame) / 1000, 0.05)
    lastFrame = now
    if (disposed || !loaded || !visible || document.hidden) return
    controls.enableDamping = !reduced.matches
    controls.update()
    if (reduced.matches && !dirty) return
    clock += reduced.matches ? 0 : delta
    mixer.update(reduced.matches ? 1 : delta)
    const damp = reduced.matches ? 1 : 1 - Math.exp(-delta * 5)
    const animated = reduced.matches ? 0 : 1
    const phase = (speed: number) => (Math.sin(clock * speed) + 1) / 2
    const weights: Record<string, number> = { [state]: 1 }
    const blend = (first: string, second: string, amount: number) => {
      delete weights[state]
      weights[first] = 1 - amount
      weights[second] = amount
    }
    if (state === 'idle') blend('greet', 'wave', animated ? phase(7) : 0.5)
    if (state === 'listen') blend('listen', 'listenTilt', animated ? phase(1.6) : 0)
    if (state === 'think') blend('think', 'thinkShift', animated ? phase(1.1) : 0)
    if (state === 'success') blend('success', 'successPulse', animated ? phase(2.4) : 0)
    if (state === 'error') blend('error', 'errorShift', animated ? phase(1.2) : 0)
    if (state === 'speak') {
      const syllable = Math.max(0, Math.sin(clock * 13)) * 0.65 + phase(21) * 0.35
      blend('speak', 'speakOpen', animated * (voiceDriven ? voice : syllable))
    }
    for (const object of snowMeshes) {
      const influences = object.morphTargetInfluences!
      for (const [name, index] of Object.entries(object.morphTargetDictionary!)) {
        const target = weights[name] ?? 0
        const response = state === 'speak' ? (reduced.matches ? 1 : 1 - Math.exp(-delta * 24)) : damp
        influences[index] = THREE.MathUtils.lerp(influences[index], target, response)
      }
    }
    snow.position.y = Math.sin(clock * 1.7) * 0.009 * animated
    snow.rotation.y = THREE.MathUtils.lerp(snow.rotation.y, pointer.x * 0.25 * animated, damp)
    snow.rotation.z = state === 'speak' ? Math.sin(clock * 2.3) * voice * 0.012 * animated : 0
    const intro = reduced.matches ? 1 : THREE.MathUtils.smoothstep((now - changed) / 1000, 0, 1)
    const isInvoice = ['create', 'payment', 'confirm', 'scan'].includes(state)
    const isEffect = ['think', 'success', 'error', 'waiting', 'confirm', 'listen', 'scan'].includes(state)
    body.position.y = 1.15 + Math.sin(clock * 1.7) * 0.009 * animated
    hero.rotation.y = THREE.MathUtils.lerp(hero.rotation.y, (-0.12 + pointer.x * 0.32) * animated, damp)
    head.rotation.y = THREE.MathUtils.lerp(head.rotation.y, pointer.x * 0.28 * animated, damp)
    head.rotation.x = Math.sin(clock * 1.3) * 0.025 * animated + pointer.y * 0.12 * animated
    if (state === 'success') head.rotation.x += Math.sin(intro * Math.PI * 2) * 0.13 * animated
    right.hand.rotation.z = state === 'success' ? Math.sin(clock * 7) * 0.22 * animated : -0.12
    left.hand.rotation.z = state === 'speak' ? Math.sin(clock * 2.3) * 0.12 * animated : 0.12
    const blink = animated && clock % 4.6 > 4.42 ? Math.max(0.08, Math.abs(Math.cos((clock % 4.6 - 4.42) / 0.18 * Math.PI))) : 1
    for (const eye of eyeGroups) eye.scale.y = blink
    mouth.scale.y = 1 + voice * 2 * animated
    const invoiceScale = isInvoice ? 1 : 0
    invoice.scale.setScalar(THREE.MathUtils.lerp(invoice.scale.x, invoiceScale, damp))
    invoice.visible = invoice.scale.x > 0.01
    invoice.rotation.set(-0.08, -0.3 + Math.sin(clock * 0.7) * 0.06 * animated, Math.sin(clock) * 0.025 * animated)
    invoice.position.y = 1.23 + Math.sin(clock * 1.7) * 0.035 * animated
    effect.scale.setScalar(THREE.MathUtils.lerp(effect.scale.x, isEffect ? 1 : 0, damp))
    effect.visible = effect.scale.x > 0.01
    check.visible = state === 'success'
    alert.visible = state === 'error' || state === 'confirm'
    dots.visible = !check.visible && !alert.visible
    ring.rotation.y = Math.sin(clock) * 0.18 * animated
    effect.position.y = 1.75 + Math.sin(clock * 1.4) * 0.04 * animated
    for (const [index, dot] of dots.children.entries()) dot.position.y = Math.sin(clock * 3 - index * 0.8) * 0.035 * animated
    const distance = (state === 'speak' ? 3.0 : state === 'listen' ? 3.7 : state === 'think' ? 4.3 : 5.5) - zoom * 0.9
    const targetHeight = (state === 'speak' ? 2.15 : state === 'listen' ? 1.95 : 1.42) + zoom * 0.15
    controls.target.y = THREE.MathUtils.lerp(controls.target.y, targetHeight, damp)
    if (!interacting) {
      viewDirection.copy(camera.position).sub(controls.target)
      viewDirection.setLength(THREE.MathUtils.lerp(viewDirection.length(), distance, damp))
      camera.position.copy(controls.target).add(viewDirection)
    }
    camera.lookAt(controls.target)
    renderer.render(scene, camera)
    stage.dataset.renderer = 'webgl'
    stage.dataset.morphing = String(intro < 1)
    stage.dataset.scene = 'snow'
    dirty = false
  }
  function dispose() {
    if (disposed) return
    disposed = true
    renderer.setAnimationLoop(null)
    resize.disconnect()
    visibility.disconnect()
    events.abort()
    controls.dispose()
    mixer.stopAllAction()
    mixer.uncacheRoot(body)
    for (const geometry of geometries) geometry.dispose()
    for (const surface of materials) surface.dispose()
    for (const texture of textures) texture.dispose()
    lighting.dispose()
    renderer.dispose()
    renderer.domElement.remove()
    delete stage.dataset.renderer
    delete stage.dataset.morphing
    delete stage.dataset.scene
  }
  invoice.scale.setScalar(0)
  effect.scale.setScalar(0)
  stage.prepend(renderer.domElement)
  renderer.setAnimationLoop(frame)
  return {
    ready,
    setPose(_pose: Pose, nextState: string) {
      if (disposed) return
      state = nextState
      const next = actions.get(state) ?? actions.get('idle')!
      if (active !== next) {
        const values = [left.shoulder.rotation.z, left.elbow.rotation.x, right.shoulder.rotation.z, right.elbow.rotation.x, head.rotation.z]
        const transition = new THREE.AnimationClip('transition', 0.7, values.map((value, index) => new THREE.NumberKeyframeTrack(tracks[index], [0, 0.7], [value, (poses[state] ?? poses.idle)[index]])))
        mixer.stopAllAction()
        if (active.getClip().name === 'transition') mixer.uncacheClip(active.getClip())
        const action = reduced.matches ? next.reset() : mixer.clipAction(transition).setLoop(THREE.LoopOnce, 1)
        action.clampWhenFinished = true
        action.setEffectiveWeight(1).play()
        active = action
      }
      changed = performance.now()
      dirty = true
    },
    setVoiceLevel(level: number) { voiceDriven = true; voice = Number.isFinite(level) ? THREE.MathUtils.clamp(level, 0, 1) : 0; dirty = true },
    setZoom(level: number) { zoom = Number.isFinite(level) ? THREE.MathUtils.clamp(level, 0, 1) : 0; dirty = true },
    setAngle(degrees: number) {
      if (disposed || !Number.isFinite(degrees)) return
      const offset = new THREE.Spherical().setFromVector3(viewDirection.copy(camera.position).sub(controls.target))
      offset.theta = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(degrees, -110, 110))
      camera.position.copy(controls.target).add(viewDirection.setFromSpherical(offset))
      controls.update()
      dirty = true
    },
    dispose,
  }
}