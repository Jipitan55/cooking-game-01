// Sizzle & Serve — deterministic screenshot scenes behind ?shot=start|play|rush|end.
// Each scene plays the real rules forward from a fresh world for a fixed number of
// steps, steered by a simple autopilot (work the oldest order: fetch what the plate
// still needs, prep it at the right station, plate it, serve it), so the frame is
// what a short game really looks like and the same seed always gives the same frame.
import { INGREDIENTS, STATIONS, STEP } from './config.js';
import { RECIPES } from './config.js';
import { EVENT_OVER, nearestStation, plateMatchesRecipe, resetWorld, spawnOrder, stepWorld } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 26;
const RUSH_SECONDS = 112;
const RUSH_EXTRA_SECONDS = 25;
const END_LIMIT_SECONDS = 600;
const PREP_STATION = { chop: 'board', boil: 'stove', grill: 'grill', bake: 'oven' };

// The plating island blocks the middle of the floor: the autopilot walks
// around it instead of pushing straight through it (which pins the chef to
// an edge). The hit-test rect is the island inflated by the chef's radius,
// shrunk by 1px so walking along its boundary does not count as a hit.
const ISLAND_M = 20;
function islandRect() {
  const st = STATIONS.plating;
  return {
    x0: st.x - ISLAND_M + 1, y0: st.y - ISLAND_M + 1,
    x1: st.x + st.w + ISLAND_M - 1, y1: st.y + st.h + ISLAND_M - 1,
  };
}
function segmentHitsIsland(x0, y0, x1, y1) {
  const r = islandRect();
  const dx = x1 - x0;
  const dy = y1 - y0;
  let t0 = 0;
  let t1 = 1;
  const clip = (p, q) => {
    if (p === 0) return q >= 0;
    const t = q / p;
    if (p < 0) {
      if (t > t1) return false;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return false;
      if (t < t1) t1 = t;
    }
    return true;
  };
  if (!clip(-dx, x0 - r.x0)) return false;
  if (!clip(dx, r.x1 - x0)) return false;
  if (!clip(-dy, y0 - r.y0)) return false;
  if (!clip(dy, r.y1 - y0)) return false;
  return t1 - t0 > 1e-9;
}

/**
 * Next waypoint around the island when the straight line to the target is
 * blocked: the reachable corner closest to the target. Corners are pushed
 * 9px clear of the hit rect, so arriving near one unblocks the direct path.
 * (Routing by the corner nearest the chef flips back and forth and stalls.)
 * If the chef is already standing on that corner, take the adjacent corner
 * along the perimeter that is closer to the target, so it keeps moving.
 */
function islandWaypoint(world, tx, ty) {
  const r = islandRect();
  const corners = [
    [r.x0 - 9, r.y0 - 9], [r.x1 + 9, r.y0 - 9],
    [r.x1 + 9, r.y1 + 9], [r.x0 - 9, r.y1 + 9],
  ];
  const reachable = corners.filter(
    (c) => !segmentHitsIsland(world.chef.x, world.chef.y, c[0], c[1]),
  );
  const pool = reachable.length > 0 ? reachable : corners;
  pool.sort((a, b) => Math.hypot(a[0] - tx, a[1] - ty) - Math.hypot(b[0] - tx, b[1] - ty));
  const pick = pool[0];
  if (Math.hypot(pick[0] - world.chef.x, pick[1] - world.chef.y) < 10 && pool.length > 1) {
    const idx = corners.indexOf(pick);
    const next = corners[(idx + 1) % 4];
    const prev = corners[(idx + 3) % 4];
    const dn = Math.hypot(next[0] - tx, next[1] - ty);
    const dp = Math.hypot(prev[0] - tx, prev[1] - ty);
    return { x: (dn <= dp ? next : prev)[0], y: (dn <= dp ? next : prev)[1] };
  }
  return { x: pick[0], y: pick[1] };
}

