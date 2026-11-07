/**
 * HUD：血条、能量条、倒计时、回合胜场标记与横幅。
 */
import { drawTextShadowed, measureText } from './font.js'

const BAR_WIDTH = 118
const BAR_HEIGHT = 7
const ENERGY_HEIGHT = 3

/**
 * 绘制完整 HUD。
 * @param fb - 像素缓冲。
 * @param view - 视图数据：双方名称与血量、能量、倒计时、胜场、横幅。
 */
export function drawHud(fb, view) {
  drawFighterBar(fb, view.left, 6, false)
  drawFighterBar(fb, view.right, 6, true)

  const timeColor = view.timeLeft <= 10 ? '#ff8a3c' : '#ffe9b0'
  drawTextShadowed(fb, String(view.timeLeft).padStart(2, '0'), 160, 5, timeColor, '#140608', true)
  drawTextShadowed(fb, `ROUND ${view.round}`, 160, 13, '#c9d6ff', '#140608', true)

  if (view.banner !== '') {
    const y = 72
    const subWidth = view.bannerSub === '' ? 0 : measureText(view.bannerSub)
    const boxWidth = Math.max(measureText(view.banner), subWidth) + 24
    const boxLeft = Math.round(160 - boxWidth / 2)
    fb.fillRect(boxLeft, y - 7, boxWidth, view.bannerSub === '' ? 19 : 30, '#0d0720')
    fb.fillRect(boxLeft, y - 7, boxWidth, 1, '#41c7f5')
    fb.fillRect(boxLeft, y - 7 + (view.bannerSub === '' ? 18 : 29), boxWidth, 1, '#41c7f5')
    drawTextShadowed(fb, view.banner, 160, y, '#ffe9b0', '#140608', true)
    if (view.bannerSub !== '') {
      drawTextShadowed(fb, view.bannerSub, 160, y + 11, '#c9d6ff', '#140608', true)
    }
  }
}

/**
 * 绘制一侧机甲的血条与能量条。
 * @param fb - 像素缓冲。
 * @param info - {name, hp, maxHp, energy, maxEnergy, wins, tag}。
 * @param y - 顶部纵坐标。
 * @param rightAligned - 为 true 时靠右对齐。
 */
function drawFighterBar(fb, info, y, rightAligned) {
  const left = rightAligned ? 320 - 6 - BAR_WIDTH : 6
  fb.fillRect(left - 1, y - 1, BAR_WIDTH + 2, BAR_HEIGHT + 2, '#140608')
  fb.fillRect(left, y, BAR_WIDTH, BAR_HEIGHT, '#2b1c3a')

  const ratio = Math.max(0, Math.min(1, info.hp / info.maxHp))
  const fill = Math.round(BAR_WIDTH * ratio)
  const barColor = ratio > 0.55 ? '#41c7f5' : ratio > 0.25 ? '#ffb45e' : '#ff5a4d'
  fb.fillRect(left, y, fill, BAR_HEIGHT, barColor)
  fb.fillRect(left, y, fill, 1, '#ffffff')

  const energyLeft = left
  const energyTop = y + BAR_HEIGHT + 2
  fb.fillRect(energyLeft - 1, energyTop - 1, BAR_WIDTH + 2, ENERGY_HEIGHT + 2, '#140608')
  fb.fillRect(energyLeft, energyTop, BAR_WIDTH, ENERGY_HEIGHT, '#2b1c3a')
  const energyRatio = Math.max(0, Math.min(1, info.energy / info.maxEnergy))
  fb.fillRect(energyLeft, energyTop, Math.round(BAR_WIDTH * energyRatio), ENERGY_HEIGHT, '#ffd166')

  const labelY = y + BAR_HEIGHT + 7
  const nameWidth = measureText(info.name)
  const nameX = rightAligned ? left + BAR_WIDTH - nameWidth : left
  drawTextShadowed(fb, info.name, nameX, labelY, '#dff4ff', '#140608', false)
  if (info.tag !== '') {
    const tagX = rightAligned ? nameX - measureText(info.tag) - 8 : nameX + nameWidth + 8
    drawTextShadowed(fb, info.tag, tagX, labelY, '#ffb45e', '#140608', false)
  }

  for (let index = 0; index < info.wins; index += 1) {
    const markerX = rightAligned ? left + 6 + index * 8 : left + BAR_WIDTH - 6 - index * 8
    drawDiamond(fb, markerX, labelY + 2, '#ffe9b0')
  }
}

/**
 * 画一个 5 像素宽的菱形（回合胜场标记）。
 * @param fb - 像素缓冲。
 * @param x - 中心横坐标。
 * @param y - 中心纵坐标。
 * @param color - 颜色。
 */
function drawDiamond(fb, x, y, color) {
  fb.fillRect(x - 1, y - 2, 3, 1, color)
  fb.fillRect(x - 2, y - 1, 5, 3, color)
  fb.fillRect(x - 1, y + 2, 3, 1, color)
}
