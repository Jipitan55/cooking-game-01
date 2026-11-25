// Sizzle & Serve — the kitchen simulation: orders, stations, chopping, cooking,
// plating and serving. Pure logic, no drawing: render.js draws this state.
import {
  CHEF_SPEED, FRIDGE_ORDER, HUD_H, INGREDIENTS, INTERACT_RANGE, RECIPES,
  RECIPE_KEYS, SHIFT_SECONDS, SLOT_STATIONS, STATIONS, TUNE,
} from './config.js';
import { makeRng, pickFrom } from './random.js';

export const EVENT_OVER = 1;
const CHEF_R = 16;

/** True when the plate's items are exactly the recipe's ingredients (any order). */
export function plateMatchesRecipe(items, recipeKey) {
  const want = RECIPES[recipeKey].ingredients;
  if (items.length !== want.length) return false;
  return want.every((kind) => items.includes(kind));
}

/** The nearest station whose use-point is within reach of the chef, or null. */
export function nearestStation(chef) {
  let best = null;
  let bestDist = Infinity;
  for (const [key, st] of Object.entries(STATIONS)) {
    const dx = chef.x - st.px;
    const dy = chef.y - st.py;
    const d = Math.hypot(dx, dy);
    if (d < bestDist) {
      bestDist = d;
      best = key;
    }
  }
  return bestDist <= INTERACT_RANGE ? best : null;
}

export function createWorld(seed) {
  const world = {
    seed,
    rng: makeRng(seed),
    time: 0,
    timeLeft: SHIFT_SECONDS,
    score: 0,
    combo: 0,
    bestCombo: 0,
    served: 0,
    expired: 0,
    trashed: 0,
    level: 1,
    rush: false,
    over: false,
    chef: { x: 480, y: 430, face: 1, hands: null, plate: null, bob: 0, moving: false, chopSwing: 0 },
    orders: [],
    plateOnCounter: { items: [] },
    chopping: null,
    cookers: { stove: [null, null], grill: [null, null], oven: [null] },
    popups: [],
    particles: [],
    message: null,
    messageT: 0,
    selected: 'tomato',
    spawnTimer: 4,
    nextOrderId: 1,
    events: [],
    stats: { chopped: 0, cooked: 0, picked: 0 },
    // Score breakdown for the results screen: base + tips + combo bonus + rush bonus.
    breakdown: { base: 0, tips: 0, combo: 0, rush: 0 },
    servedDishes: {},
    shakeT: 0,
    comboPopT: 0,
    rushT: 0,
    newRecord: false,
  };
  return world;
}

const CUSTOMER_SKINS = ['#ffccbc', '#f1c27d', '#e0ac69', '#8d5524', '#ffdbac'];
const CUSTOMER_SHIRTS = ['#ef5350', '#42a5f5', '#66bb6a', '#ab47bc', '#ffa726', '#26a69a'];
const CUSTOMER_HAIR = ['#4e342e', '#212121', '#b71c1c', '#616161', '#6d4c41', '#f9a825'];

function orderSlots(world) {
  // Rush Hour squeezes one more ticket onto the board.
  return TUNE.orderSlotsStart + (world.level >= TUNE.orderSlotsLevel ? 1 : 0) + (world.rush ? 1 : 0);
}

function spawnInterval(world) {
  const base = Math.max(
    TUNE.spawnIntervalMin,
    TUNE.spawnIntervalStart - (world.level - 1) * 2,
  );
  return world.rush ? base * 0.6 : base;
}

function orderPatience(world) {
  const base = Math.max(
    TUNE.patienceMin,
    TUNE.patienceStart + TUNE.patiencePerLevel * (world.level - 1),
  );
  return world.rush ? base * TUNE.rushPatienceFactor : base;
}

export function spawnOrder(world) {
  const recipe = pickFrom(world.rng, RECIPE_KEYS);
  const patience = orderPatience(world);
  world.orders.push({
    id: world.nextOrderId,
    recipe,
    patience,
    max: patience,
    born: world.time,
    // The customer waiting at the serve window for this order.
    cust: {
      skin: pickFrom(world.rng, CUSTOMER_SKINS),
      shirt: pickFrom(world.rng, CUSTOMER_SHIRTS),
      hair: pickFrom(world.rng, CUSTOMER_HAIR),
    },
  });
  world.nextOrderId += 1;
  world.events.push('order');
}

