/**
 * 软件像素缓冲：渲染目标是一块 RGBA 字节数组，不依赖 DOM 或 Canvas。
 * 主循环把缓冲转成 ImageData 贴到画布，工具脚本则直接导出 PNG 做画面核对。
 */

const colorCache = new Map()

/**
 * 解析 #rrggbb 颜色为 [r, g, b]，结果缓存复用。
 * @param hex - 6 位十六进制颜色字符串。
 * @returns 三通道颜色分量。
 */
export function parseColor(hex) {
  const cached = colorCache.get(hex)
  if (cached !== undefined) return cached
  const value = Number.parseInt(hex.slice(1), 16)
  const rgb = [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff]
  colorCache.set(hex, rgb)
  return rgb
}

/**
 * 创建一块像素缓冲。
 * @param width - 缓冲宽度（像素）。
 * @param height - 缓冲高度（像素）。
 * @returns 带有清屏、矩形、精灵、图块绘制能力的缓冲对象。
 */
export function createFramebuffer(width, height) {
  const data = new Uint8ClampedArray(width * height * 4)

  const fb = {
    width,
    height,
    data,

    /** 用单色填满整块缓冲。 */
    clear(hex) {
      const [r, g, b] = parseColor(hex)
      for (let index = 0; index < data.length; index += 4) {
        data[index] = r
        data[index + 1] = g
        data[index + 2] = b
        data[index + 3] = 255
      }
    },

    /** 画一个实心矩形，超出边界的部分被裁掉。 */
    fillRect(x, y, w, h, hex) {
      const [r, g, b] = parseColor(hex)
      const x0 = Math.max(0, Math.round(x))
      const y0 = Math.max(0, Math.round(y))
      const x1 = Math.min(width, Math.round(x + w))
      const y1 = Math.min(height, Math.round(y + h))
      for (let py = y0; py < y1; py += 1) {
        let index = (py * width + x0) * 4
        for (let px = x0; px < x1; px += 1) {
          data[index] = r
          data[index + 1] = g
          data[index + 2] = b
          data[index + 3] = 255
          index += 4
        }
      }
    },

    /** 写一个像素。 */
    setPixel(x, y, hex) {
      const px = Math.round(x)
      const py = Math.round(y)
      if (px < 0 || px >= width || py < 0 || py >= height) return
      const [r, g, b] = parseColor(hex)
      const index = (py * width + px) * 4
      data[index] = r
      data[index + 1] = g
      data[index + 2] = b
      data[index + 3] = 255
    },

    /**
     * 绘制一张由字符串行组成的精灵图。
     * @param rows - 每行一个字符串，字符为调色板键。
     * @param palette - 字符到颜色的映射，值为 null 的字符不落笔。
     * @param x - 左上角横坐标。
     * @param y - 左上角纵坐标。
     * @param flip - 为 true 时水平镜像。
     */
    blit(rows, palette, x, y, flip = false) {
      for (let row = 0; row < rows.length; row += 1) {
        const line = rows[row]
        for (let column = 0; column < line.length; column += 1) {
          const hex = palette[line[column]]
          if (hex === undefined || hex === null) continue
          const px = flip ? x + line.length - 1 - column : x + column
          const py = y + row
          if (px < 0 || px >= width || py < 0 || py >= height) continue
          const [r, g, b] = parseColor(hex)
          const index = (py * width + px) * 4
          data[index] = r
          data[index + 1] = g
          data[index + 2] = b
          data[index + 3] = 255
        }
      }
    },

    /**
     * 绘制一块已烘焙好的图块（自带宽高与像素数据）。
     * @param surface - 含 width、height、data 的图块。
     * @param x - 左上角横坐标。
     * @param y - 左上角纵坐标。
     */
    blitSurface(surface, x, y) {
      for (let row = 0; row < surface.height; row += 1) {
        const py = Math.round(y) + row
        if (py < 0 || py >= height) continue
        for (let column = 0; column < surface.width; column += 1) {
          const source = (row * surface.width + column) * 4
          if (surface.data[source + 3] === 0) continue
          const px = Math.round(x) + column
          if (px < 0 || px >= width) continue
          const target = (py * width + px) * 4
          data[target] = surface.data[source]
          data[target + 1] = surface.data[source + 1]
          data[target + 2] = surface.data[source + 2]
          data[target + 3] = 255
        }
      }
    },
  }

  return fb
}
