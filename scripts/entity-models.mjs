// Hand-built models for items the game draws with entity renderers (no JSON model):
// chests, shulker boxes, beds, banners, shields, decorated pots, mob heads.
// Boxes use Minecraft's box-UV layout on the 1.21.11 entity textures.

const COLORS = ['white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray', 'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black'];
// DyeColor texture diffuse colours (used to tint banner flags)
const DYE = {
  white: 0xf9fffe, orange: 0xf9801d, magenta: 0xc74ebd, light_blue: 0x3ab3da, yellow: 0xfed83d, lime: 0x80c71f, pink: 0xf38baa, gray: 0x474f52,
  light_gray: 0x9d9d97, cyan: 0x169c9c, purple: 0x8932b8, blue: 0x3c44aa, brown: 0x835432, green: 0x5e7c16, red: 0xb02e26, black: 0x1d1d21,
};

/** Box-UV regions for a cube with texture offset (u,v) and size (w,h,d). */
function regions(u, v, w, h, d) {
  return {
    top: [u + d, v, u + d + w, v + d],
    bottom: [u + d + w, v, u + d + 2 * w, v + d],
    right: [u, v + d, u + d, v + d + h],
    front: [u + d, v + d, u + d + w, v + d + h],
    left: [u + d + w, v + d, u + 2 * d + w, v + d + h],
    back: [u + 2 * d + w, v + d, u + 2 * d + 2 * w, v + d + h],
  };
}
const DEFAULT_MAP = { up: 'top', down: 'bottom', north: 'front', south: 'back', west: 'right', east: 'left' };

/** A box in block space whose faces sample the entity texture with box-UV. */
function box(from, to, tex, uv, size, opts = {}) {
  const r = regions(uv[0], uv[1], ...size);
  const map = { ...DEFAULT_MAP, ...(opts.map ?? {}) };
  const faces = {};
  for (const [dir, key] of Object.entries(map)) {
    if (!key || opts.skip?.includes(dir)) continue;
    let reg = Array.isArray(key) ? key : r[key];
    if (opts.flip?.includes(dir)) reg = [reg[0], reg[3], reg[2], reg[1]];
    if (opts.mirror?.includes(dir)) reg = [reg[2], reg[1], reg[0], reg[3]];
    faces[dir] = { texture: tex, uvPx: reg, rotation: opts.rot?.[dir] ?? 0, tint: opts.tint ?? null };
  }
  return { from, to, faces, shade: opts.shade };
}

const inflate = (f, t, k) => [[f[0] - k, f[1] - k, f[2] - k], [t[0] + k, t[1] + k, t[2] + k]];

function chest(tex) {
  // chest block-entity models are y-up (no flip): the "bottom" UV region is the visible top,
  // and side regions run bottom→top, so flip them vertically
  const o = { map: { up: 'bottom', down: 'top' }, flip: ['north', 'south', 'west', 'east'] };
  return {
    textures: { c: tex },
    elements: [
      box([1, 0, 1], [15, 10, 15], 'c', [0, 19], [14, 10, 14], o),
      box([1, 9, 1], [15, 14, 15], 'c', [0, 0], [14, 5, 14], o),
      box([7, 7, 0], [9, 11, 1], 'c', [0, 0], [2, 4, 1], o),
    ],
    gui: { rotation: [30, 225, 0] }, fit: 0.86,
  };
}

function shulker(tex) {
  return {
    textures: { s: tex },
    elements: [
      box([0.02, 0, 0.02], [15.98, 8, 15.98], 's', [0, 28], [16, 8, 16], { skip: ['up'] }),
      box([0, 4, 0], [16, 16, 16], 's', [0, 0], [16, 12, 16], { skip: ['down'] }),
    ],
    gui: { rotation: [30, 225, 0] }, fit: 0.86,
  };
}

function bed(tex) {
  // mattress lies flat: the entity "front" region is the top of the bed
  const head = box([0, 3, 0], [16, 9, 16], 'b', [0, 0], [16, 16, 6], {
    map: { up: 'front', down: 'back', north: 'top', south: null, west: 'right', east: 'left' },
    rot: { west: 90, east: 270 },
  });
  const foot = box([0, 3, 16], [16, 9, 32], 'b', [0, 22], [16, 16, 6], {
    map: { up: 'front', down: 'back', north: null, south: 'bottom', west: 'right', east: 'left' },
    rot: { west: 90, east: 270 },
  });
  const leg = (x, z, v) => box([x, 0, z], [x + 3, 3, z + 3], 'b', [50, v], [3, 3, 3]);
  return {
    textures: { b: tex },
    elements: [head, foot, leg(0, 0, 0), leg(13, 0, 12), leg(0, 29, 6), leg(13, 29, 18)],
    gui: { rotation: [30, 160, 0] }, fit: 0.95,
  };
}

