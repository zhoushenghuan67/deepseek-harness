/**
 * 固定步长主循环。
 * 逻辑以 60Hz 固定步推进（保证不同刷新率下手感与判定一致），渲染跟随浏览器刷新率。
 */
export const STEP_MS = 1000 / 60

/**
 * 创建并启动主循环。
 * @param update 每帧逻辑推进一次（固定 1/60 秒）。
 * @param render 每次浏览器帧调用一次，参数为上一帧到本帧之间的插值比例。
 */
export function startLoop(update, render) {
  let last = performance.now()
  let accumulator = 0

  function frame(now) {
    const delta = Math.min(now - last, 250)
    last = now
    accumulator += delta
    let steps = 0
    while (accumulator >= STEP_MS && steps < 5) {
      update()
      accumulator -= STEP_MS
      steps += 1
    }
    if (steps === 5) accumulator = 0
    render(accumulator / STEP_MS)
    requestAnimationFrame(frame)
  }

  requestAnimationFrame(frame)
}
