/**
 * 机甲骨架像素图与姿势表（纯数据）。
 *
 * 部件共 6 个：头、躯干、手臂、腿、推进器、能量刃。
 * 姿势表只描述「部件相对基准位的偏移」，因此新增一帧动画不必重画像素。
 * 像素索引含义见 palette.js：0 描边、1 暗部、2 主体、3 高光、4 强调暗部、
 * 5 强调亮部、6 辉光、7 钢材、8 刃光，`.` 为透明。
 */

/** 头部，14×11。 */
export const HEAD = [
  '...00000000...',
  '..0555555550..',
  '.055333333550.',
  '.033222222330.',
  '.032222222230.',
  '.032666666230.',
  '.032666666230.',
  '.032222222230.',
  '.011222222110.',
  '..0122222210..',
  '...00000000...',
]

/**
 * 由左半行镜像生成整行，保证对称与行宽一致。
 * @param halves - 每行左半部分的字符串，长度必须相同。
 * @returns 完整像素行数组。
 */
export function mirrorRows(halves) {
  return halves.map((half) => half + [...half].reverse().join(''))
}

/** 躯干左半行，镜像后宽 20、高 22。 */
const TORSO_HALVES = [
  '.....00000',
  '..03333333',
  '.033322222',
  '.032222222',
  '.032222222',
  '.032112222',
  '.032112222',
  '.032222222',
  '.033222222',
  '.033111111',
  '.044111111',
  '.044566666',
  '.045566666',
  '.044444444',
  '..04444444',
  '..04444444',
  '..04444444',
  '..00444444',
  '..00444444',
  '..00444444',
  '....000000',
  '....000000',
]

/** 躯干，20×22。 */
export const TORSO = mirrorRows(TORSO_HALVES)

/** 手臂，7×18。 */
export const ARM = [
  '.00000.',
  '.03330.',
  '.03220.',
  '.03220.',
  '.03220.',
  '.03220.',
  '.03220.',
  '.03220.',
  '.03220.',
  '.03220.',
  '.02220.',
  '.02220.',
  '.02220.',
  '.02220.',
  '.02220.',
  '.01110.',
  '.00000.',
  '.......',
]

/** 腿，8×18。 */
export const LEG = [
  '..0000..',
  '..0220..',
  '..0320..',
  '..0320..',
  '..0320..',
  '..0320..',
  '..0320..',
  '..0320..',
  '..0220..',
  '..0220..',
  '..0220..',
  '..0220..',
  '..0220..',
  '.022220.',
  '.044440.',
  '.044440.',
  '.000000.',
  '........',
]

/** 背部推进器，7×9。 */
export const THRUSTER = [
  '...00..',
  '..0550.',
  '.055550',
  '.054450',
  '.054450',
  '.044440',
  '.044440',
  '.000000',
  '.......',
]

/** 能量刃，6×16，刃尖朝上、握把在下。 */
export const BLADE = [
  '..00..',
  '.0880.',
  '.0880.',
  '.0880.',
  '.0860.',
  '.0850.',
  '.0850.',
  '.0550.',
  '.0550.',
  '.4550.',
  '.4550.',
  '.4450.',
  '.4450.',
  '.4400.',
  '.0000.',
  '......',
]

/** 部件像素图。 */
export const PARTS = { head: HEAD, torso: TORSO, arm: ARM, leg: LEG, thruster: THRUSTER, blade: BLADE }

/** 部件尺寸表，供校验使用。 */
export const PART_SIZES = {
  head: [14, 11],
  torso: [20, 22],
  arm: [7, 18],
  leg: [8, 18],
  thruster: [7, 9],
  blade: [6, 16],
}

/**
 * 基准位：机甲脚底为原点，躯干居中，向右为面朝方向。
 * 数值是部件左上角相对原点的偏移，整台机甲约 51 像素高。
 */
export const BASE_POSE = {
  head: [-7, -51],
  torso: [-10, -40],
  armFront: [12, -36],
  armBack: [-19, -36],
  legFront: [2, -18],
  legBack: [-10, -18],
  thruster: [-15, -30],
  blade: [14, -30],
}

/**
 * 姿势表：状态 → 帧序列，每帧给出部件的绝对位置，未列出的部件沿用基准位。
 */
