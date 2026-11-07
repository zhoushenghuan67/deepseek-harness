/**
 * 场景图层生成：全部程序化绘制，种子固定，渲染结果可复现。
 *
 * 图层横向宽度是屏幕的两倍（640），平铺绘制以支持镜头漂移。
 * 天空是竖直渐变加夕阳，其余图层是独立的离屏像素缓冲。
 */
import { createFramebuffer } from '../core/framebuffer.js'
import { createRng, randomInt, chance } from '../core/rng.js'
import { SCENE } from './palette.js'

/** 竞技场宽高（内部像素）。 */
export const SCENE_WIDTH = 320
export const SCENE_HEIGHT = 180
/** 地面顶边，也是机甲站立线。 */
export const GROUND_Y = 152
/** 图层平铺宽度。 */
export const LAYER_WIDTH = 640

/**
 * 生成天空：6 段渐变 + 像素夕阳 + 稀疏星点。
 * @returns 颜色数组，长度等于场景高度。
 */
export function createSky() {
  const sky = new Array(SCENE_HEIGHT)
  const bands = SCENE.sky.length
  for (let y = 0; y < SCENE_HEIGHT; y += 1) {
    const band = Math.min(bands - 1, Math.floor((y / SCENE_HEIGHT) * bands))
    sky[y] = SCENE.sky[band]
  }
  return sky
}

/**
 * 生成远景山脊剪影。
 * @param rng - 确定性随机源。
 * @returns 离屏像素缓冲。
 */
function createRidge(rng) {
  const layer = createFramebuffer(LAYER_WIDTH, SCENE_HEIGHT)
  const heights = new Array(LAYER_WIDTH)
  let height = 26
  for (let x = 0; x < LAYER_WIDTH; x += 1) {
    height += randomInt(rng, -2, 2)
    height = Math.max(10, Math.min(48, height))
    heights[x] = height
  }
  for (let x = 0; x < LAYER_WIDTH; x += 1) {
    const top = GROUND_Y - 12 - heights[x]
    layer.fillRect(x, top, 1, GROUND_Y - 12 - top, SCENE.farRidge)
    layer.fillRect(x, top, 1, 1, SCENE.farRidgeTop)
  }
  return layer
}

/**
 * 生成中景工厂塔楼：塔身 + 天线 + 亮窗。
 * @param rng - 确定性随机源。
 * @returns 离屏像素缓冲。
 */
function createTowers(rng) {
  const layer = createFramebuffer(LAYER_WIDTH, SCENE_HEIGHT)
  let x = randomInt(rng, 6, 40)
  while (x < LAYER_WIDTH - 24) {
    const width = randomInt(rng, 14, 30)
    const height = randomInt(rng, 34, 72)
    const top = GROUND_Y - 8 - height
    layer.fillRect(x, top, width, height, SCENE.midTower)
    layer.fillRect(x, top, width, 1, SCENE.midTowerLight)
    if (chance(rng, 0.7)) {
      const antennaX = x + randomInt(rng, 2, width - 3)
      const antennaHeight = randomInt(rng, 4, 11)
      layer.fillRect(antennaX, top - antennaHeight, 1, antennaHeight, SCENE.midTower)
      layer.fillRect(antennaX, top - antennaHeight, 1, 1, SCENE.window)
    }
    for (let wy = top + 5; wy < GROUND_Y - 12; wy += 7) {
      for (let wx = x + 3; wx < x + width - 2; wx += 6) {
        if (chance(rng, 0.45)) layer.fillRect(wx, wy, 2, 3, SCENE.window)
      }
    }
    x += width + randomInt(rng, 6, 22)
  }
  return layer
}

/**
 * 生成近景桁架：横梁 + 立柱。
 * @param rng - 确定性随机源。
 * @returns 离屏像素缓冲。
 */