function addPopup(world, x, y, text, color) {
  world.popups.push({ x, y, text, color, t: 0, life: 1.4 });
}

function addParticles(world, x, y, color, n, speed) {
  for (let i = 0; i < n; i += 1) {
    const a = world.rng() * Math.PI * 2;
    const v = speed * (0.4 + world.rng() * 0.8);
    world.particles.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20,
      t: 0, life: 0.5 + world.rng() * 0.4, color, size: 2 + world.rng() * 3,
    });
  }
}

function say(world, text) {
  world.message = text;
  world.messageT = 2.2;
}

function scoreFor(world, order) {
  const base = RECIPES[order.recipe].base;
  const patienceBonus = Math.round(order.patience);
  const comboMult = Math.min(TUNE.comboMax, 1 + world.combo * TUNE.comboStep);
  const rushMult = world.rush ? TUNE.rushScoreFactor : 1;
  return Math.round((base + patienceBonus) * comboMult * rushMult);
}

function servePlate(world) {
  const plate = world.chef.plate;
  if (!plate) return;
  const idx = world.orders.findIndex((o) => plateMatchesRecipe(plate.items, o.recipe));
  if (idx < 0) {
    // Wrong dish: either not a recipe at all, or a recipe nobody ordered.
    const isRecipe = RECIPE_KEYS.some((key) => plateMatchesRecipe(plate.items, key));
    say(world, isRecipe ? 'No order wants this plate!' : 'Not a recipe! Check the tickets.');
    world.events.push('error');
    return;
  }
  const order = world.orders[idx];
  world.orders.splice(idx, 1);
  world.combo += 1;
  world.bestCombo = Math.max(world.bestCombo, world.combo);
  const points = scoreFor(world, order);
  world.score += points;
  world.served += 1;
  world.servedDishes[order.recipe] = (world.servedDishes[order.recipe] || 0) + 1;
  // Split the points into the results-screen breakdown (sums back to the total).
  const base = RECIPES[order.recipe].base;
  const tips = Math.round(order.patience);
  const raw = base + tips;
  const comboMult = Math.min(TUNE.comboMax, 1 + world.combo * TUNE.comboStep);
  const rushMult = world.rush ? TUNE.rushScoreFactor : 1;
  world.breakdown.base += base;
  world.breakdown.tips += tips;
  world.breakdown.combo += Math.round(raw * (comboMult - 1));
  world.breakdown.rush += Math.round(raw * comboMult * (rushMult - 1));
  const newLevel = Math.min(TUNE.levelMax, 1 + Math.floor(world.served / TUNE.levelEveryServed));
  if (newLevel > world.level) {
    world.level = newLevel;
    say(world, `Level ${newLevel}! Orders come faster.`);
    world.events.push('levelup');
  }
  const st = STATIONS.serve;
  addPopup(world, st.px - 30, st.py - 30, `+${points} pts`, '#ffd54f');
  if (comboMult > 1 || rushMult > 1) {
    const mult = (comboMult * rushMult).toFixed(2).replace(/0$/, '');
    addPopup(world, st.px - 30, st.py - 58, `x${mult}`, '#ff8a65');
  }
  addParticles(world, st.px, st.py, '#ffd54f', 16, 90);
  if (world.combo >= 2) {
    addPopup(world, st.px - 30, st.py - 84, `Combo x${world.combo}!`, '#ff8a65');
    world.comboPopT = 0.9;
  }
  if (world.combo >= 3) world.shakeT = 0.35;
  world.chef.plate = null;
  world.plateOnCounter = { items: [] };
  world.events.push('serve');
}

function useFridge(world) {
  const chef = world.chef;
  if (chef.hands || chef.plate) {
    say(world, chef.plate ? 'Put the plate down first!' : 'Hands full!');
    world.events.push('error');
    return;
  }
  const kind = world.selected;
  const ing = INGREDIENTS[kind];
  chef.hands = { kind, state: ing.prep === 'none' ? 'ready' : 'raw' };
  world.stats.picked += 1;
  world.events.push('pickup');
  addParticles(world, STATIONS.fridge.px, STATIONS.fridge.py, ing.color, 6, 40);
}