export const POSES = {
  idle: [
    {},
    { head: [-7, -52], armFront: [12, -37], armBack: [-19, -37], blade: [14, -31] },
  ],
  run: [
    { legFront: [4, -16], legBack: [-12, -18], armFront: [9, -36], armBack: [-16, -36], head: [-6, -51], blade: [14, -29] },
    { legFront: [2, -18], legBack: [-11, -20], armFront: [11, -37], armBack: [-17, -37], head: [-7, -52], blade: [13, -31] },
    { legFront: [0, -18], legBack: [-8, -16], armFront: [14, -36], armBack: [-19, -36], head: [-8, -51], blade: [14, -29] },
    { legFront: [1, -20], legBack: [-10, -18], armFront: [13, -37], armBack: [-18, -37], head: [-7, -52], blade: [13, -31] },
  ],
  jump: [
    { legFront: [2, -22], legBack: [-12, -19], armFront: [14, -40], armBack: [-21, -40], thruster: [-15, -32], blade: [14, -33] },
  ],
  fall: [
    { legFront: [4, -17], legBack: [-13, -19], armFront: [15, -33], armBack: [-22, -33], thruster: [-15, -27], blade: [14, -28] },
  ],
  light: [
    { armFront: [9, -38], blade: [5, -36], head: [-8, -51], torso: [-11, -40] },
    { armFront: [18, -36], blade: [24, -32], head: [-5, -51], torso: [-9, -40], legFront: [4, -18] },
    { armFront: [15, -36], blade: [19, -31], head: [-7, -51], torso: [-10, -40] },
  ],
  heavy: [
    { armFront: [10, -42], blade: [9, -46], head: [-8, -52], torso: [-11, -40], legBack: [-11, -19] },
    { armFront: [17, -31], blade: [22, -24], head: [-5, -49], torso: [-8, -38], legFront: [5, -18], legBack: [-12, -18] },
    { armFront: [15, -35], blade: [17, -29], head: [-7, -51], torso: [-10, -40] },
  ],
  block: [
    { armFront: [15, -40], blade: [13, -40], armBack: [-16, -38], head: [-7, -51], torso: [-10, -40] },
  ],
  hurt: [
    { head: [-10, -50], torso: [-13, -40], armFront: [9, -34], armBack: [-22, -34], legFront: [0, -18], blade: [10, -28] },
  ],
  ko: [
    { head: [-13, -44], torso: [-16, -34], armFront: [6, -26], armBack: [-21, -26], legFront: [-2, -17], legBack: [-14, -17], blade: [6, -20] },
  ],
  win: [
    { armFront: [13, -42], blade: [13, -46], head: [-7, -52] },
    { armFront: [14, -44], blade: [14, -49], head: [-6, -53] },
  ],
}

/** 部件绘制顺序：先远后近。 */
export const DRAW_ORDER = ['thruster', 'armBack', 'legBack', 'legFront', 'torso', 'head', 'armFront', 'blade']

/** 姿势键到像素图的映射：前后手臂共用一张图，前后腿共用一张图。 */
export const PART_ART = {
  head: 'head',
  torso: 'torso',
  armBack: 'arm',
  armFront: 'arm',
  legBack: 'leg',
  legFront: 'leg',
  thruster: 'thruster',
  blade: 'blade',
}

/**
 * 校验像素图的尺寸与每行宽度，防止素材表错位。
 * @param parts - 部件名到像素行数组的映射。
 * @param sizes - 部件名到 [width, height] 的映射。
 * @returns 不一致时的描述列表，全部一致时为空数组。
 */
export function validateParts(parts, sizes = PART_SIZES) {
  const problems = []
  for (const [name, rows] of Object.entries(parts)) {
    const expected = sizes[name]
    if (expected === undefined) {
      problems.push(`${name} 缺少尺寸定义`)
      continue
    }
    if (rows.length !== expected[1]) problems.push(`${name} 行数 ${rows.length} != ${expected[1]}`)
    const width = expected[0]
    rows.forEach((row, index) => {
      if (row.length !== width) problems.push(`${name}[${index}] 宽度 ${row.length} != ${width}`)
    })
  }
  return problems
}
