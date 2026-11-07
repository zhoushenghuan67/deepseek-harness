/**
 * 战斗表现层：粒子、斩击弧、伤害飘字与屏幕震动。
 *
 * 全部为无状态更新的纯数据集合，由 match.js 在战斗事件里调用生成。
 */

/**
 * 创建特效容器。
 * @returns 特效对象，含更新、绘制与各类事件的生成函数。
 */
export function createFx() {
  const particles = []
  const slashes = []
  const popups = []
  let shake = 0
  let shakeSeed = 0

  /** 生成火花粒子。 */
  function spawnSparks(x, y, count, palette, spread = 1) {
    for (let index = 0; index < count; index += 1) {
      const angle = (index / count) * Math.PI * 2
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * 1.6 * spread,
        vy: Math.sin(angle) * 1.6 * spread - 0.4,
        life: 16 + (index % 5),
        color: index % 3 === 0 ? palette['6'] : index % 3 === 1 ? palette['5'] : palette['3'],
      })
    }
  }

  return {
    /** 命中时的火花与闪白。 */
    hit(x, y, palette, heavy) {
      spawnSparks(x, y, heavy ? 14 : 8, palette, heavy ? 1.4 : 1)
      shake = Math.max(shake, heavy ? 4 : 2)
      shakeSeed += 1
    },
    /** 格挡时的短促火花。 */
    block(x, y, palette) {
      spawnSparks(x, y, 5, palette, 0.6)
      shake = Math.max(shake, 1)
    },
    /** 出招斩击弧。 */
    slash(x, y, facing, palette, heavy) {
      slashes.push({ x, y, facing, life: heavy ? 9 : 6, maxLife: heavy ? 9 : 6, palette, heavy })
    },
    /** 伤害飘字。 */
    damage(x, y, value, palette, kind) {
      popups.push({ x, y, value, palette, kind, life: 40 })
    },
    /** 推进所有特效一帧。 */
    update() {
      for (let index = particles.length - 1; index >= 0; index -= 1) {
        const particle = particles[index]
        particle.x += particle.vx
        particle.y += particle.vy
        particle.vy += 0.12
        particle.life -= 1
        if (particle.life <= 0) particles.splice(index, 1)
      }
      for (let index = slashes.length - 1; index >= 0; index -= 1) {
        slashes[index].life -= 1
        if (slashes[index].life <= 0) slashes.splice(index, 1)
      }
      for (let index = popups.length - 1; index >= 0; index -= 1) {
        popups[index].y -= 0.45
        popups[index].life -= 1
        if (popups[index].life <= 0) popups.splice(index, 1)
      }
      if (shake > 0) shake -= 1
    },
    /**
     * 取得当前震屏偏移。
     * @returns 偏移量 {x, y}。
     */
    shakeOffset() {
      if (shake <= 0) return { x: 0, y: 0 }
      const phase = (shakeSeed + shake) * 1.7
      return {
        x: Math.round(Math.sin(phase) * shake),
        y: Math.round(Math.cos(phase * 1.3) * shake * 0.5),
      }
    },
    /** 清空全部特效。 */
    clear() {
      particles.length = 0
      slashes.length = 0
      popups.length = 0
      shake = 0
    },
    /**
     * 在像素缓冲上绘制全部特效。
     * @param fb - 像素缓冲。
     * @param font - 像素字模绘制接口。
     * @param offset - 额外位移，用于屏幕震动。
     */
    draw(fb, font, offset = { x: 0, y: 0 }) {
      for (const slash of slashes) {
        const palette = slash.palette
        const length = slash.heavy ? 34 : 24
        const height = slash.heavy ? 9 : 6
        const fade = slash.life / slash.maxLife
        const color = fade > 0.5 ? palette['6'] : palette['5']
        for (let row = 0; row < height; row += 1) {
          const taper = Math.floor((row / height) * length * 0.6)
          const span = Math.max(2, length - taper)
          const x = slash.facing > 0 ? slash.x + taper : slash.x - span - taper
          fb.fillRect(Math.round(x + offset.x), Math.round(slash.y - height / 2 + row + offset.y), span, 1, color)
        }
      }
      for (const particle of particles) {
        fb.fillRect(Math.round(particle.x + offset.x), Math.round(particle.y + offset.y), 1, 1, particle.color)
      }
      for (const popup of popups) {
        const color = popup.kind === 'block' ? '#9fe8ff' : popup.kind === 'break' ? '#ffd166' : '#ffd166'
        font.drawTextShadowed(fb, String(popup.value), Math.round(popup.x + offset.x), Math.round(popup.y + offset.y), color, '#140608', true)
      }
    },
  }
}
