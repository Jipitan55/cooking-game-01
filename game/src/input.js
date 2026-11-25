// Sizzle & Serve — keyboard and mouse input.
// WASD / arrows move the chef, E or Space uses the nearest station, 1-0/Q/W pick the
// fridge ingredient, Enter starts / restarts, P pauses, M mutes. Clicking a station
// walks the chef there and uses it; clicking a fridge bin picks that ingredient.
import { FRIDGE_ORDER, INGREDIENTS, STATIONS } from './config.js';
import { nearestStation } from './world.js';

export function createInput(canvas) {
  const input = {
    keys: new Set(),
    interactPressed: false,
    clickTarget: null, // { x, y, station, select }
    mouse: { x: 0, y: 0 },
    paused: false,
  };

  function canvasPoint(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * 960,
      y: ((clientY - rect.top) / rect.height) * 600,
    };
  }

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    input.keys.add(k);
    if (k === 'e' || k === ' ') {
      input.interactPressed = true;
      e.preventDefault();
    }
    if (k === 'p') input.paused = !input.paused;
  });
  window.addEventListener('keyup', (e) => {
    input.keys.delete(e.key.toLowerCase());
  });
  window.addEventListener('blur', () => input.keys.clear());

  canvas.addEventListener('mousemove', (e) => {
    input.mouse = canvasPoint(e.clientX, e.clientY);
  });
  canvas.addEventListener('click', (e) => {
    const p = canvasPoint(e.clientX, e.clientY);
    // A fridge bin click picks that ingredient.
    const fridge = STATIONS.fridge;
    if (p.x >= fridge.x && p.x <= fridge.x + fridge.w && p.y >= fridge.y && p.y <= fridge.y + fridge.h) {
      const idx = Math.min(FRIDGE_ORDER.length - 1,
        Math.max(0, Math.floor((p.y - fridge.y) / (fridge.h / FRIDGE_ORDER.length))));
      input.clickTarget = { x: fridge.px, y: fridge.py, station: 'fridge', select: FRIDGE_ORDER[idx] };
      return;
    }
    // Any other station click walks there and uses it.
    for (const [key, st] of Object.entries(STATIONS)) {
      if (p.x >= st.x && p.x <= st.x + st.w && p.y >= st.y && p.y <= st.y + st.h) {
        input.clickTarget = { x: st.px, y: st.py, station: key, select: null };
        return;
      }
    }
    // Empty floor click: just walk there.
    input.clickTarget = { x: p.x, y: p.y, station: null, select: null };
  });

  return input;
}

/** Fridge ingredient selected by a number/letter key this frame, or null. */
export function keySelectedIngredient(input) {
  for (const kind of FRIDGE_ORDER) {
    if (input.keys.has(INGREDIENTS[kind].key)) return kind;
  }
  return null;
}

/**
 * Build this frame's action { mx, my, interact, select } for the world.
 * Click-to-walk overrides keys while a click target is active; arriving at a
 * station target auto-uses it once.
 */
export function readAction(input, world) {
  let mx = 0;
  let my = 0;
  const k = input.keys;
  if (k.has('a') || k.has('arrowleft')) mx -= 1;
  if (k.has('d') || k.has('arrowright')) mx += 1;
  if (k.has('w') || k.has('arrowup')) my -= 1;
  if (k.has('s') || k.has('arrowdown')) my += 1;

  let interact = input.interactPressed;
  input.interactPressed = false;
  let select = keySelectedIngredient(input);

  if (input.clickTarget) {
    const t = input.clickTarget;
    const dx = t.x - world.chef.x;
    const dy = t.y - world.chef.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 14) {
      mx = dx / dist;
      my = dy / dist;
    } else {
      if (t.station) {
        if (t.select) select = t.select;
        // Only auto-use when the target station is the nearest one.
        if (nearestStation(world.chef) === t.station) interact = true;
      }
      input.clickTarget = null;
    }
  }
  return { mx, my, interact, select };
}
