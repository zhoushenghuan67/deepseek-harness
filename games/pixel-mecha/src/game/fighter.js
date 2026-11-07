/**
 * 机甲战斗体：状态机、物理、攻击判定与受击结算。
 *
 * 坐标系：x 为脚底中心的横坐标（像素），y 为脚底纵坐标（像素，向上为负），
 * 站立时 y 恒等于地面高度。facing 为 1（右）或 -1（左）。
 */

export const FIGHTER_CONFIG = {
  maxHp: 100,
  maxEnergy: 100,
  moveSpeed: 1.6,
  jumpVelocity: -8.2,
  gravity: 0.55,
  arenaLeft: 28,
  arenaRight: 292,
  blockDamageRatio: 0.2,
  blockEnergyCost: 8,
  blockBreakStun: 24,
  blockEnergyDrain: 0.6,
  energyRegen: 0.35,
  knockbackDecay: 0.86,
  bodyWidth: 24,
  bodyHeight: 51,
}

/** 招式表：帧数单位为 60Hz 逻辑帧。 */
export const ATTACKS = {
  light: {
    name: 'light',
    startup: 5,
    active: 4,
    recovery: 11,
    damage: 7,
    range: 30,
    hitstun: 12,
    knockback: 2.4,
    energyCost: 0,
    blockMultiplier: 1.6,
    pose: 'light',
  },
  heavy: {
    name: 'heavy',
    startup: 13,
    active: 5,
    recovery: 22,
    damage: 16,
    range: 38,
    hitstun: 20,
    knockback: 5.2,
    energyCost: 28,
    blockMultiplier: 2.4,
    pose: 'heavy',
  },
}

/**
 * 创建一台机甲。
 * @param options - 初始位置、朝向、配色名与显示名。
 * @returns 机甲状态对象。
 */
export function createFighter(options) {
  return {
    id: options.id,
    name: options.name,
    palette: options.palette,
    x: options.x,
    y: options.groundY,
    vx: 0,
    vy: 0,
    facing: options.facing,
    hp: FIGHTER_CONFIG.maxHp,
    energy: FIGHTER_CONFIG.maxEnergy,
    state: 'idle',
    stateTimer: 0,
    grounded: true,
    attack: null,
    attackFrame: 0,
    hasHit: false,
    hitstun: 0,
    blocking: false,
    blockBroken: false,
    flashTimer: 0,
    pose: 'idle',
    poseTimer: 0,
    poseFrame: 0,
  }
}

/**
 * 重置一台机甲到初始状态（换回合时调用）。
 * @param fighter - 机甲状态对象。
 * @param options - 新的位置与朝向。
 */
export function resetFighter(fighter, options) {
  fighter.x = options.x
  fighter.y = options.groundY
  fighter.vx = 0
  fighter.vy = 0
  fighter.facing = options.facing
  fighter.hp = FIGHTER_CONFIG.maxHp
  fighter.energy = FIGHTER_CONFIG.maxEnergy
  fighter.state = 'idle'
  fighter.stateTimer = 0
  fighter.grounded = true
  fighter.attack = null
  fighter.attackFrame = 0
  fighter.hasHit = false
  fighter.hitstun = 0
  fighter.blocking = false
  fighter.blockBroken = false
  fighter.flashTimer = 0
  fighter.pose = 'idle'
  fighter.poseTimer = 0
  fighter.poseFrame = 0
}

/**
 * 当前攻击的判定框，攻击不在生效帧时返回 null。
 * @param fighter - 机甲状态对象。
 * @returns 判定框 {x, y, width, height} 或 null。
 */
export function getHitbox(fighter) {
  if (fighter.attack === null) return null
  const spec = ATTACKS[fighter.attack]
  if (fighter.attackFrame < spec.startup || fighter.attackFrame >= spec.startup + spec.active) return null
  const forward = fighter.facing
  const x = forward > 0 ? fighter.x + 6 : fighter.x - 6 - spec.range
  return { x, y: fighter.y - FIGHTER_CONFIG.bodyHeight + 8, width: spec.range, height: 20 }
}

