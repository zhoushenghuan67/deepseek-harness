/**
 * 机甲绘制：把部件像素图按当前姿势拼装成一台机甲。
 *
 * 姿势表给出各部件的绝对位置，面朝左时整台机甲水平镜像。
 */
import { BASE_POSE, DRAW_ORDER, PARTS, PART_ART, POSES } from '../art/sprites.js'

/**
 * 取得当前姿势下每个部件的最终位置。
 * @param pose - 姿势名，对应 POSES 的键。
 * @param poseFrame - 姿势帧号。
 * @returns 部件名到 [x, y] 的映射。
 */
export function resolvePose(pose, poseFrame) {
  const frames = POSES[pose] ?? POSES.idle
  const frame = frames[poseFrame % frames.length]
  const resolved = { ...BASE_POSE }
  for (const [part, position] of Object.entries(frame)) {
    resolved[part] = position
  }
  return resolved
}

/**
 * 绘制一台机甲。
 * @param fb - 像素缓冲。
 * @param fighter - 机甲状态对象。
 * @param palette - 调色板。
 * @param offset - 额外位移，用于屏幕震动。
 */
export function drawMecha(fb, fighter, palette, offset = { x: 0, y: 0 }) {
  const offsets = resolvePose(fighter.pose, fighter.poseFrame)
  const flashing = fighter.flashTimer > 0
  const colors = flashing ? flashPalette(palette) : palette

  for (const part of DRAW_ORDER) {
    const rows = PARTS[PART_ART[part]]
    if (rows === undefined) continue
    const partOffset = offsets[part] ?? [0, 0]
    const width = rows[0].length
    const x = fighter.facing > 0 ? fighter.x + partOffset[0] : fighter.x - partOffset[0] - width
    fb.blit(rows, colors, Math.round(x + offset.x), Math.round(fighter.y + partOffset[1] + offset.y), fighter.facing < 0)
  }
}

/**
 * 生成全体白色的闪白调色板。
 * @param palette - 原调色板。
 * @returns 闪白调色板。
 */
function flashPalette(palette) {
  const flash = {}
  for (const [key, color] of Object.entries(palette)) {
    flash[key] = color === null ? null : '#ffffff'
  }
  return flash
}
