/* ─────────────────────────────────────────
   Model constants & pure data tables
───────────────────────────────────────── */

// ── 模型縮放基準 ──
const BASE_CAI_GRADE = 8;
const BASE_MODEL_SCALE = 10;
const BASE_MODEL_TRANSLATION = [0, -10, 0];

// ── 量測系統基準 ──
const DIMENSION_BASE_Y = -14.428800;
const DIMENSION_CENTER_X = -0.134631;
const DIMENSION_CENTER_Z = 0.011413;
const DIMENSION_ANCHOR_DEF = '_01_Lu_Dou';
const FEN_PER_MAJOR_UNIT = 30;
const FEN_DISTANCE_SCALE = 1.5;
const X_MAJOR_CELL_FEN_WIDTHS = [25, 30, 30, 25];
const Z_MAJOR_CELL_FEN_WIDTHS = [18, 30, 30, 18];

// ── 材等 ──
const CAI_GRADE_VALUES = {
  1: 9.0,
  2: 8.25,
  3: 7.5,
  4: 7.2,
  5: 6.6,
  6: 6.0,
  7: 5.25,
  8: 4.5,
};
const CAI_GRADE_LABELS = {
  1: '一',
  2: '二',
  3: '三',
  4: '四',
  5: '五',
  6: '六',
  7: '七',
  8: '八',
};

// ── 構件類型與 DEF 名稱 ──
const TYPE_DEFS = {
  '枓': ['_01_Lu_Dou',
         '_04_Jiao_Hu_Dou', '_05_Jiao_Hu_Dou',
         '_07_Qi_Xin_Dou',  '_08_Qi_Xin_Dou',
         '_13_San_Dou', '_14_San_Dou', '_15_San_Dou', '_16_San_Dou',
         '_17_Jiao_Hu_Dou', '_18_Jiao_Hu_Dou',
         '_19_Qi_Xin_Dou',  '_20_Qi_Xin_Dou'],
  '栱': ['_02_Ni_Dao_Gong', '_09_Gua_Zi_Gong', '_10_Gua_Zi_Gong', '_11_Mang_Gong'],
  '昂': ['_03_Xia_Ang', '_25_XiaAng'],
  '栿': ['_06_Fu'],
  '耍頭': ['_12_Shua_Tou'],
  '枋': ['_21_Fang', '_22_Fang', '_23_Fang', '_24_Fang'],
};

// ── 各構件組裝後的正確位置（從 x3d 讀取）──
const ASSEMBLED_POS = {
  '_01_Lu_Dou':      [ 0.146537, -0.442880, -0.158859],
  '_02_Ni_Dao_Gong': [-0.063462, -0.322880, -0.308859],
  '_03_Xia_Ang':     [ 0.236537, -0.322880, -0.048858],
  '_25_XiaAng':      [-2.439805, -3.024306, -4.114415],
  '_04_Jiao_Hu_Dou': [-0.233463, -0.172880, -0.088859],
  '_05_Jiao_Hu_Dou': [ 0.206537, -0.172880,  0.091141],
  '_06_Fu':          [-0.673463,  0.097120, -0.048858],
  '_07_Qi_Xin_Dou':  [-0.093463, -0.172880,  0.331142],
  '_08_Qi_Xin_Dou':  [-0.093463, -0.172880, -0.188859],
  '_09_Gua_Zi_Gong': [-0.363463, -0.112880, -0.358859],
  '_10_Gua_Zi_Gong': [ 0.236537, -0.112880, -0.358859],
  '_11_Mang_Gong':   [-0.063462, -0.112880, -0.458859],
  '_12_Shua_Tou':    [-0.212434, -0.112880,  0.051142],
  '_13_San_Dou':     [ 0.206537,  0.037120, -0.238859],
  '_14_San_Dou':     [-0.393463,  0.037120, -0.238859],
  '_15_San_Dou':     [-0.393463,  0.037120,  0.381142],
  '_16_San_Dou':     [ 0.206537,  0.037120,  0.381142],
  '_17_Jiao_Hu_Dou': [-0.393463,  0.037120,  0.091142],
  '_18_Jiao_Hu_Dou': [ 0.366537,  0.037120, -0.088858],
  '_19_Qi_Xin_Dou':  [-0.093463,  0.037120,  0.481141],
  '_20_Qi_Xin_Dou':  [-0.093463,  0.037120, -0.338858],
  '_21_Fang':        [-0.063463,  0.307120,  0.481142],
  '_22_Fang':        [-0.263463,  0.097120,  0.381141],
  '_23_Fang':        [-0.063463,  0.097120,  0.281142],
  '_24_Fang':        [ 0.336537,  0.097120, -0.277692],
};

