// Sizzle & Serve — deterministic screenshot scenes behind ?shot=start|play|rush|end.
// Each scene plays the real rules forward from a fresh world for a fixed number of
// steps, steered by a simple autopilot (work the oldest order: fetch what the plate
// still needs, prep it at the right station, plate it, serve it), so the frame is
// what a short game really looks like and the same seed always gives the same frame.
import { INGREDIENTS, STATIONS, STEP } from './config.js';
import { RECIPES } from './config.js';
import { EVENT_OVER, nearestStation, plateMatchesRecipe, resetWorld, stepWorld } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 26;
const RUSH_SECONDS = 112;
const RUSH_EXTRA_SECONDS = 25;
const END_LIMIT_SECONDS = 600;
const PREP_STATION = { chop: 'board', boil: 'stove', grill: 'grill', bake: 'oven' };

function moveToward(world, x, y) {
  const dx = x - world.chef.x;
  const dy = y - world.chef.y;
  const d = Math.hypot(dx, dy);
  if (d < 10) return { mx: 0, my: 0 };
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
 */
function autopilot(world) {
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
    const m = moveToward(world, 480, 330);
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
 * Set `world` to the named scene (start, play, rush or end; any other name is start)
 * and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  resetWorld(world);
  if (name !== 'play' && name !== 'rush' && name !== 'end') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) stepWorld(world, STEP, autopilot(world));
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'play') {
    for (let i = 0; i < PLAY_SECONDS / STEP; i += 1) {
      if (stepWorld(world, STEP, autopilot(world)) & EVENT_OVER) break;
    }
    return { screen: world.over ? SCREEN_OVER : SCREEN_PLAY, best: world.score };
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
    return { screen: world.over ? SCREEN_OVER : SCREEN_PLAY, best: world.score };
  }
  for (let i = 0; i < END_LIMIT_SECONDS / STEP; i += 1) {
    if (stepWorld(world, STEP, autopilot(world)) & EVENT_OVER) break;
  }
  return { screen: world.over ? SCREEN_OVER : SCREEN_PLAY, best: world.score };
}
