/**
 * 键盘输入：维护按下集合，并区分「按住」与「本帧刚按下」两种边沿状态。
 */

/**
 * 绑定键盘事件并返回输入查询接口。
 * @param target - 承载 keydown/keyup 监听的对象，浏览器中为 window。
 * @returns 输入查询对象，含 isDown、wasPressed、endFrame 与解绑函数。
 */
export function createInput(target) {
  const down = new Set()
  const pressed = new Set()
  const released = new Set()

  const onKeyDown = (event) => {
    if (event.repeat) return
    if (!down.has(event.code)) pressed.add(event.code)
    down.add(event.code)
  }
  const onKeyUp = (event) => {
    down.delete(event.code)
    released.add(event.code)
  }

  target.addEventListener('keydown', onKeyDown)
  target.addEventListener('keyup', onKeyUp)

  return {
    /** 该键当前是否按住。 */
    isDown(code) {
      return down.has(code)
    },
    /** 该键是否在上一帧刚按下。 */
    wasPressed(code) {
      return pressed.has(code)
    },
    /** 该键是否在上一帧刚抬起。 */
    wasReleased(code) {
      return released.has(code)
    },
    /** 清空本帧的边沿状态，每帧逻辑结束后调用。 */
    endFrame() {
      pressed.clear()
      released.clear()
    },
    /** 解除监听。 */
    dispose() {
      target.removeEventListener('keydown', onKeyDown)
      target.removeEventListener('keyup', onKeyUp)
    },
  }
}