function moveToward(world, x, y) {
  let tx = x;
  let ty = y;
  if (segmentHitsIsland(world.chef.x, world.chef.y, tx, ty)) {
    const w = islandWaypoint(world, tx, ty);
    tx = w.x;
    ty = w.y;
  }
  const dx = tx - world.chef.x;
  const dy = ty - world.chef.y;
  const d = Math.hypot(dx, dy);
  if (d < 4) return { mx: 0, my: 0 };
  return { mx: dx / d, my: dy / d };
}

function goTo(world, key) {
  const st = STATIONS[key];
  const m = moveToward(world, st.px, st.py);
  return { mx: m.mx, my: m.my, near: nearestStation(world.chef) === key };
}

function plateFitsAnOrder(world, items) {
  return world.orders.some((o) => items.every((k) => RECIPES[o.recipe].ingredients.includes(k)));
}

function plateReadyToServe(world) {
  if (world.chef.plate) {
    return world.orders.some((o) => plateMatchesRecipe(world.chef.plate.items, o.recipe));
  }
  if (world.plateOnCounter && world.plateOnCounter.items.length === 3) {
    return world.orders.some((o) => plateMatchesRecipe(world.plateOnCounter.items, o.recipe));
  }
  return false;
}

/**
 * The autopilot: one action { mx, my, interact, select } for this step.
 * Works the oldest order, fetching whatever the plate still needs.
 * Exported so the world logic can be play-tested headlessly in Node.
 */
export function autopilot(world) {
  const chef = world.chef;
  const plate = world.plateOnCounter;
  const target = world.orders[0] || null;

  // Carrying a plate: serve it, bin it, or put it back down.
  if (chef.plate) {
    const match = world.orders.some((o) => plateMatchesRecipe(chef.plate.items, o.recipe));
    if (match) {
      const g = goTo(world, 'serve');
      return { mx: g.mx, my: g.my, interact: g.near, select: null };
    }
    if (!plateFitsAnOrder(world, chef.plate.items)) {
      const g = goTo(world, 'trash');
      return { mx: g.mx, my: g.my, interact: g.near, select: null };
    }
    const g = goTo(world, 'plating');
    return { mx: g.mx, my: g.my, interact: g.near, select: null };
  }

  // Holding an ingredient.
  if (chef.hands) {
    const kind = chef.hands.kind;
    if (chef.hands.state === 'ready') {
      const wanted = target
        && RECIPES[target.recipe].ingredients.includes(kind)
        && plate && !plate.items.includes(kind) && plate.items.length < 3;
      if (wanted) {
        const g = goTo(world, 'plating');
        return { mx: g.mx, my: g.my, interact: g.near, select: null };
      }
      const g = goTo(world, 'trash');
      return { mx: g.mx, my: g.my, interact: g.near, select: null };
    }
    // Raw: get it prepared.
    if (world.chopping && world.chopping.kind === kind) {
      const g = goTo(world, 'board');
      return { mx: g.mx, my: g.my, interact: false, select: null };
    }
    const ing = INGREDIENTS[kind];
    const station = PREP_STATION[ing.prep];
    const slots = world.cookers[station] || [];
    const readySlot = slots.find((s) => s && s.kind === kind && s.state === 'ready');
    if (readySlot) {
      // A cooked one is already waiting: bin the raw one, then take it.
      const g = goTo(world, 'trash');
      return { mx: g.mx, my: g.my, interact: g.near, select: null };
    }
    const g = goTo(world, station);
    return { mx: g.mx, my: g.my, interact: g.near && !world.chopping, select: null };
  }

  // Empty hands: fetch what the oldest order still needs.
  if (!target) {
    const m = moveToward(world, 480, 430);
    return { mx: m.mx, my: m.my, interact: false, select: null };
  }
  const recipe = RECIPES[target.recipe];
  const needed = recipe.ingredients.find((k) => !(plate && plate.items.includes(k)));
  if (!needed) {
    // Plate is complete: pick it up.
    const g = goTo(world, 'plating');
    return { mx: g.mx, my: g.my, interact: g.near, select: null };
  }
  // Already cooking somewhere? Wait for it, or take it when ready.
  for (const [key, slots] of Object.entries(world.cookers)) {
    const slot = slots.find((s) => s && s.kind === needed);
    if (slot) {
      const g = goTo(world, key);
      return { mx: g.mx, my: g.my, interact: slot.state === 'ready' && g.near, select: null };
    }
  }
  // Off to the fridge for it.
  const g = goTo(world, 'fridge');
  return { mx: g.mx, my: g.my, interact: g.near, select: needed };
}