// ── 構件顯示名稱 ──
const DEF_LABELS = {
  '_01_Lu_Dou':      { zh: '枓',  sub: '櫨枓'   },
  '_04_Jiao_Hu_Dou': { zh: '枓',  sub: '交互枓' },
  '_05_Jiao_Hu_Dou': { zh: '枓',  sub: '交互枓' },
  '_07_Qi_Xin_Dou':  { zh: '枓',  sub: '齊心枓' },
  '_08_Qi_Xin_Dou':  { zh: '枓',  sub: '齊心枓' },
  '_13_San_Dou':     { zh: '枓',  sub: '散枓'   },
  '_14_San_Dou':     { zh: '枓',  sub: '散枓'   },
  '_15_San_Dou':     { zh: '枓',  sub: '散枓'   },
  '_16_San_Dou':     { zh: '枓',  sub: '散枓'   },
  '_17_Jiao_Hu_Dou': { zh: '枓',  sub: '交互枓' },
  '_18_Jiao_Hu_Dou': { zh: '枓',  sub: '交互枓' },
  '_19_Qi_Xin_Dou':  { zh: '枓',  sub: '齊心枓' },
  '_20_Qi_Xin_Dou':  { zh: '枓',  sub: '齊心枓' },
  '_02_Ni_Dao_Gong': { zh: '栱',  sub: '泥道栱' },
  '_09_Gua_Zi_Gong': { zh: '栱',  sub: '瓜子栱' },
  '_10_Gua_Zi_Gong': { zh: '栱',  sub: '瓜子栱' },
  '_11_Mang_Gong':   { zh: '栱',  sub: '慢栱'   },
  '_03_Xia_Ang':     { zh: '昂',  sub: '下昂'   },
  '_25_XiaAng':      { zh: '昂',  sub: '下昂'   },
  '_06_Fu':          { zh: '栿',  sub: '栿'     },
  '_12_Shua_Tou':    { zh: '耍頭', sub: '耍頭'  },
  '_21_Fang':        { zh: '枋',  sub: '枋'     },
  '_22_Fang':        { zh: '枋',  sub: '枋'     },
  '_23_Fang':        { zh: '枋',  sub: '枋'     },
  '_24_Fang':        { zh: '枋',  sub: '枋'     },
};

// ── 層次組裝順序 ──
const LAYER_DEFS = [
  ['_01_Lu_Dou'],
  ['_02_Ni_Dao_Gong', '_03_Xia_Ang', '_25_XiaAng'],
  ['_04_Jiao_Hu_Dou', '_05_Jiao_Hu_Dou', '_07_Qi_Xin_Dou', '_08_Qi_Xin_Dou'],
  ['_09_Gua_Zi_Gong', '_10_Gua_Zi_Gong', '_11_Mang_Gong'],
  ['_12_Shua_Tou'],
  [
    '_13_San_Dou', '_14_San_Dou', '_15_San_Dou', '_16_San_Dou',
    '_17_Jiao_Hu_Dou', '_18_Jiao_Hu_Dou',
    '_19_Qi_Xin_Dou', '_20_Qi_Xin_Dou',
  ],
  ['_22_Fang', '_23_Fang', '_24_Fang'],
  ['_06_Fu'],
  ['_21_Fang'],
];

// ── 各類型的固定散落偏移量（x, y, z）──
const SCATTER_OFFSET = {
  '枓':  [ 2.0,  0.0,  0.0],
  '栱':  [-2.0,  0.0,  0.0],
  '昂':  [ 0.0,  0.0,  2.0],
  '栿':  [ 0.0,  0.0, -2.0],
  '耍頭': [ 1.5,  0.0,  1.5],
  '枋':  [ 1.89,  0.0, -1.640001],
};

const SCATTER_OFFSET_BY_DEF = {
  '_01_Lu_Dou': [0.0, 0.0, 0.0],
  '_03_Xia_Ang': [0.0, 0.0, 1.2],
  '_11_Mang_Gong': [-2.0, 0.0, -0.8],
  '_17_Jiao_Hu_Dou': [1.6, 0.0, 0.0],
  '_18_Jiao_Hu_Dou': [2.4, 0.0, 0.0],
  '_23_Fang':   [2.49, 0.0, -1.640001],
  '_25_XiaAng':  [-0.25, 0.0, 1.5],
};

const SCATTER_Y = -0.442880;
const SCATTER_Y_BY_DEF = {
  '_01_Lu_Dou': -0.442880,
  '_25_XiaAng': -3.202880,
};

// ── 模型設定 ──
const MODEL_CONFIGS = {
  original: {
    label: 'Palace',
    url: '05-5-1.x3d',
    scale: '10 10 10',
    translation: BASE_MODEL_TRANSLATION.join(' '),
    enableOriginalTools: true,
    viewpoint: {
      position: '0 -11.642880 50',
      orientation: '0 0 0 0',
      fieldOfView: '0.6',
    },
  },
  palace: {
    label: '05-5-1',
    url: 'Palace1.x3d',
    scale: '1 1 1',
    translation: '0 0 0',
    enableOriginalTools: false,
    viewpoint: {
      position: '0 0 46',
      orientation: '0 0 0 0',
      fieldOfView: '0.7',
    },
  },
};