function useBoard(world) {
  const chef = world.chef;
  if (world.chopping) return;
  if (!chef.hands) {
    say(world, 'Take an ingredient first!');
    world.events.push('error');
    return;
  }
  const ing = INGREDIENTS[chef.hands.kind];
  if (chef.hands.state !== 'raw' || ing.prep !== 'chop') {
    say(world, `${ing.name} does not need chopping.`);
    world.events.push('error');
    return;
  }
  world.chopping = { kind: chef.hands.kind, t: 0, total: ing.time };
  world.events.push('chop');
}

function useCooker(world, key) {
  const chef = world.chef;
  const slots = world.cookers[key];
  const prep = SLOT_STATIONS[key].prep;
  // Take a ready dish out first.
  const readyIdx = slots.findIndex((s) => s && s.state === 'ready');
  if (readyIdx >= 0 && !chef.hands && !chef.plate) {
    const slot = slots[readyIdx];
    chef.hands = { kind: slot.kind, state: 'ready' };
    slots[readyIdx] = null;
    world.stats.cooked += 1;
    world.events.push('take');
    return;
  }
  // Clear a burnt one.
  const burntIdx = slots.findIndex((s) => s && s.state === 'burnt');
  if (burntIdx >= 0) {
    slots[burntIdx] = null;
    addPopup(world, STATIONS[key].px, STATIONS[key].py - 40, 'Burnt! Binned.', '#ff7043');
    addParticles(world, STATIONS[key].px, STATIONS[key].py - 20, 'rgba(80,80,80,0.8)', 8, 45);
    world.trashed += 1;
    world.events.push('burnt');
    return;
  }
  if (!chef.hands) {
    say(world, 'Nothing cooking here yet.');
    world.events.push('error');
    return;
  }
  const ing = INGREDIENTS[chef.hands.kind];
  if (chef.hands.state !== 'raw' || ing.prep !== prep) {
    const stationName = STATIONS[key].label;
    say(world, `${ing.name} does not go on the ${stationName}.`);
    world.events.push('error');
    return;
  }
  const freeIdx = slots.findIndex((s) => s === null);
  if (freeIdx < 0) {
    say(world, 'No free space here!');
    world.events.push('error');
    return;
  }
  slots[freeIdx] = { kind: chef.hands.kind, t: 0, state: 'cooking' };
  chef.hands = null;
  world.events.push('place');
}

function usePlating(world) {
  const chef = world.chef;
  if (chef.plate) {
    if (world.plateOnCounter === null) {
      world.plateOnCounter = chef.plate;
      chef.plate = null;
      world.events.push('place');
    }
    return;
  }
  if (chef.hands) {
    if (chef.hands.state !== 'ready') {
      say(world, 'Finish preparing it first!');
      world.events.push('error');
      return;
    }
    if (world.plateOnCounter === null) world.plateOnCounter = { items: [] };
    const plate = world.plateOnCounter;
    if (plate.items.length >= 3) {
      say(world, 'The plate is full!');
      world.events.push('error');
      return;
    }
    if (plate.items.includes(chef.hands.kind)) {
      say(world, 'That is already on the plate.');
      world.events.push('error');
      return;
    }
    plate.items.push(chef.hands.kind);
    chef.hands = null;
    world.events.push('plate');
    addParticles(world, STATIONS.plating.px, STATIONS.plating.py - 10, '#fff176', 8, 50);
    return;
  }
  // Empty hands: pick the plate up.
  if (world.plateOnCounter && world.plateOnCounter.items.length > 0) {
    chef.plate = world.plateOnCounter;
    world.plateOnCounter = null;
    world.events.push('pickup');
  }
}

function useTrash(world) {
  const chef = world.chef;
  if (chef.hands) {
    chef.hands = null;
    world.trashed += 1;
    world.events.push('trash');
    return;
  }
  if (chef.plate) {
    chef.plate.items = [];
    world.trashed += 1;
    say(world, 'Plate cleared.');
    world.events.push('trash');
  }
}