/**
 * Stage the busy-kitchen moment the screenshots need: a pot boiling on the
 * stove, fish on the grill, a tart (dough) baking in the oven with its door
 * glowing, something half-chopped on the board, a progress ring over every
 * busy station, a dish mid-assembly on the plating island, and `ticketCount`
 * tickets with one flashing red. Applied on top of a real autopilot run, so
 * the score, combo and served dishes underneath are genuine.
 */
function stageBusyKitchen(world, ticketCount) {
  world.level = Math.max(world.level, 3);
  while (world.orders.length < ticketCount) spawnOrder(world);
  world.orders = world.orders.slice(0, ticketCount);
  // One ticket flashing red: its customer is about to walk out.
  const urgent = world.orders[0];
  urgent.patience = urgent.max * 0.12;
  // Stove: pasta half-boiled. Grill: fish half-grilled. Oven: dough half-baked.
  world.cookers.stove = [{ kind: 'pasta', t: 2.0, state: 'cooking' }, null];
  world.cookers.grill = [{ kind: 'fish', t: 2.5, state: 'cooking' }, null];
  world.cookers.oven = [{ kind: 'dough', t: 3.0, state: 'cooking' }];
  // Half-chopped tomato on the board, chef standing at it mid-swing.
  world.chopping = { kind: 'tomato', t: 0.6, total: 1.2 };
  world.chef.hands = { kind: 'tomato', state: 'raw' };
  world.chef.x = 260;
  world.chef.y = 196;
  world.chef.face = 1;
  world.chef.chopSwing = 1.0;
  world.chef.moving = false;
  // A dish mid-assembly on the plating island.
  world.plateOnCounter = { items: ['lettuce', 'tomato'] };
  world.shakeT = 0;
  world.comboPopT = 0;
}

/**
 * Set `world` to the named scene (start, play, rush or end; any other name is start)
 * and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  resetWorld(world);
  if (name !== 'play' && name !== 'rush' && name !== 'end') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) stepWorld(world, STEP, autopilot(world));
    return { screen: SCREEN_TITLE, best: 0, newRecord: false };
  }
  if (name === 'play') {
    for (let i = 0; i < PLAY_SECONDS / STEP; i += 1) {
      if (stepWorld(world, STEP, autopilot(world)) & EVENT_OVER) break;
    }
    stageBusyKitchen(world, 4);
    return { screen: world.over ? SCREEN_OVER : SCREEN_PLAY, best: world.score, newRecord: false };
  }
  if (name === 'rush') {
    for (let i = 0; i < RUSH_SECONDS / STEP; i += 1) {
      if (stepWorld(world, STEP, autopilot(world)) & EVENT_OVER) break;
    }
    // A little longer, until a plate is ready to serve (or the extra time runs out).
    for (let i = 0; i < RUSH_EXTRA_SECONDS / STEP; i += 1) {
      if (plateReadyToServe(world)) break;
      if (stepWorld(world, STEP, autopilot(world)) & EVENT_OVER) break;
    }
    stageBusyKitchen(world, 5);
    return { screen: world.over ? SCREEN_OVER : SCREEN_PLAY, best: world.score, newRecord: false };
  }
  for (let i = 0; i < END_LIMIT_SECONDS / STEP; i += 1) {
    if (stepWorld(world, STEP, autopilot(world)) & EVENT_OVER) break;
  }
  return {
    screen: world.over ? SCREEN_OVER : SCREEN_PLAY,
    best: world.score,
    newRecord: world.score > 0,
  };
}
