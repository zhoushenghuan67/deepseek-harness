/**
 * 调色板：机甲共用同一套像素索引，只替换颜色表即可得到不同涂装。
 */

/** 像素索引含义：0 描边、1 暗部、2 主体、3 高光、4 强调暗部、5 强调亮部、6 辉光、7 钢材、8 刃光。 */
export const MECHA_PALETTES = {
  azure: {
    '.': null,
    '0': '#070b16',
    '1': '#1b2740',
    '2': '#37527c',
    '3': '#5f86bd',
    '4': '#1d4f77',
    '5': '#41c7f5',
    '6': '#dff4ff',
    '7': '#b9c6d8',
    '8': '#ffffff',
  },
  ember: {
    '.': null,
    '0': '#140608',
    '1': '#3a1518',
    '2': '#7c2f2c',
    '3': '#b55a49',
    '4': '#6d2410',
    '5': '#ff8a3c',
    '6': '#ffe2c0',
    '7': '#d8c3b4',
    '8': '#fff6e6',
  },
}

/** 场景配色：天空渐变自上而下 6 段，其余为实体色。 */
export const SCENE = {
  sky: ['#150e2b', '#221343', '#3a1a52', '#672357', '#a63a52', '#df6a3f'],
  sun: '#ffb45e',
  sunCore: '#ffe9b0',
  star: '#c9d6ff',
  farRidge: '#2a1852',
  farRidgeTop: '#3a2264',
  midTower: '#2a1746',
  midTowerLight: '#3b2260',
  window: '#ffcf6b',
  girder: '#1c0f30',
  girderLight: '#372052',
  wall: '#1b1030',
  wallPanel: '#241640',
  ground: '#2b1c3a',
  groundTop: '#463055',
  grid: '#3a2a4c',
  debris: '#4d3660',
}