function interact(world) {
  const key = nearestStation(world.chef);
  if (!key) return;
  if (key === 'fridge') useFridge(world);
  else if (key === 'board') useBoard(world);
  else if (key === 'stove' || key === 'grill' || key === 'oven') useCooker(world, key);
  else if (key === 'plating') usePlating(world);
  else if (key === 'serve') servePlate(world);
  else if (key === 'trash') useTrash(world);
}

function collideStations(world) {
  const chef = world.chef;
  for (const st of Object.values(STATIONS)) {
    const x0 = st.x - CHEF_R;
    const x1 = st.x + st.w + CHEF_R;
    const y0 = st.y - CHEF_R;
    const y1 = st.y + st.h + CHEF_R;
    if (chef.x > x0 && chef.x < x1 && chef.y > y0 && chef.y < y1) {
      const pushLeft = chef.x - x0;
      const pushRight = x1 - chef.x;
      const pushUp = chef.y - y0;
      const pushDown = y1 - chef.y;
      const min = Math.min(pushLeft, pushRight, pushUp, pushDown);
      if (min === pushLeft) chef.x = x0;
      else if (min === pushRight) chef.x = x1;
      else if (min === pushUp) chef.y = y0;
      else chef.y = y1;
    }
  }
}

/**
 * Advance the world by dt seconds. action: { mx, my, interact, select }.
 * Returns EVENT_OVER when the shift ends, else 0.
 */
