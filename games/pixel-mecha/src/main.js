/**
 * 页面装配：画布、输入路由、主循环与模式切换。
 */
import { createAudio } from './core/audio.js'
import { createFramebuffer } from './core/framebuffer.js'
import { createInput } from './core/input.js'
import { startLoop } from './core/loop.js'
import { createRng } from './core/rng.js'
import { MECHA_PALETTES } from './art/palette.js'
import { GROUND_Y, SCENE_HEIGHT, SCENE_WIDTH, createScene } from './art/scene.js'
import { createAi } from './game/ai.js'
import { createFx } from './game/fx.js'
import { createFighter, FIGHTER_CONFIG } from './game/fighter.js'
import { createMatch } from './game/match.js'
import { renderWorld } from './ui/render.js'

const canvas = document.querySelector('#screen')
const context = canvas.getContext('2d', { alpha: false })
context.imageSmoothingEnabled = false
canvas.width = SCENE_WIDTH
canvas.height = SCENE_HEIGHT

const framebuffer = createFramebuffer(SCENE_WIDTH, SCENE_HEIGHT)
const imageData = context.createImageData(SCENE_WIDTH, SCENE_HEIGHT)
const input = createInput(window)
const audio = createAudio()
const scene = createScene()
const fx = createFx()
const rng = createRng(90210)

const fighter1 = createFighter({ id: 1, name: 'AZURE', palette: MECHA_PALETTES.azure, x: 96, facing: 1, groundY: GROUND_Y })
const fighter2 = createFighter({ id: 2, name: 'EMBER', palette: MECHA_PALETTES.ember, x: 224, facing: -1, groundY: GROUND_Y })
const ai2 = createAi('normal', rng)
const match = createMatch({ fighter1, fighter2, ai2, fx, audio })
match.reset()

const PLAYER_ONE_KEYS = {
  left: 'KeyA',
  right: 'KeyD',
  jump: 'KeyW',
  light: 'KeyJ',
  heavy: 'KeyK',
  block: 'KeyL',
}

const PLAYER_TWO_KEYS = {
  left: 'ArrowLeft',
  right: 'ArrowRight',
  jump: 'ArrowUp',
  light: 'Digit1',
  heavy: 'Digit2',
  block: 'Digit3',
  lightAlt: 'Numpad1',
  heavyAlt: 'Numpad2',
  blockAlt: 'Numpad3',
}

let cpuMode = true
let paused = false
let camera = 0
const DIFFICULTY_ORDER = ['easy', 'normal', 'hard']
let difficultyIndex = 1

/**
 * 把键盘状态读成一帧输入。
 * @param keys - 按键映射。
 * @param useAlt - 是否把小键盘数字键作为备用键。
 * @returns 输入对象。
 */
function readInput(keys, useAlt = false) {
  const pressed = (code) => input.wasPressed(code)
  return {
    left: input.isDown(keys.left),
    right: input.isDown(keys.right),
    jump: pressed(keys.jump),
    light: pressed(keys.light) || (useAlt && pressed(keys.lightAlt)),
    heavy: pressed(keys.heavy) || (useAlt && pressed(keys.heavyAlt)),
    block: input.isDown(keys.block) || (useAlt && input.isDown(keys.blockAlt)),
  }
}

/** 处理全局按键。 */
function handleGlobalKeys() {
  if (input.wasPressed('KeyM')) {
    const muted = audio.toggleMute()
    setStatus(muted ? 'SOUND OFF' : 'SOUND ON')
  }
  if (input.wasPressed('KeyV')) {
    cpuMode = !cpuMode
    setStatus(cpuMode ? 'P2 IS CPU' : 'P2 IS HUMAN')
  }
  if (input.wasPressed('KeyP')) {
    paused = !paused
    setStatus(paused ? 'PAUSED' : 'RESUMED')
  }
  if (input.wasPressed('KeyR')) {
    match.reset()
    setStatus('NEW MATCH')
  }
  if (input.wasPressed('KeyC')) {
    difficultyIndex = (difficultyIndex + 1) % DIFFICULTY_ORDER.length
    const label = ai2.setDifficulty(DIFFICULTY_ORDER[difficultyIndex])
    setStatus(`CPU ${label}`)
  }
}

/**
 * 更新页面上的状态提示。
 * @param text - 提示文本。
 */
function setStatus(text) {
  const status = document.querySelector('#status')
  if (status !== null) status.textContent = text
}

/** 按窗口尺寸计算整数倍缩放，保证像素不失真。 */
function resize() {
  const widthScale = (window.innerWidth - 32) / SCENE_WIDTH
  const heightScale = (window.innerHeight - 190) / SCENE_HEIGHT
  const scale = Math.max(1, Math.floor(Math.min(widthScale, heightScale)))
  canvas.style.width = `${SCENE_WIDTH * scale}px`
  canvas.style.height = `${SCENE_HEIGHT * scale}px`
}

window.addEventListener('resize', resize)
resize()

let stepsThisFrame = 0

startLoop(() => {
  stepsThisFrame += 1
  if (!paused) {
    const input1 = readInput(PLAYER_ONE_KEYS)
    const input2 = cpuMode ? ai2.update(fighter2, fighter1) : readInput(PLAYER_TWO_KEYS, true)
    match.update(input1, input2)
    const mid = (fighter1.x + fighter2.x) / 2
    camera = Math.max(-70, Math.min(70, (mid - SCENE_WIDTH / 2) * 0.4))
  }
}, () => {
  // 全局按键在每个浏览器帧只处理一次，避免一帧内补多个逻辑步时开关被切换两次。
  handleGlobalKeys()
  const wins = match.wins
  renderWorld(framebuffer, {
    scene,
    fighters: [fighter1, fighter2],
    fx,
    camera,
    offset: fx.shakeOffset(),
    hud: {
      left: {
        name: 'AZURE',
        hp: fighter1.hp,
        maxHp: FIGHTER_CONFIG.maxHp,
        energy: fighter1.energy,
        maxEnergy: FIGHTER_CONFIG.maxEnergy,
        wins: wins[0],
        tag: 'P1',
      },
      right: {
        name: 'EMBER',
        hp: fighter2.hp,
        maxHp: FIGHTER_CONFIG.maxHp,
        energy: fighter2.energy,
        maxEnergy: FIGHTER_CONFIG.maxEnergy,
        wins: wins[1],
        tag: cpuMode ? 'CPU' : 'P2',
      },
      timeLeft: match.timeLeft,
      round: match.round,
      banner: match.banner,
      bannerSub: match.bannerSub,
    },
  })
  imageData.data.set(framebuffer.data)
  context.putImageData(imageData, 0, 0)
  // 只在本帧推进过逻辑时清空按键边沿，避免高刷新率下漏掉一次按键。
  if (stepsThisFrame > 0) {
    input.endFrame()
    stepsThisFrame = 0
  }
})

window.addEventListener('keydown', (event) => {
  if (event.code.startsWith('Arrow') || event.code === 'Space') event.preventDefault()
})