function banner(tex, color) {
  const tint = DYE[color];
  return {
    textures: { t: tex },
    elements: [
      box([-2, 2, 7.5], [18, 42, 8.5], 't', [0, 0], [20, 40, 1], { tint }),
      box([7, 0, 8.5], [9, 44, 10.5], 't', [44, 0], [2, 42, 2]),
      box([-2, 42, 7], [18, 44, 9], 't', [0, 42], [20, 2, 2]),
    ],
    gui: { rotation: [10, 200, 0] }, fit: 0.95,
  };
}

function shield(tex) {
  return {
    textures: { s: tex },
    elements: [
      box([2, 0, 7], [14, 22, 8], 's', [0, 0], [12, 22, 1]),
      box([7, 8, 8], [9, 14, 14], 's', [26, 0], [2, 6, 6]),
    ],
    gui: { rotation: [10, 200, 0] }, fit: 0.9,
  };
}

function pot() {
  const side = { texture: 's', uvPx: [1, 0, 15, 16] };
  return {
    textures: { b: 'entity/decorated_pot/decorated_pot_base', s: 'entity/decorated_pot/decorated_pot_side' },
    elements: [
      { from: [1, 0, 1], to: [15, 16, 15], faces: {
        north: side, south: side, west: side, east: side,
        up: { texture: 'b', uvPx: [0, 13, 14, 27] }, down: { texture: 'b', uvPx: [14, 13, 28, 27] },
      } },
      box([4, 16, 4], [12, 19, 12], 'b', [0, 0], [8, 3, 8], { skip: ['down'] }),
      box([3, 19, 3], [13, 21, 13], 'b', [0, 5], [10, 2, 10], { skip: ['down'] }),
    ],
    gui: { rotation: [30, 225, 0] }, fit: 0.86,
  };
}

function head(tex, { w = 8, hat = false } = {}) {
  const x0 = 8 - w / 2;
  const els = [box([x0, 0, 4], [x0 + w, 8, 12], 'h', [0, 0], [w, 8, 8], { flip: ['up'] })];
  if (hat) { const [f, t] = inflate([4, 0, 4], [12, 8, 12], 0.5); els.push(box(f, t, 'h', [32, 0], [8, 8, 8], { flip: ['up'] })); }
  return { textures: { h: tex }, elements: els, gui: { rotation: [30, 225, 0] }, fit: 0.8 };
}

/** id → entity model (or null). Texture refs are relative to textures/. */
export function entityModel(id) {
  let m;
  if (id === 'chest') return chest('entity/chest/normal');
  if (id === 'trapped_chest') return chest('entity/chest/trapped');
  if (id === 'ender_chest') return chest('entity/chest/ender');
  if ((m = id.match(/^(?:(exposed|weathered|oxidized)_)?copper_chest$/))) return chest(`entity/chest/copper${m[1] ? '_' + m[1] : ''}`);
  if (id === 'shulker_box') return shulker('entity/shulker/shulker');
  if ((m = id.match(new RegExp(`^(${COLORS.join('|')})_shulker_box$`)))) return shulker(`entity/shulker/shulker_${m[1]}`);
  if ((m = id.match(new RegExp(`^(${COLORS.join('|')})_bed$`)))) return bed(`entity/bed/${m[1]}`);
  if ((m = id.match(new RegExp(`^(${COLORS.join('|')})_banner$`)))) return banner('entity/banner_base', m[1]);
  if (id === 'shield') return shield('entity/shield_base_nopattern');
  if (id === 'decorated_pot') return pot();
  if (id === 'skeleton_skull') return head('entity/skeleton/skeleton');
  if (id === 'wither_skeleton_skull') return head('entity/skeleton/wither_skeleton');
  if (id === 'zombie_head') return head('entity/zombie/zombie', { hat: true });
  if (id === 'creeper_head') return head('entity/creeper/creeper');
  if (id === 'player_head') return head('entity/player/wide/steve', { hat: true });
  if (id === 'piglin_head') return head('entity/piglin/piglin', { w: 10 });
  return null;
}
