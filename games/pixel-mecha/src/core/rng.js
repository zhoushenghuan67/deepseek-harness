/**
 * 确定性伪随机数发生器（mulberry32）。
 * 场景装饰、粒子等需要"每次运行一致"的随机时使用它，保证截图与回放可复现。
 */
export function createRng(seed = 1) {
  let state = seed >>> 0
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 在 [min, max] 之间取整数。 */
export function randomInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1))
}

/** 以概率 p 返回 true。 */
export function chance(rng, p) {
  return rng() < p
}

/** 从数组中随机取一个元素。 */
export function pick(rng, items) {
  return items[Math.floor(rng() * items.length) % items.length]
}
