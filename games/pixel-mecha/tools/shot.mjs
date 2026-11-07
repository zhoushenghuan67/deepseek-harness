/**
 * 无头出图：跑一段脚本化的对局，把关键帧渲染成 PNG，用于核对画面。
 *
 * 用法：node games/pixel-mecha/tools/shot.mjs [输出目录]
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { MECHA_PALETTES } from '../src/art/palette.js'
import { GROUND_Y, SCENE_HEIGHT, SCENE_WIDTH, createScene } from '../src/art/scene.js'
import { validateParts, PARTS } from '../src/art/sprites.js'
import { createRng } from '../src/core/rng.js'
import { createFramebuffer } from '../src/core/framebuffer.js'
import { createAi } from '../src/game/ai.js'
import { createFx } from '../src/game/fx.js'
import { createFighter, FIGHTER_CONFIG } from '../src/game/fighter.js'
import { createMatch } from '../src/game/match.js'
import { renderWorld } from '../src/ui/render.js'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(process.argv[2] ?? resolve(here, '..', 'shots'))
/** 截图放大倍数，便于肉眼核对像素。 */
const SCALE = 3

const problems = validateParts(PARTS)
if (problems.length > 0) {
  console.error(`精灵表校验失败：\n${problems.join('\n')}`)
  process.exit(1)
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let index = 0; index < 256; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    }
    table[index] = value >>> 0
  }
  return table
})()

/**
 * 计算 CRC32 校验值。
 * @param buffer - 待校验字节。
 * @returns 校验值。
 */
function crc32(buffer) {
  let crc = 0xffffffff
  for (let index = 0; index < buffer.length; index += 1) {
    crc = CRC_TABLE[(crc ^ buffer[index]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

/**
 * 组装一个 PNG 数据块。
 * @param type - 块类型。
 * @param data - 块内容。
 * @returns 完整块字节。
 */
function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([length, body, crc])
}

/**
 * 把 RGBA 像素编码为 PNG。
 * @param width - 宽。
 * @param height - 高。
 * @param rgba - RGBA 字节数组。
 * @param scale - 整数倍放大系数。
 * @returns PNG 文件字节。
 */
function encodePng(width, height, rgba, scale = 1) {
  const outWidth = width * scale
  const outHeight = height * scale
  const scaled = new Uint8ClampedArray(outWidth * outHeight * 4)
  for (let y = 0; y < outHeight; y += 1) {
    const sourceRow = Math.floor(y / scale)
    for (let x = 0; x < outWidth; x += 1) {
      const source = (sourceRow * width + Math.floor(x / scale)) * 4
      const target = (y * outWidth + x) * 4
      scaled[target] = rgba[source]
      scaled[target + 1] = rgba[source + 1]
      scaled[target + 2] = rgba[source + 2]
      scaled[target + 3] = rgba[source + 3]
    }
  }
  const raw = Buffer.alloc(outHeight * (outWidth * 4 + 1))
  for (let y = 0; y < outHeight; y += 1) {
    const target = y * (outWidth * 4 + 1)
    raw[target] = 0
    for (let index = 0; index < outWidth * 4; index += 1) {
      raw[target + 1 + index] = scaled[y * outWidth * 4 + index]
    }
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(outWidth, 0)
  header.writeUInt32BE(outHeight, 4)
  header[8] = 8
  header[9] = 6
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const framebuffer = createFramebuffer(SCENE_WIDTH, SCENE_HEIGHT)
const scene = createScene()
const fx = createFx()
const rng = createRng(4242)
const fighter1 = createFighter({ id: 1, name: 'AZURE', palette: MECHA_PALETTES.azure, x: 96, facing: 1, groundY: GROUND_Y })
const fighter2 = createFighter({ id: 2, name: 'EMBER', palette: MECHA_PALETTES.ember, x: 224, facing: -1, groundY: GROUND_Y })
const ai2 = createAi('normal', rng)
const match = createMatch({ fighter1, fighter2, ai2, fx, audio: { play() {}, toggleMute() { return false }, isMuted() { return false } } })
match.reset()

const neutral = { left: false, right: false, jump: false, light: false, heavy: false, block: false }
const shots = []
let frame = 0

mkdirSync(outDir, { recursive: true })

/**
 * 推进一帧并按需截图。
 * @param input1 - 玩家 1 输入。
 * @param input2 - 玩家 2 输入。
 * @param shotName - 本帧要保存的截图名，null 表示不保存。
 */
function step(input1, input2, shotName) {
  match.update(input1, input2)
  const mid = (fighter1.x + fighter2.x) / 2
  const camera = Math.max(-70, Math.min(70, (mid - SCENE_WIDTH / 2) * 0.4))
  if (shotName !== null) {
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
          tag: 'CPU',
        },
        timeLeft: match.timeLeft,
        round: match.round,
        banner: match.banner,
        bannerSub: match.bannerSub,
      },
    })
    const png = encodePng(SCENE_WIDTH, SCENE_HEIGHT, framebuffer.data, SCALE)
    writeFileSync(resolve(outDir, `${shotName}.png`), png)
    shots.push(shotName)
    console.log(
      `${shotName}: P1 hp=${fighter1.hp} en=${Math.round(fighter1.energy)} state=${fighter1.state} x=${Math.round(fighter1.x)} | P2 hp=${fighter2.hp} en=${Math.round(fighter2.energy)} state=${fighter2.state} x=${Math.round(fighter2.x)} blocking=${fighter2.blocking}`,
    )
  }
  frame += 1
}

// 开场横幅
step(neutral, neutral, '01-round-banner')

/**
 * 推进到与对手相隔指定距离。
 * @param distance - 目标间距。
 */
function approach(distance) {
  let guard = 0
  while (fighter2.x - fighter1.x > distance && guard < 400) {
    step({ ...neutral, right: true }, neutral, null)
    guard += 1
  }
}

// 接近后出轻斩
approach(44)
step({ ...neutral, light: true }, neutral, null)
for (let index = 0; index < 7; index += 1) step(neutral, neutral, null)
step(neutral, neutral, '02-light-hit')
for (let index = 0; index < 30; index += 1) step(neutral, neutral, null)

// 对手防御，玩家 1 再出一记轻斩
approach(40)
step(neutral, { ...neutral, block: true }, null)
for (let index = 0; index < 6; index += 1) step(neutral, { ...neutral, block: true }, null)
step({ ...neutral, light: true }, { ...neutral, block: true }, null)
for (let index = 0; index < 8; index += 1) step(neutral, { ...neutral, block: true }, null)
step(neutral, { ...neutral, block: true }, '03-block')
for (let index = 0; index < 30; index += 1) step(neutral, neutral, null)

// 重斩命中
approach(44)
step({ ...neutral, heavy: true }, neutral, null)
for (let index = 0; index < 15; index += 1) step(neutral, neutral, null)
step(neutral, neutral, '04-heavy-hit')
for (let index = 0; index < 20; index += 1) step(neutral, neutral, null)

// KO
fighter2.hp = 0
step(neutral, neutral, null)
step(neutral, neutral, '05-ko')
for (let index = 0; index < 121; index += 1) step(neutral, neutral, null)
step(neutral, neutral, '06-round-win')

console.log(`已导出 ${shots.length} 张截图到 ${outDir}：${shots.join(', ')}`)
