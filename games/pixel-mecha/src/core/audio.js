/**
 * WebAudio 合成音效：不引入音频文件，全部由振荡器与噪声实时合成。
 */

const SOUND_TABLE = {
  swing: { wave: 'square', from: 420, to: 760, duration: 0.07, gain: 0.05 },
  hit: { wave: 'square', from: 220, to: 90, duration: 0.12, gain: 0.09, noise: 0.06 },
  heavy: { wave: 'square', from: 150, to: 55, duration: 0.22, gain: 0.12, noise: 0.09 },
  block: { wave: 'triangle', from: 900, to: 640, duration: 0.08, gain: 0.07, noise: 0.04 },
  jump: { wave: 'square', from: 300, to: 620, duration: 0.08, gain: 0.04 },
  ko: { wave: 'sawtooth', from: 420, to: 70, duration: 0.5, gain: 0.1 },
  round: { wave: 'square', from: 440, to: 880, duration: 0.28, gain: 0.06 },
  win: { wave: 'square', from: 520, to: 1040, duration: 0.45, gain: 0.07 },
}

/**
 * 创建音效播放器。
 * @returns 播放、切换静音的接口。
 */
export function createAudio() {
  let context = null
  let muted = false

  function ensureContext() {
    if (context === null) {
      const AudioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext
      if (AudioContextClass === undefined) return null
      context = new AudioContextClass()
    }
    if (context.state === 'suspended') void context.resume()
    return context
  }

  function playNoise(ctx, duration, gainValue, delay) {
    const frames = Math.floor(ctx.sampleRate * duration)
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate)
    const samples = buffer.getChannelData(0)
    for (let index = 0; index < frames; index += 1) {
      samples[index] = (Math.random() * 2 - 1) * (1 - index / frames)
    }
    const source = ctx.createBufferSource()
    const gain = ctx.createGain()
    gain.gain.value = gainValue
    source.buffer = buffer
    source.connect(gain)
    gain.connect(ctx.destination)
    source.start(ctx.currentTime + delay)
  }

  return {
    /**
     * 播放一个音效。
     * @param name - SOUND_TABLE 中的音效名。
     */
    play(name) {
      if (muted) return
      const spec = SOUND_TABLE[name]
      if (spec === undefined) return
      const ctx = ensureContext()
      if (ctx === null) return

      const oscillator = ctx.createOscillator()
      const gain = ctx.createGain()
      oscillator.type = spec.wave
      oscillator.frequency.setValueAtTime(spec.from, ctx.currentTime)
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, spec.to), ctx.currentTime + spec.duration)
      gain.gain.setValueAtTime(spec.gain, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + spec.duration)
      oscillator.connect(gain)
      gain.connect(ctx.destination)
      oscillator.start(ctx.currentTime)
      oscillator.stop(ctx.currentTime + spec.duration + 0.02)

      if (spec.noise !== undefined) playNoise(ctx, spec.duration, spec.noise, 0)
    },
    /** 切换静音状态。 */
    toggleMute() {
      muted = !muted
      return muted
    },
    /** 当前是否静音。 */
    isMuted() {
      return muted
    },
  }
}