/**
 * 机甲的躯干判定框。
 * @param fighter - 机甲状态对象。
 * @returns 判定框 {x, y, width, height}。
 */
export function getBodyBox(fighter) {
  return {
    x: fighter.x - FIGHTER_CONFIG.bodyWidth / 2,
    y: fighter.y - FIGHTER_CONFIG.bodyHeight,
    width: FIGHTER_CONFIG.bodyWidth,
    height: FIGHTER_CONFIG.bodyHeight,
  }
}

/**
 * 推进一台机甲一帧。
 * @param fighter - 机甲状态对象。
 * @param input - 本帧输入：left/right/jump/light/heavy/block。
 * @param world - 世界参数：groundY、arenaLeft、arenaRight。
 * @returns 本帧产生的事件列表。
 */
export function updateFighter(fighter, input, world) {
  const events = []
  const config = FIGHTER_CONFIG

  if (fighter.state === 'ko' || fighter.state === 'win') {
    fighter.poseTimer += 1
    advancePose(fighter)
    return events
  }

  if (fighter.hitstun > 0) {
    fighter.hitstun -= 1
    fighter.state = 'hurt'
    fighter.pose = 'hurt'
  }

  const busy = fighter.state === 'attack' || fighter.hitstun > 0

  // 攻击推进
  if (fighter.attack !== null) {
    fighter.attackFrame += 1
    const spec = ATTACKS[fighter.attack]
    if (fighter.attackFrame === spec.startup) events.push({ type: 'swing', fighter, attack: spec.name })
    if (fighter.attackFrame >= spec.startup + spec.active + spec.recovery) {
      fighter.attack = null
      fighter.attackFrame = 0
      fighter.state = 'idle'
    }
  }

  // 输入驱动
  if (!busy) {
    if (input.jump && fighter.grounded) {
      fighter.vy = config.jumpVelocity
      fighter.grounded = false
      fighter.state = 'jump'
      events.push({ type: 'jump', fighter })
    } else if (input.light) {
      startAttack(fighter, 'light')
    } else if (input.heavy && fighter.energy >= ATTACKS.heavy.energyCost) {
      startAttack(fighter, 'heavy')
    } else {
      let direction = 0
      if (input.left) direction -= 1
      if (input.right) direction += 1
      if (direction !== 0 && fighter.grounded) {
        fighter.vx = direction * config.moveSpeed
        fighter.facing = direction > 0 ? 1 : -1
        fighter.state = 'run'
      } else if (fighter.grounded) {
        fighter.vx = 0
        if (fighter.state !== 'attack') fighter.state = 'idle'
      }
      fighter.blocking = input.block && fighter.grounded
      if (fighter.blocking) fighter.state = 'block'
      else if (!fighter.attack && fighter.grounded && fighter.state !== 'run') fighter.state = 'idle'
    }
  } else if (fighter.state === 'attack') {
    fighter.vx = 0
  }

  // 物理
  if (!fighter.grounded) {
    fighter.vy += config.gravity
    fighter.y += fighter.vy
    if (fighter.y >= world.groundY) {
      fighter.y = world.groundY
      fighter.vy = 0
      fighter.grounded = true
      if (fighter.state === 'jump' || fighter.state === 'fall') fighter.state = 'idle'
    }
  }
  if (fighter.state === 'attack') {
    fighter.x += fighter.facing * 0.6
  } else {
    fighter.x += fighter.vx
  }
  fighter.x = Math.max(world.arenaLeft, Math.min(world.arenaRight, fighter.x))

  // 能量
  if (fighter.blocking) {
    fighter.energy = Math.max(0, fighter.energy - config.blockEnergyDrain)
  } else if (fighter.attack === null && fighter.hitstun === 0) {
    fighter.energy = Math.min(config.maxEnergy, fighter.energy + config.energyRegen)
  }

  // 姿势
  fighter.poseTimer += 1
  if (fighter.state === 'attack') {
    fighter.pose = ATTACKS[fighter.attack].pose
    fighter.poseFrame = attackPoseFrame(ATTACKS[fighter.attack], fighter.attackFrame)
  } else if (fighter.hitstun > 0) {
    fighter.pose = 'hurt'
  } else if (fighter.blocking) {
    fighter.pose = 'block'
  } else if (!fighter.grounded) {
    fighter.pose = fighter.vy < 0 ? 'jump' : 'fall'
  } else if (fighter.state === 'run') {
    fighter.pose = 'run'
  } else {
    fighter.pose = 'idle'
  }
  if (fighter.state !== 'attack') advancePose(fighter)

  if (fighter.flashTimer > 0) fighter.flashTimer -= 1
  return events
}

