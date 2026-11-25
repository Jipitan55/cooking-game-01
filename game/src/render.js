// Sizzle & Serve — all canvas drawing: the kitchen, the food, the chef, the
// order board, the timer, and the title / game-over screens. No assets: every
// ingredient is drawn from shapes, so the game loads nothing over the network.
import {
  BISTRO_NAME, FRIDGE_ORDER, GAME_NAME, H, HUD_H, INGREDIENTS, RECIPES,
  STATIONS, W,
} from './config.js';
import { nearestStation, plateMatchesRecipe } from './world.js';

const FONT = '"Trebuchet MS", Verdana, sans-serif';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function text(ctx, s, x, y, size, color, align, weight) {
  ctx.fillStyle = color;
  ctx.font = `${weight || 'bold'} ${size}px ${FONT}`;
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
}

function circle(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function ellipse(ctx, x, y, rx, ry, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Draw one ingredient as vector food, centred at (x, y) with radius r. */
export function drawIngredient(ctx, kind, x, y, r, state) {
  const ing = INGREDIENTS[kind];
  ctx.save();
  if (state === 'raw') ctx.globalAlpha = 0.82;
  switch (kind) {
    case 'tomato': {
      circle(ctx, x, y, r, ing.color);
      ctx.fillStyle = '#fff';
      ctx.globalAlpha *= 1;
      ctx.beginPath();
      ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2e7d32';
      for (let i = 0; i < 5; i += 1) {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
        ctx.beginPath();
        ctx.moveTo(x, y - r * 0.55);
        ctx.lineTo(x + Math.cos(a) * r * 0.5, y - r * 0.55 + Math.sin(a) * r * 0.5);
        ctx.lineTo(x + Math.cos(a + 0.5) * r * 0.28, y - r * 0.55 + Math.sin(a + 0.5) * r * 0.28);
        ctx.fill();
      }
      break;
    }
    case 'lettuce': {
      circle(ctx, x, y, r, '#7bc96f');
      circle(ctx, x - r * 0.4, y - r * 0.2, r * 0.55, ing.color);
      circle(ctx, x + r * 0.4, y + r * 0.15, r * 0.5, '#6abf5e');
      ctx.strokeStyle = '#2f7d3d';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, r * 0.55, 0.3, 2.4);
      ctx.stroke();
      break;
    }
    case 'cucumber': {
      circle(ctx, x, y, r, '#2e7d32');
      circle(ctx, x, y, r * 0.72, '#a5d6a7');
      ctx.fillStyle = '#e8f5e9';
      for (let i = 0; i < 5; i += 1) {
        const a = (i * Math.PI * 2) / 5;
        circle(ctx, x + Math.cos(a) * r * 0.35, y + Math.sin(a) * r * 0.35, r * 0.1, '#e8f5e9');
      }
      break;
    }
    case 'lemon': {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-0.4);
      ellipse(ctx, 0, 0, r * 1.15, r * 0.8, ing.color);
      ctx.fillStyle = '#fff59d';
      ellipse(ctx, 0, 0, r * 0.8, r * 0.5, '#fff59d');
      ctx.restore();
      break;
    }
    case 'mushroom': {
      ctx.fillStyle = '#efebe9';
      rr(ctx, x - r * 0.28, y - r * 0.1, r * 0.56, r * 0.75, r * 0.2);
      ctx.fill();
      ctx.fillStyle = '#a1887f';
      ctx.beginPath();
      ctx.arc(x, y - r * 0.15, r * 0.95, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#efebe9';
      circle(ctx, x - r * 0.4, y - r * 0.5, r * 0.14, '#efebe9');
      circle(ctx, x + r * 0.3, y - r * 0.7, r * 0.12, '#efebe9');
      break;
    }
    case 'cheese': {
      ctx.fillStyle = ing.color;
      ctx.beginPath();
      ctx.moveTo(x - r, y + r * 0.7);
      ctx.lineTo(x + r, y + r * 0.7);
      ctx.lineTo(x + r * 0.7, y - r * 0.7);
      ctx.lineTo(x - r * 0.7, y - r * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = ing.dark;
      circle(ctx, x - r * 0.2, y + r * 0.3, r * 0.16, ing.dark);
      circle(ctx, x + r * 0.35, y + r * 0.05, r * 0.12, ing.dark);
      break;
    }
    case 'basil': {
      ctx.fillStyle = '#43a047';
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-0.5);
      ellipse(ctx, 0, 0, r * 0.9, r * 0.5, '#43a047');
      ctx.rotate(1.0);
      ellipse(ctx, 0, 0, r * 0.9, r * 0.5, '#2e7d32');
      ctx.restore();
      break;
    }
    case 'berries': {
      circle(ctx, x - r * 0.45, y + r * 0.2, r * 0.5, ing.color);
      circle(ctx, x + r * 0.45, y + r * 0.25, r * 0.5, '#ab47bc');
      circle(ctx, x, y - r * 0.45, r * 0.55, ing.dark);
      ctx.fillStyle = '#fff';
      circle(ctx, x - r * 0.15, y - r * 0.6, r * 0.12, '#fff');
      break;
    }
    case 'pasta': {
      ctx.strokeStyle = ing.color;
      ctx.lineWidth = r * 0.28;
      ctx.lineCap = 'round';
      for (let i = -1; i <= 1; i += 1) {
        ctx.beginPath();
        ctx.moveTo(x - r, y + i * r * 0.45);
        ctx.quadraticCurveTo(x - r * 0.3, y + i * r * 0.45 - r * 0.5, x + r * 0.3, y + i * r * 0.45);
        ctx.quadraticCurveTo(x + r * 0.8, y + i * r * 0.45 + r * 0.4, x + r, y + i * r * 0.45);
        ctx.stroke();
      }
      break;
    }
    case 'rice': {
      ctx.fillStyle = '#fffde7';
      ctx.beginPath();
      ctx.arc(x, y + r * 0.4, r * 0.95, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#d7ccc8';
      circle(ctx, x - r * 0.4, y - r * 0.1, r * 0.09, '#d7ccc8');
      circle(ctx, x + r * 0.3, y - r * 0.3, r * 0.09, '#d7ccc8');
      circle(ctx, x + r * 0.1, y + r * 0.1, r * 0.09, '#d7ccc8');
      break;
    }
    case 'fish': {
      ellipse(ctx, x, y, r * 1.05, r * 0.55, ing.color);
      ctx.fillStyle = ing.color;
      ctx.beginPath();
      ctx.moveTo(x - r * 0.9, y);
      ctx.lineTo(x - r * 1.5, y - r * 0.5);
      ctx.lineTo(x - r * 1.5, y + r * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#263238';
      circle(ctx, x + r * 0.6, y - r * 0.1, r * 0.12, '#263238');
      ctx.strokeStyle = ing.dark;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x - r * 0.2, y - r * 0.4);
      ctx.lineTo(x - r * 0.2, y + r * 0.4);
      ctx.stroke();
      break;
    }
    case 'dough': {
      ellipse(ctx, x, y, r, r * 0.7, ing.color);
      ctx.fillStyle = '#fff';
      circle(ctx, x - r * 0.3, y - r * 0.2, r * 0.12, '#fff');
      circle(ctx, x + r * 0.25, y + r * 0.1, r * 0.1, '#fff');
      break;
    }
    default:
      circle(ctx, x, y, r, ing.color);
  }
  ctx.restore();
  if (state === 'raw') {
    ctx.fillStyle = 'rgba(120,120,120,0.25)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  if (state === 'ready') {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.moveTo(x + r * 0.55, y - r * 0.9);
    ctx.lineTo(x + r * 0.75, y - r * 0.55);
    ctx.lineTo(x + r * 0.95, y - r * 0.9);
    ctx.lineTo(x + r * 0.75, y - r * 0.7);
    ctx.closePath();
    ctx.fill();
  }
}

/** A white plate, with its items arranged on it. */
function drawPlate(ctx, x, y, items, scale) {
  const s = scale || 1;
  ellipse(ctx, x, y, 34 * s, 12 * s, '#eceff1');
  ellipse(ctx, x, y - 3 * s, 30 * s, 10 * s, '#ffffff');
  ctx.strokeStyle = '#b0bec5';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(x, y - 3 * s, 30 * s, 10 * s, 0, 0, Math.PI * 2);
  ctx.stroke();
  const spots = [[-14, -8], [12, -10], [0, -2]];
  items.forEach((kind, i) => {
    const spot = spots[i % spots.length];
    drawIngredient(ctx, kind, x + spot[0] * s, y + spot[1] * s, 11 * s, 'ready');
  });
}

function drawStationLabel(ctx, st, highlight) {
  ctx.fillStyle = highlight ? '#ffd54f' : 'rgba(255,255,255,0.92)';
  ctx.font = `bold 13px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(st.label.toUpperCase(), st.x + st.w / 2, st.y + st.h + 12);
}

function drawFridge(ctx, world) {
  const st = STATIONS.fridge;
  const near = nearestStation(world.chef) === 'fridge';
  ctx.fillStyle = '#90a4ae';
  rr(ctx, st.x, st.y, st.w, st.h, 8);
  ctx.fill();
  ctx.fillStyle = '#b0bec5';
  rr(ctx, st.x + 4, st.y + 4, st.w - 8, st.h - 8, 6);
  ctx.fill();
  const cols = 2;
  const rows = 6;
  const cw = (st.w - 12) / cols;
  const ch = (st.h - 12) / rows;
  FRIDGE_ORDER.forEach((kind, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = st.x + 6 + cw * (col + 0.5);
    const cy = st.y + 6 + ch * (row + 0.5);
    if (world.selected === kind) {
      ctx.fillStyle = '#ffd54f';
      rr(ctx, cx - cw / 2 + 2, cy - ch / 2 + 2, cw - 4, ch - 4, 5);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    rr(ctx, cx - cw / 2 + 4, cy - ch / 2 + 4, cw - 8, ch - 8, 4);
    ctx.fill();
    drawIngredient(ctx, kind, cx, cy, 11, INGREDIENTS[kind].prep === 'none' ? 'ready' : 'raw');
  });
  drawStationLabel(ctx, st, near);
  const sel = INGREDIENTS[world.selected];
  text(ctx, sel.name, st.x + st.w / 2, st.y + st.h + 28, 12, '#fff', 'center');
}

function drawBoard(ctx, world) {
  const st = STATIONS.board;
  const near = nearestStation(world.chef) === 'board';
  ctx.fillStyle = '#8d6e63';
  rr(ctx, st.x, st.y, st.w, st.h, 6);
  ctx.fill();
  ctx.fillStyle = '#d7ccc8';
  rr(ctx, st.x + 14, st.y + 8, st.w - 28, st.h - 16, 6);
  ctx.fill();
  if (world.chopping) {
    const c = world.chopping;
    drawIngredient(ctx, c.kind, st.x + st.w / 2 - 18, st.y + st.h / 2, 13, 'raw');
    // Chopping progress bar.
    const pct = Math.min(1, c.t / c.total);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    rr(ctx, st.x + 20, st.y - 14, st.w - 40, 9, 4);
    ctx.fill();
    ctx.fillStyle = '#ffd54f';
    rr(ctx, st.x + 20, st.y - 14, (st.w - 40) * pct, 9, 4);
    ctx.fill();
    // Knife.
    ctx.fillStyle = '#eceff1';
    ctx.beginPath();
    ctx.moveTo(st.x + st.w - 46, st.y + 12);
    ctx.lineTo(st.x + st.w - 22, st.y + 12);
    ctx.lineTo(st.x + st.w - 30, st.y + 26);
    ctx.lineTo(st.x + st.w - 46, st.y + 26);
    ctx.closePath();
    ctx.fill();
  }
  drawStationLabel(ctx, st, near);
}

function drawCooker(ctx, world, key) {
  const st = STATIONS[key];
  const near = nearestStation(world.chef) === key;
  const base = key === 'stove' ? '#37474f' : key === 'grill' ? '#4e342e' : '#5d4037';
  ctx.fillStyle = base;
  rr(ctx, st.x, st.y, st.w, st.h, 6);
  ctx.fill();
  const slots = world.cookers[key];
  const slotW = (st.w - 24) / slots.length;
  slots.forEach((slot, i) => {
    const cx = st.x + 12 + slotW * (i + 0.5);
    const cy = st.y + st.h / 2;
    if (key === 'stove') {
      circle(ctx, cx, cy, 24, '#263238');
      circle(ctx, cx, cy, 19, '#90a4ae');
      if (slot) {
        circle(ctx, cx, cy, 15, slot.state === 'burnt' ? '#3e2723' : '#bcaaa4');
        drawIngredient(ctx, slot.kind, cx, cy, 11, slot.state === 'ready' ? 'ready' : 'raw');
      }
    } else if (key === 'grill') {
      ctx.fillStyle = '#263238';
      rr(ctx, cx - slotW / 2 + 6, cy - 18, slotW - 12, 36, 5);
      ctx.fill();
      ctx.strokeStyle = '#78909c';
      ctx.lineWidth = 2;
      for (let g = -1; g <= 1; g += 1) {
        ctx.beginPath();
        ctx.moveTo(cx - slotW / 2 + 10, cy + g * 9);
        ctx.lineTo(cx + slotW / 2 - 10, cy + g * 9);
        ctx.stroke();
      }
      if (slot) {
        if (slot.state === 'cooking') {
          ctx.fillStyle = '#ff7043';
          ctx.beginPath();
          ctx.moveTo(cx - 10, cy + 14);
          ctx.lineTo(cx, cy - 2);
          ctx.lineTo(cx + 10, cy + 14);
          ctx.closePath();
          ctx.fill();
        }
        drawIngredient(ctx, slot.kind, cx, cy - 4, 12, slot.state === 'ready' ? 'ready' : 'raw');
      }
    } else {
      // Oven: door with a window.
      ctx.fillStyle = '#263238';
      rr(ctx, cx - slotW / 2 + 6, cy - 20, slotW - 12, 40, 5);
      ctx.fill();
      ctx.fillStyle = slot && slot.state === 'cooking' ? '#ffca28' : '#455a64';
      rr(ctx, cx - slotW / 2 + 12, cy - 12, slotW - 24, 16, 3);
      ctx.fill();
      if (slot) drawIngredient(ctx, slot.kind, cx, cy + 12, 9, slot.state === 'ready' ? 'ready' : 'raw');
    }
    if (slot) {
      const ing = INGREDIENTS[slot.kind];
      const pct = Math.min(1, slot.t / ing.time);
      const color = slot.state === 'burnt' ? '#ff7043' : slot.state === 'ready' ? '#66bb6a' : '#ffd54f';
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      rr(ctx, cx - 22, st.y - 13, 44, 7, 3);
      ctx.fill();
      ctx.fillStyle = color;
      rr(ctx, cx - 22, st.y - 13, 44 * pct, 7, 3);
      ctx.fill();
      if (slot.state === 'ready') text(ctx, 'READY!', cx, st.y - 24, 11, '#66bb6a', 'center');
      if (slot.state === 'burnt') text(ctx, 'BURNT!', cx, st.y - 24, 11, '#ff7043', 'center');
    }
  });
  drawStationLabel(ctx, st, near);
}

function drawPlating(ctx, world) {
  const st = STATIONS.plating;
  const near = nearestStation(world.chef) === 'plating';
  ctx.fillStyle = '#8d6e63';
  rr(ctx, st.x, st.y, st.w, st.h, 6);
  ctx.fill();
  if (world.plateOnCounter) {
    drawPlate(ctx, st.x + st.w / 2, st.y + st.h / 2 + 4, world.plateOnCounter.items, 1);
    if (world.plateOnCounter.items.length > 0) {
      const match = world.orders.some((o) => plateMatchesRecipe(world.plateOnCounter.items, o.recipe));
      text(ctx, match ? 'READY TO SERVE!' : 'PLATING…', st.x + st.w / 2, st.y - 12, 12,
        match ? '#66bb6a' : '#fff', 'center');
    }
  }
  drawStationLabel(ctx, st, near);
}

function drawServe(ctx, world) {
  const st = STATIONS.serve;
  const near = nearestStation(world.chef) === 'serve';
  ctx.fillStyle = '#6d4c41';
  rr(ctx, st.x, st.y, st.w, st.h, 8);
  ctx.fill();
  ctx.fillStyle = '#ffe082';
  rr(ctx, st.x + 8, st.y + 8, st.w - 16, st.h - 16, 5);
  ctx.fill();
  ctx.fillStyle = '#ffca28';
  ctx.beginPath();
  ctx.arc(st.x + st.w / 2, st.y + 26, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#6d4c41';
  ctx.fillRect(st.x + st.w / 2 - 1, st.y + 34, 2, 8);
  drawStationLabel(ctx, st, near);
}

function drawTrash(ctx, world) {
  const st = STATIONS.trash;
  const near = nearestStation(world.chef) === 'trash';
  ctx.fillStyle = '#78909c';
  rr(ctx, st.x + 8, st.y + 4, st.w - 16, st.h - 8, 5);
  ctx.fill();
  ctx.fillStyle = '#546e7a';
  rr(ctx, st.x, st.y, st.w, 10, 4);
  ctx.fill();
  drawStationLabel(ctx, st, near);
}

function drawChef(ctx, world) {
  const c = world.chef;
  ellipse(ctx, c.x, c.y + 20, 20, 7, 'rgba(0,0,0,0.25)');
  // Body / apron.
  ctx.fillStyle = '#eceff1';
  rr(ctx, c.x - 15, c.y - 6, 30, 30, 10);
  ctx.fill();
  ctx.fillStyle = '#90caf9';
  rr(ctx, c.x - 15, c.y + 8, 30, 8, 4);
  ctx.fill();
  // Head.
  circle(ctx, c.x, c.y - 16, 13, '#ffccbc');
  // Chef hat.
  ctx.fillStyle = '#ffffff';
  circle(ctx, c.x - 9, c.y - 28, 7, '#ffffff');
  circle(ctx, c.x, c.y - 31, 8, '#ffffff');
  circle(ctx, c.x + 9, c.y - 28, 7, '#ffffff');
  rr(ctx, c.x - 12, c.y - 28, 24, 7, 3);
  ctx.fill();
  // Eyes.
  ctx.fillStyle = '#263238';
  circle(ctx, c.x - 5 + c.face * 2, c.y - 16, 1.8, '#263238');
  circle(ctx, c.x + 5 + c.face * 2, c.y - 16, 1.8, '#263238');
  // Item in hand, held up.
  if (c.hands) {
    drawIngredient(ctx, c.hands.kind, c.x + c.face * 22, c.y - 14, 13, c.hands.state);
    text(ctx, INGREDIENTS[c.hands.kind].name, c.x, c.y - 46, 11, '#fff', 'center');
  }
  // Carried plate.
  if (c.plate) {
    drawPlate(ctx, c.x + c.face * 24, c.y + 2, c.plate.items, 0.9);
  }
}

function drawOrderTicket(ctx, order, x, y, w, h) {
  const recipe = RECIPES[order.recipe];
  const frac = Math.max(0, order.patience / order.max);
  const urgent = frac < 0.35;
  ctx.fillStyle = urgent ? '#ffecb3' : '#fff8e1';
  rr(ctx, x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = urgent ? '#ff7043' : '#d7ccc8';
  ctx.lineWidth = urgent ? 2.5 : 1.5;
  rr(ctx, x, y, w, h, 8);
  ctx.stroke();
  text(ctx, `#${order.id} ${recipe.name}`, x + 10, y + 15, 13, '#4e342e', 'left');
  recipe.ingredients.forEach((kind, i) => {
    drawIngredient(ctx, kind, x + 22 + i * 34, y + 42, 12, 'ready');
  });
  text(ctx, `$${recipe.base}`, x + w - 10, y + 42, 13, '#6d4c41', 'right');
  // Patience bar.
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  rr(ctx, x + 10, y + h - 14, w - 20, 7, 3);
  ctx.fill();
  ctx.fillStyle = frac > 0.5 ? '#66bb6a' : frac > 0.25 ? '#ffb300' : '#ff7043';
  rr(ctx, x + 10, y + h - 14, (w - 20) * frac, 7, 3);
  ctx.fill();
  text(ctx, `${Math.ceil(order.patience)}s`, x + w - 10, y + h - 26, 11, urgent ? '#d32f2f' : '#6d4c41', 'right');
}

function drawHud(ctx, world) {
  // Order board background.
  ctx.fillStyle = '#4e342e';
  ctx.fillRect(0, 0, W, HUD_H);
  ctx.fillStyle = '#6d4c41';
  ctx.fillRect(0, HUD_H - 4, W, 4);
  const ticketW = 168;
  const gap = 6;
  world.orders.forEach((order, i) => {
    drawOrderTicket(ctx, order, 8 + i * (ticketW + gap), 8, ticketW, 80);
  });
  if (world.orders.length === 0) {
    text(ctx, 'No orders — take a breath!', 12, 48, 15, '#d7ccc8', 'left');
  }
  // Timer panel.
  const tx = 706;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  rr(ctx, tx, 8, 106, 80, 8);
  ctx.fill();
  const mins = Math.floor(world.timeLeft / 60);
  const secs = Math.floor(world.timeLeft % 60);
  const timeStr = `${mins}:${String(secs).padStart(2, '0')}`;
  text(ctx, 'TIME', tx + 53, 22, 11, '#d7ccc8', 'center');
  text(ctx, timeStr, tx + 53, 48, 26, world.timeLeft <= 30 ? '#ff7043' : '#ffffff', 'center');
  const shiftFrac = world.timeLeft / 150;
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  rr(ctx, tx + 10, 72, 86, 6, 3);
  ctx.fill();
  ctx.fillStyle = world.timeLeft <= 30 ? '#ff7043' : '#66bb6a';
  rr(ctx, tx + 10, 72, 86 * shiftFrac, 6, 3);
  ctx.fill();
  // Score panel.
  const sx = 820;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  rr(ctx, sx, 8, 132, 80, 8);
  ctx.fill();
  text(ctx, 'SCORE', sx + 66, 22, 11, '#d7ccc8', 'center');
  text(ctx, `${world.score}`, sx + 66, 46, 24, '#ffd54f', 'center');
  text(ctx, `LV ${world.level}  •  Combo x${world.combo}`, sx + 66, 72, 12, '#ffffff', 'center');
}

function drawFloor(ctx) {
  ctx.fillStyle = '#f5e6c8';
  ctx.fillRect(0, HUD_H, W, H - HUD_H);
  const tile = 48;
  ctx.fillStyle = '#eed9ae';
  for (let y = HUD_H; y < H; y += tile) {
    for (let x = 0; x < W; x += tile) {
      if (((x / tile) + (y / tile)) % 2 === 0) ctx.fillRect(x, y, tile, tile);
    }
  }
  // Wall strip under the HUD.
  ctx.fillStyle = '#bcaaa4';
  ctx.fillRect(0, HUD_H, W, 14);
  ctx.fillStyle = '#8d6e63';
  ctx.fillRect(0, HUD_H + 12, W, 2);
}

function drawOverlays(ctx, screen, world, best) {
  if (screen === 'title') {
    ctx.fillStyle = 'rgba(40,20,10,0.55)';
    ctx.fillRect(0, 0, W, H);
    text(ctx, BISTRO_NAME.toUpperCase(), W / 2, 150, 20, '#ffd54f', 'center');
    text(ctx, GAME_NAME, W / 2, 205, 64, '#ffffff', 'center');
    text(ctx, 'Run the kitchen. Take orders, chop, cook, plate & serve', W / 2, 258, 18, '#ffe082', 'center');
    text(ctx, 'before patience runs out!', W / 2, 282, 18, '#ffe082', 'center');
    const lines = [
      'WASD / Arrows — move the chef      E / Space — use a station',
      'Click a station — walk there & use it      1-0, Q, W — pick a fridge ingredient',
      'Chop on the board, boil on the stove, grill on the grill, bake in the oven.',
      'Plate 3 ingredients, then serve at the window. Chain serves for combos!',
    ];
    lines.forEach((line, i) => text(ctx, line, W / 2, 330 + i * 26, 15, '#ffffff', 'center'));
    if (Math.floor(performance.now() / 500) % 2 === 0) {
      text(ctx, 'Press ENTER or click to start', W / 2, 470, 22, '#ffd54f', 'center');
    }
    if (best > 0) text(ctx, `Best score: ${best}`, W / 2, 505, 15, '#ffffff', 'center');
    return;
  }
  if (screen === 'over') {
    ctx.fillStyle = 'rgba(40,20,10,0.6)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff8e1';
    rr(ctx, W / 2 - 240, 120, 480, 340, 14);
    ctx.fill();
    text(ctx, 'SHIFT OVER!', W / 2, 160, 40, '#4e342e', 'center');
    text(ctx, `Score: ${world.score}`, W / 2, 220, 28, '#d84315', 'center');
    text(ctx, `Dishes served: ${world.served}`, W / 2, 262, 18, '#4e342e', 'center');
    text(ctx, `Best combo: x${world.bestCombo}`, W / 2, 290, 18, '#4e342e', 'center');
    text(ctx, `Orders lost: ${world.expired}   •   Chopped: ${world.stats.chopped}   •   Cooked: ${world.stats.cooked}`, W / 2, 318, 15, '#6d4c41', 'center');
    const verdict = world.score >= 1500 ? 'A legendary shift! The Golden Ladle shines.'
      : world.score >= 800 ? 'A solid shift — the regulars are happy.'
      : world.served > 0 ? 'The kitchen survived. Sharpen the knives and go again!'
      : 'No dishes served — the orders walked out. Try again!';
    text(ctx, verdict, W / 2, 352, 15, '#4e342e', 'center');
    if (Math.floor(performance.now() / 500) % 2 === 0) {
      text(ctx, 'Press ENTER to play again', W / 2, 420, 20, '#d84315', 'center');
    }
  }
}

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_OVER = 'over';

/** Draw the whole game for the given screen. */
export function render(ctx, world, screen, best) {
  ctx.clearRect(0, 0, W, H);
  drawFloor(ctx);
  drawFridge(ctx, world);
  drawBoard(ctx, world);
  drawCooker(ctx, world, 'stove');
  drawCooker(ctx, world, 'grill');
  drawCooker(ctx, world, 'oven');
  drawPlating(ctx, world);
  drawServe(ctx, world);
  drawTrash(ctx, world);
  drawChef(ctx, world);

  // Particles.
  for (const p of world.particles) {
    ctx.globalAlpha = Math.max(0, 1 - p.t / p.life);
    circle(ctx, p.x, p.y, p.size, p.color);
  }
  ctx.globalAlpha = 1;

  // Popups.
  for (const p of world.popups) {
    const a = Math.max(0, 1 - p.t / p.life);
    ctx.globalAlpha = a;
    text(ctx, p.text, p.x, p.y - p.t * 30, 18, p.color, 'center');
  }
  ctx.globalAlpha = 1;

  drawHud(ctx, world);

  // Rush banner.
  if (world.rush && screen === 'play') {
    const blink = Math.floor(performance.now() / 300) % 2 === 0;
    ctx.fillStyle = blink ? '#d32f2f' : '#b71c1c';
    rr(ctx, W / 2 - 110, HUD_H + 6, 220, 30, 8);
    ctx.fill();
    text(ctx, 'RUSH HOUR! 1.5x POINTS', W / 2, HUD_H + 22, 15, '#ffffff', 'center');
  }

  // Message pill.
  if (world.message) {
    const mw = ctx.measureText(world.message).width + 30;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    rr(ctx, W / 2 - mw / 2, H - 44, mw, 30, 15);
    ctx.fill();
    text(ctx, world.message, W / 2, H - 29, 14, '#ffffff', 'center');
  }

  // Controls hint during play.
  if (screen === 'play') {
    text(ctx, 'WASD move  •  E use station  •  1-0/Q/W fridge pick  •  P pause  •  M mute',
      W / 2, H - 8, 11, 'rgba(78,52,46,0.75)', 'center');
  }

  drawOverlays(ctx, screen, world, best);
}
