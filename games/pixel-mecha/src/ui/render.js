/**
 * 渲染管线：把世界状态画进 320×180 的像素缓冲。
 *
 * 顺序固定为：天空 → 夕阳 → 视差图层 → 地面 → 机甲 → 特效 → HUD。
 * 本模块不依赖 DOM，浏览器与无头出图脚本共用。
 */
import { SCENE_HEIGHT, SCENE_WIDTH } from '../art/scene.js'
import { drawHud } from './hud.js'
import { drawMecha } from './mecha.js'
import { drawText, drawTextShadowed } from './font.js'

/**
 * 平铺绘制一张宽于屏幕的图层。
 * @param fb - 像素缓冲。
 * @param image - 离屏像素缓冲。
 * @param offset - 横向偏移。
 */
function drawTiled(fb, image, offset) {
  fb.blitSurface(image, offset, 0)
  fb.blitSurface(image, offset + image.width, 0)
  fb.blitSurface(image, offset - image.width, 0)
}

/**
 * 渲染一帧世界。
 * @param fb - 目标像素缓冲。
 * @param world - 世界数据：scene、fighters、fx、camera、hud、offset。
 */
export function renderWorld(fb, world) {
  const { scene, fighters, fx, hud, camera, offset } = world
  const shakeX = offset?.x ?? 0
  const shakeY = offset?.y ?? 0

  for (let y = 0; y < SCENE_HEIGHT; y += 1) {
    fb.fillRect(0, y, SCENE_WIDTH, 1, scene.sky[y])
  }
  fb.blitSurface(scene.skyOverlay, 0, 0)

  for (const layer of scene.layers) {
    const scroll = layer.locked ? 0 : Math.round(-camera * layer.parallax)
    drawTiled(fb, layer.image, scroll + shakeX)
  }

  for (const fighter of fighters) {
    drawMecha(fb, fighter, fighter.palette, { x: shakeX, y: shakeY })
  }

  fx.draw(fb, { drawText, drawTextShadowed }, { x: shakeX, y: shakeY })
  drawHud(fb, hud)
}