export function stepWorld(world, dt, action) {
  if (world.over) return EVENT_OVER;
  world.events.length = 0;

  world.time += dt;
  world.timeLeft = Math.max(0, SHIFT_SECONDS - world.time);
  const wasRush = world.rush;
  world.rush = world.timeLeft <= 40 && world.timeLeft > 0;
  if (world.rush) world.rushT += dt;
  else world.rushT = 0;
  if (world.rush && !wasRush) {
    say(world, 'RUSH HOUR! Orders fly in — 1.5x points!');
    world.events.push('rush');
  }
  if (world.shakeT > 0) world.shakeT -= dt;
  if (world.comboPopT > 0) world.comboPopT -= dt;

  // Orders arrive.
  world.spawnTimer -= dt;
  if (world.spawnTimer <= 0 && world.orders.length < orderSlots(world)) {
    spawnOrder(world);
    world.spawnTimer = spawnInterval(world);
  }
  // Patience runs out.
  for (let i = world.orders.length - 1; i >= 0; i -= 1) {
    const order = world.orders[i];
    order.patience -= dt;
    if (order.patience <= 0) {
      world.orders.splice(i, 1);
      world.expired += 1;
      world.combo = 0;
      addPopup(world, 480, 130, `Lost: ${RECIPES[order.recipe].name}`, '#ff7043');
      say(world, `An order for ${RECIPES[order.recipe].name} walked out!`);
      world.events.push('expire');
    }
  }

  // Chopping channel: keep going only while the chef stays at the board.
  if (world.chopping) {
    const near = nearestStation(world.chef) === 'board';
    if (!near) {
      world.chopping = null;
    } else {
      world.chopping.t += dt;
      world.chef.chopSwing += dt * 14;
      if (world.rng() < 0.4) {
        // Wood chips fly off the board, with a fleck of the ingredient.
        const bx = STATIONS.board.px + (world.rng() - 0.5) * 60;
        addParticles(world, bx, STATIONS.board.py - 6,
          world.rng() < 0.6 ? '#b08968' : INGREDIENTS[world.chopping.kind].color, 1, 70);
      }
      if (world.chopping.t >= world.chopping.total) {
        if (world.chef.hands) world.chef.hands.state = 'ready';
        world.stats.chopped += 1;
        world.events.push('chopdone');
        world.chopping = null;
      }
    }
  }

  // Cooking slots.
  for (const [key, slots] of Object.entries(world.cookers)) {
    for (let i = 0; i < slots.length; i += 1) {
      const slot = slots[i];
      if (!slot) continue;
      slot.t += dt;
      const ing = INGREDIENTS[slot.kind];
      if (slot.state === 'cooking' && slot.t >= ing.time) {
        slot.state = 'ready';
        world.events.push('ready');
        // Sparkles burst from the food itself, not from the station's
        // label line below the counter.
        addParticles(world, STATIONS[key].px, STATIONS[key].y + STATIONS[key].h / 2, '#fff176', 6, 40);
      } else if (slot.state === 'ready' && slot.t >= ing.time + TUNE.burnGraceSeconds) {
        slot.state = 'burnt';
        world.events.push('burnt');
        addPopup(world, STATIONS[key].px, STATIONS[key].py - 40, 'Burning!', '#ff7043');
        // A puff of dark smoke as it burns.
        addParticles(world, STATIONS[key].px, STATIONS[key].py - 20, 'rgba(80,80,80,0.8)', 10, 50);
      }
      // Steam while cooking: rises off the food, above the counter, so it
      // never drifts across the station label underneath.
      if (slot.state === 'cooking' && world.rng() < 0.1) {
        world.particles.push({
          x: STATIONS[key].px + (world.rng() - 0.5) * 80, y: STATIONS[key].y + STATIONS[key].h / 2,
          vx: (world.rng() - 0.5) * 10, vy: -30, t: 0, life: 0.9, color: 'rgba(255,255,255,0.7)', size: 3,
        });
      }
      if (key === 'grill' && slot.state === 'cooking' && world.rng() < 0.22) {
        world.particles.push({
          x: STATIONS[key].px + (world.rng() - 0.5) * 90, y: STATIONS[key].py + 8,
          vx: (world.rng() - 0.5) * 30, vy: -55 - world.rng() * 40, t: 0, life: 0.4 + world.rng() * 0.3,
          color: world.rng() < 0.5 ? '#ff9800' : '#ffeb3b', size: 2 + world.rng() * 2,
        });
      }
      // Burnt food keeps smoking.
      if (slot.state === 'burnt' && world.rng() < 0.12) {
        world.particles.push({
          x: STATIONS[key].px + (world.rng() - 0.5) * 60, y: STATIONS[key].py - 14,
          vx: (world.rng() - 0.5) * 8, vy: -24, t: 0, life: 1.1, color: 'rgba(90,90,90,0.65)', size: 4,
        });
      }
    }
  }

  // Chef movement.
  const chef = world.chef;
  if (action) {
    if (action.select) world.selected = action.select;
    const mx = action.mx || 0;
    const my = action.my || 0;
    if (mx !== 0 || my !== 0) {
      const len = Math.hypot(mx, my);
      chef.x += (mx / len) * CHEF_SPEED * dt;
      chef.y += (my / len) * CHEF_SPEED * dt;
      if (mx !== 0) chef.face = mx > 0 ? 1 : -1;
      chef.moving = true;
      chef.bob += dt * 11;
    } else {
      chef.moving = false;
    }
    chef.x = Math.min(936, Math.max(24, chef.x));
    chef.y = Math.min(576, Math.max(HUD_H + 24, chef.y));
    collideStations(world);
    if (action.interact) interact(world);
  }

  // Popups and particles.
  for (let i = world.popups.length - 1; i >= 0; i -= 1) {
    const p = world.popups[i];
    p.t += dt;
    if (p.t >= p.life) world.popups.splice(i, 1);
  }
  for (let i = world.particles.length - 1; i >= 0; i -= 1) {
    const p = world.particles[i];
    p.t += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.t >= p.life) world.particles.splice(i, 1);
  }
  if (world.messageT > 0) {
    world.messageT -= dt;
    if (world.messageT <= 0) world.message = null;
  }

  if (world.timeLeft <= 0) {
    world.over = true;
    world.events.push('over');
    return EVENT_OVER;
  }
  return 0;
}

/** Fresh world for a new shift, with two starter orders already on the board. */
export function resetWorld(world) {
  const fresh = createWorld(world.seed);
  Object.keys(world).forEach((k) => delete world[k]);
  Object.assign(world, fresh);
  spawnOrder(world);
  spawnOrder(world);
  world.spawnTimer = spawnInterval(world);
}
