/**
 * CPU 对手：观察—决策—执行三段式。
 *
 * 每个决策间隔读取对手状态，决定本区间的意图，并按难度概率漏招或犹豫。
 */

export const DIFFICULTIES = {
  easy: { label: 'EASY', interval: 18, attackCooldown: 52, heavyChance: 0.15, blockChance: 0.25, mistake: 0.3 },
  normal: { label: 'NORMAL', interval: 13, attackCooldown: 38, heavyChance: 0.3, blockChance: 0.45, mistake: 0.15 },
  hard: { label: 'HARD', interval: 8, attackCooldown: 26, heavyChance: 0.45, blockChance: 0.65, mistake: 0.05 },
}

const EMPTY_INPUT = { left: false, right: false, jump: false, light: false, heavy: false, block: false }

/**
 * 创建一个 CPU 控制器。
 * @param difficulty - DIFFICULTIES 中的难度键。
 * @param rng - 确定性随机源。
 * @returns 控制器对象，含 update 与 reset。
 */
export function createAi(difficulty, rng) {
  let level = DIFFICULTIES[difficulty] ?? DIFFICULTIES.normal
  let timer = 0
  let cooldown = 0
  let intent = { move: 0, action: 'none', timer: 0 }

  function reset() {
    timer = 0
    cooldown = 0
    intent = { move: 0, action: 'none', timer: 0 }
  }

  /**
   * 生成一帧 CPU 输入。
   * @param self - CPU 操控的机甲。
   * @param opponent - 对手机甲。
   * @returns 输入对象。
   */
  function update(self, opponent) {
    const input = { ...EMPTY_INPUT }
    const distance = Math.abs(opponent.x - self.x)
    const direction = opponent.x > self.x ? 1 : -1
    const lowHealth = self.hp <= 30

    timer += 1
    if (cooldown > 0) cooldown -= 1
    if (timer >= level.interval) {
      timer = 0
      intent = decide(self, opponent, distance, direction, lowHealth)
      if (intent.action === 'light' || intent.action === 'heavy') cooldown = level.attackCooldown
    }

    if (intent.timer > 0) {
      intent.timer -= 1
    } else {
      intent.action = 'none'
    }

    if (intent.move !== 0) {
      if (intent.move > 0) input.right = true
      else input.left = true
    }

    switch (intent.action) {
      case 'light':
        input.light = true
        break
      case 'heavy':
        input.heavy = true
        break
      case 'block':
        input.block = true
        break
      case 'jump':
        input.jump = true
        break
      default:
        break
    }

    if (intent.move === 0 && intent.action === 'none' && self.state === 'idle') {
      // 无意图时贴近对手，避免长时间对峙。
      if (distance > 26) {
        if (direction > 0) input.right = true
        else input.left = true
      }
    }

    return input
  }

  /**
   * 做一次决策。
   * @param self - 自身机甲。
   * @param opponent - 对手机甲。
   * @param distance - 双方距离。
   * @param direction - 朝向对手的方向。
   * @param lowHealth - 自身是否处于低血量。
   * @returns 意图对象。
   */
  function decide(self, opponent, distance, direction, lowHealth) {
    const opponentAttacking = opponent.attack !== null && opponent.attackFrame < 8
    const canBlock = self.energy >= 20

    if (opponentAttacking && distance < 44 && canBlock && rng() < level.blockChance) {
      return { move: 0, action: 'block', timer: 18 }
    }

    if (distance > 34) {
      if (lowHealth && rng() < 0.4) {
        return { move: -direction, action: 'none', timer: 12 }
      }
      return { move: direction, action: 'none', timer: 8 }
    }

    if (rng() < level.mistake) {
      return { move: 0, action: 'none', timer: 10 }
    }

    if (cooldown > 0) {
      return { move: direction, action: 'none', timer: 8 }
    }

    if (self.energy >= 28 && rng() < level.heavyChance) {
      return { move: direction, action: 'heavy', timer: 4 }
    }
    if (rng() < 0.7) {
      return { move: direction, action: 'light', timer: 4 }
    }
    return { move: direction, action: 'none', timer: 6 }
  }

  return {
    update,
    reset,
    /**
     * 切换难度。
     * @param difficulty - DIFFICULTIES 中的难度键。
     * @returns 新的难度名。
     */
    setDifficulty(difficulty) {
      level = DIFFICULTIES[difficulty] ?? DIFFICULTIES.normal
      reset()
      return level.label
    },
    /** 当前难度名。 */
    get level() {
      return level
    },
  }
}