/**
 * 启动一次攻击。
 * @param fighter - 机甲状态对象。
 * @param name - 招式名，取自 ATTACKS。
 */
function startAttack(fighter, name) {
  const spec = ATTACKS[name]
  fighter.attack = name
  fighter.attackFrame = 0
  fighter.hasHit = false
  fighter.state = 'attack'
  fighter.blocking = false
  fighter.energy = Math.max(0, fighter.energy - spec.energyCost)
}

/**
 * 推进姿势帧号。
 * @param fighter - 机甲状态对象。
 */
function advancePose(fighter) {
  const frameRate = fighter.pose === 'run' ? 6 : fighter.pose === 'idle' ? 24 : 10
  if (fighter.poseTimer >= frameRate) {
    fighter.poseTimer = 0
    fighter.poseFrame += 1
  }
}

/**
 * 由攻击帧号推出招式姿势帧：前摇蓄力、判定突进、后摇收势。
 * @param spec - 招式参数。
 * @param frame - 当前攻击帧号。
 * @returns 姿势帧号。
 */
function attackPoseFrame(spec, frame) {
  if (spec.name === 'light' && frame < spec.startup) return frame < 3 ? 0 : 1
  if (frame < spec.startup) return 0
  if (frame < spec.startup + spec.active) return 1
  return 2
}

/**
 * 对机甲造成伤害。
 * @param fighter - 受到伤害的机甲。
 * @param attacker - 出手的机甲。
 * @param spec - 招式参数。
 * @param events - 事件收集数组。
 * @returns 实际造成的伤害值。
 */
export function applyHit(fighter, attacker, spec, events) {
  const config = FIGHTER_CONFIG
  const damage = spec.damage

  if (fighter.blocking && !fighter.blockBroken) {
    if (fighter.energy >= config.blockEnergyCost) {
      const reduced = Math.max(1, Math.ceil(damage * config.blockDamageRatio))
      fighter.energy -= config.blockEnergyCost
      fighter.hp = Math.max(0, fighter.hp - reduced)
      events.push({ type: 'block', fighter, attacker, damage: reduced, x: fighter.x, y: fighter.y - 24 })
      if (fighter.hp === 0) {
        fighter.state = 'ko'
        fighter.pose = 'ko'
        fighter.vx = 0
      }
      return reduced
    }
    fighter.blockBroken = true
    fighter.hitstun = config.blockBreakStun
    fighter.state = 'hurt'
    fighter.pose = 'hurt'
    fighter.blocking = false
    events.push({ type: 'break', fighter, attacker, x: fighter.x, y: fighter.y - 24 })
  }

  fighter.hp = Math.max(0, fighter.hp - damage)
  fighter.hitstun = spec.hitstun
  fighter.state = 'hurt'
  fighter.pose = 'hurt'
  fighter.attack = null
  fighter.attackFrame = 0
  fighter.blocking = false
  fighter.blockBroken = false
  fighter.flashTimer = 4
  fighter.vx = attacker === null ? 0 : attacker.facing * spec.knockback
  events.push({ type: 'hit', fighter, attacker, damage, x: fighter.x, y: fighter.y - 22, heavy: spec.name === 'heavy' })
  if (fighter.hp === 0) {
    fighter.state = 'ko'
    fighter.pose = 'ko'
    fighter.vx = 0
  }
  return damage
}

/**
 * 逐步衰减击退速度。
 * @param fighter - 机甲状态对象。
 */
export function decayKnockback(fighter) {
  fighter.vx *= FIGHTER_CONFIG.knockbackDecay
  if (Math.abs(fighter.vx) < 0.05) fighter.vx = 0
}
