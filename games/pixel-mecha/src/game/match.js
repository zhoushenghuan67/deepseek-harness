/**
 * 对局流程：回合推进、计时、命中结算与胜负判定。
 */
import { ATTACKS, applyHit, decayKnockback, getBodyBox, getHitbox, resetFighter, updateFighter } from './fighter.js'
import { GROUND_Y } from '../art/scene.js'

export const MATCH_CONFIG = {
  roundFrames: 3600,
  introFrames: 96,
  koFrames: 120,
  resultFrames: 150,
  winsNeeded: 2,
  arenaLeft: 28,
  arenaRight: 292,
  minGap: 24,
}

/**
 * 创建对局。
 * @param options - 双方机甲、CPU 控制器、特效与音效。
 * @returns 对局对象，含 update 与只读状态。
 */
export function createMatch(options) {
  const { fighter1, fighter2, ai2, fx, audio } = options
  let state = 'intro'
  let stateTimer = MATCH_CONFIG.introFrames
  let roundIndex = 1
  let frame = 0
  let wins1 = 0
  let wins2 = 0
  let banner = ''
  let bannerSub = ''
  let roundWinner = null
  let matchWinner = null
  let lastHit = null

  /** 回到本回合开局。 */
  function startRound() {
    resetFighter(fighter1, { x: 96, facing: 1, groundY: GROUND_Y })
    resetFighter(fighter2, { x: 224, facing: -1, groundY: GROUND_Y })
    frame = 0
    state = 'intro'
    stateTimer = MATCH_CONFIG.introFrames
    banner = `ROUND ${roundIndex}`
    bannerSub = ''
    roundWinner = null
    lastHit = null
    ai2.reset()
    fx.clear()
    audio.play('round')
  }

  /** 结束本回合。 */
  function endRound(winner, reason) {
    roundWinner = winner
    if (winner === 1) wins1 += 1
    if (winner === 2) wins2 += 1
    state = 'result'
    stateTimer = MATCH_CONFIG.resultFrames
    banner = winner === 1 ? 'P1 WINS' : winner === 2 ? 'P2 WINS' : 'DRAW'
    bannerSub = reason
    audio.play(winner === null ? 'round' : 'ko')
    if (wins1 >= MATCH_CONFIG.winsNeeded || wins2 >= MATCH_CONFIG.winsNeeded) {
      matchWinner = wins1 > wins2 ? 1 : 2
    }
  }

  /**
   * 判断一次攻击是否命中对手。
   * @param attacker - 出手的机甲。
   * @param defender - 防守方机甲。
   */
  function resolveHit(attacker, defender) {
    if (attacker.hasHit) return
    const hitbox = getHitbox(attacker)
    if (hitbox === null) return
    const body = getBodyBox(defender)
    if (hitbox.x + hitbox.width <= body.x || hitbox.x >= body.x + body.width) return
    if (hitbox.y + hitbox.height <= body.y || hitbox.y >= body.y + body.height) return

    attacker.hasHit = true
    const spec = ATTACKS[attacker.attack]
    const events = []
    const damage = applyHit(defender, attacker, spec, events)
    const palette = defender.palette
    for (const event of events) {
      if (event.type === 'block') {
        fx.block(event.x, event.y, palette)
        fx.damage(event.x, event.y - 6, 'BLOCK', palette, 'block')
        audio.play('block')
      } else if (event.type === 'break') {
        fx.hit(event.x, event.y, palette, true)
        fx.damage(event.x, event.y - 6, 'BREAK', palette, 'break')
        audio.play('heavy')
      } else {
        fx.hit(event.x, event.y, palette, spec.name === 'heavy')
        fx.damage(event.x, event.y - 6, damage, palette, 'damage')
        audio.play(spec.name === 'heavy' ? 'heavy' : 'hit')
        lastHit = { attacker, defender, frame }
      }
    }
  }

  return {
    /**
     * 推进对局一帧。
     * @param input1 - 玩家 1 输入。
     * @param input2 - 玩家 2 输入（CPU 模式下由 AI 生成）。
     * @returns 本帧事件列表。
     */
    update(input1, input2) {
      const events = []
      stateTimer -= 1

      if (state === 'intro') {
        if (stateTimer === 40) banner = 'FIGHT'
        if (stateTimer <= 0) {
          state = 'fight'
          banner = ''
          bannerSub = ''
        }
        decayKnockback(fighter1)
        decayKnockback(fighter2)
        fx.update()
        return events
      }

      if (state === 'ko') {
        const loser = fighter1.hp === 0 ? fighter1 : fighter2
        const winner = loser === fighter1 ? fighter2 : fighter1
        loser.state = 'ko'
        loser.pose = 'ko'
        winner.state = 'win'
        winner.pose = 'win'
        winner.poseTimer += 1
        if (winner.poseTimer >= 10) {
          winner.poseTimer = 0
          winner.poseFrame += 1
        }
        fx.update()
        if (stateTimer <= 0) {
          endRound(winner.id, 'K.O.')
        }
        return events
      }

      if (state === 'result') {
        fx.update()
        if (stateTimer <= 0) {
          if (matchWinner !== null) {
            state = 'over'
            stateTimer = MATCH_CONFIG.resultFrames
            banner = matchWinner === 1 ? 'P1 TAKES THE SET' : 'P2 TAKES THE SET'
            bannerSub = 'PRESS R TO REMATCH'
            audio.play('win')
          } else {
            roundIndex += 1
            startRound()
          }
        }
        return events
      }

      if (state === 'over') {
        fx.update()
        return events
      }

      // 正式对战
      frame += 1
      const world = { groundY: GROUND_Y, arenaLeft: MATCH_CONFIG.arenaLeft, arenaRight: MATCH_CONFIG.arenaRight }
      const events1 = updateFighterWithWorld(fighter1, input1, world)
      const events2 = updateFighterWithWorld(fighter2, input2, world)
      events.push(...events1, ...events2)

      for (const event of events1) {
        if (event.type === 'swing') {
          fx.slash(fighter1.x + fighter1.facing * 12, fighter1.y - 22, fighter1.facing, fighter1.palette, event.attack === 'heavy')
          audio.play('swing')
        } else if (event.type === 'jump') {
          audio.play('jump')
        }
      }
      for (const event of events2) {
        if (event.type === 'swing') {
          fx.slash(fighter2.x + fighter2.facing * 12, fighter2.y - 22, fighter2.facing, fighter2.palette, event.attack === 'heavy')
          audio.play('swing')
        } else if (event.type === 'jump') {
          audio.play('jump')
        }
      }

      if (fighter1.attack !== null && fighter1.attackFrame === ATTACKS[fighter1.attack].startup) {
        resolveHit(fighter1, fighter2)
      }
      if (fighter2.attack !== null && fighter2.attackFrame === ATTACKS[fighter2.attack].startup) {
        resolveHit(fighter2, fighter1)
      }

      decayKnockback(fighter1)
      decayKnockback(fighter2)
      separateFighters(fighter1, fighter2)
      fx.update()

      if (fighter1.hp === 0 || fighter2.hp === 0) {
        state = 'ko'
        stateTimer = MATCH_CONFIG.koFrames
        banner = 'K.O.'
        bannerSub = ''
        audio.play('ko')
        return events
      }

      if (frame >= MATCH_CONFIG.roundFrames) {
        const ratio1 = fighter1.hp / 100
        const ratio2 = fighter2.hp / 100
        const winner = ratio1 === ratio2 ? null : ratio1 > ratio2 ? 1 : 2
        endRound(winner, 'TIME UP')
      }

      return events
    },

    /** 重开整场对局。 */
    reset() {
      wins1 = 0
      wins2 = 0
      roundIndex = 1
      matchWinner = null
      startRound()
    },

    /** 只读状态快照，供渲染层读取。 */
    get state() {
      return state
    },
    get frame() {
      return frame
    },
    get round() {
      return roundIndex
    },
    get timeLeft() {
      return Math.max(0, Math.ceil((MATCH_CONFIG.roundFrames - frame) / 60))
    },
    get wins() {
      return [wins1, wins2]
    },
    get banner() {
      return banner
    },
    get bannerSub() {
      return bannerSub
    },
    get matchWinner() {
      return matchWinner
    },
    get lastHit() {
      return lastHit
    },
  }
}

/**
 * 推进机甲并附加世界参数。
 * @param fighter - 机甲状态对象。
 * @param input - 本帧输入。
 * @param world - 世界参数。
 * @returns 事件列表。
 */
function updateFighterWithWorld(fighter, input, world) {
  return updateFighter(fighter, input, world)
}

/**
 * 把互相穿入的两台机甲推开，保持最小间距。
 * @param a - 一方机甲。
 * @param b - 另一方机甲。
 */
function separateFighters(a, b) {
  const gap = b.x - a.x
  const distance = Math.abs(gap)
  if (distance >= MATCH_CONFIG.minGap) return
  const push = (MATCH_CONFIG.minGap - distance) / 2
  const sign = gap >= 0 ? 1 : -1
  a.x = Math.max(MATCH_CONFIG.arenaLeft, a.x - push * sign)
  b.x = Math.min(MATCH_CONFIG.arenaRight, b.x + push * sign)
}