function createGirders(rng) {
  const layer = createFramebuffer(LAYER_WIDTH, SCENE_HEIGHT)
  const beamTop = GROUND_Y - 46
  layer.fillRect(0, beamTop, LAYER_WIDTH, 4, SCENE.girder)
  layer.fillRect(0, beamTop, LAYER_WIDTH, 1, SCENE.girderLight)
  const lowerTop = GROUND_Y - 22
  layer.fillRect(0, lowerTop, LAYER_WIDTH, 3, SCENE.girder)
  layer.fillRect(0, lowerTop, LAYER_WIDTH, 1, SCENE.girderLight)

  let x = randomInt(rng, 4, 18)
  while (x < LAYER_WIDTH) {
    const width = randomInt(rng, 4, 7)
    layer.fillRect(x, beamTop, width, GROUND_Y - 8 - beamTop, SCENE.girder)
    layer.fillRect(x, beamTop, 1, GROUND_Y - 8 - beamTop, SCENE.girderLight)
    x += width + randomInt(rng, 18, 34)
  }
  return layer
}

/**
 * 生成地面：平台、分割线、边缘高光与碎石。
 * @param rng - 确定性随机源。
 * @returns 离屏像素缓冲。
 */
function createGround(rng) {
  const layer = createFramebuffer(LAYER_WIDTH, SCENE_HEIGHT)
  const top = GROUND_Y
  layer.fillRect(0, top, LAYER_WIDTH, SCENE_HEIGHT - top, SCENE.ground)
  layer.fillRect(0, top, LAYER_WIDTH, 2, SCENE.groundTop)
  for (let x = 0; x < LAYER_WIDTH; x += 16) {
    layer.fillRect(x, top + 3, 1, SCENE_HEIGHT - top - 3, SCENE.grid)
  }
  for (let x = 4; x < LAYER_WIDTH; x += 13) {
    layer.fillRect(x, top + 8, 1, 6, SCENE.grid)
  }
  for (let index = 0; index < 26; index += 1) {
    const x = randomInt(rng, 0, LAYER_WIDTH - 3)
    const y = randomInt(rng, top + 4, SCENE_HEIGHT - 2)
    layer.fillRect(x, y, 2, 1, SCENE.debris)
  }
  return layer
}

/**
 * 创建整套场景。
 * @param seed - 随机种子，相同种子得到相同场景。
 * @returns 天空颜色数组、夕阳叠加层与各视差图层。
 */
export function createScene(seed = 20261107) {
  const rng = createRng(seed)
  const skyOverlay = createFramebuffer(SCENE_WIDTH, SCENE_HEIGHT)
  drawSkyDetails(skyOverlay, rng)
  return {
    sky: createSky(),
    skyOverlay,
    layers: [
      { image: createRidge(rng), parallax: 0.15 },
      { image: createTowers(rng), parallax: 0.35 },
      { image: createGirders(rng), parallax: 0.6 },
      { image: createGround(rng), parallax: 1, locked: true },
    ],
  }
}

/**
 * 在天空上叠加夕阳与星点。
 * @param fb - 目标像素缓冲。
 * @param rng - 确定性随机源。
 */
export function drawSkyDetails(fb, rng) {
  const sunX = 236
  const sunY = 58
  const radius = 20
  for (let y = -radius; y <= radius; y += 1) {
    const span = Math.floor(Math.sqrt(radius * radius - y * y))
    fb.fillRect(sunX - span, sunY + y, span * 2, 1, SCENE.sun)
  }
  for (let y = -radius + 6; y <= radius - 6; y += 1) {
    const span = Math.floor(Math.sqrt((radius - 6) * (radius - 6) - y * y))
    fb.fillRect(sunX - span, sunY + y, span * 2, 1, SCENE.sunCore)
  }
  for (let index = 0; index < 46; index += 1) {
    const x = randomInt(rng, 0, SCENE_WIDTH - 1)
    const y = randomInt(rng, 2, 62)
    fb.fillRect(x, y, 1, 1, SCENE.star)
  }
}
