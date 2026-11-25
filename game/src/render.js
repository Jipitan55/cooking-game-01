// Sizzle & Serve — all canvas drawing: the kitchen, the food, the chef, the
// order board, the timer, and the title / game-over screens. No assets: every
// ingredient is drawn from shapes, so the game loads nothing over the network.
import {
  BISTRO_NAME, FRIDGE_ORDER, GAME_NAME, H, HUD_H, INGREDIENTS, RECIPES,
  STAR_TARGETS, STATIONS, W,
} from './config.js';
import { nearestStation, plateMatchesRecipe } from './world.js';

const FONT = '"Trebuchet MS", Verdana, sans-serif';

/** A circular progress ring around (x, y); frac 0..1, colour shifts green→yellow→red. */
function drawProgressRing(ctx, x, y, r, frac, color) {
  ctx.save();
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, Math.min(1, frac)));
  ctx.stroke();
  ctx.restore();
}

/** Colour for a cooking ring: green while cooking, then yellow → red as it burns. */
function ringColor(slot, ing) {
  if (slot.state === 'burnt') return '#ff7043';
  if (slot.state === 'ready') {
    const burnFrac = Math.min(1, (slot.t - ing.time) / 6);
    return burnFrac < 0.5 ? '#66bb6a' : burnFrac < 0.8 ? '#ffb300' : '#ff7043';
  }
  const frac = Math.min(1, slot.t / ing.time);
  return frac < 0.6 ? '#66bb6a' : frac < 0.9 ? '#ffb300' : '#ff7043';
}

/** Tiny station icon: knife (chop), pot (boil), grill, oven. Drawn under ticket ingredients. */
function drawPrepIcon(ctx, prep, x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = '#6d4c41';
  ctx.fillStyle = '#6d4c41';
  ctx.lineWidth = 1.6;
  if (prep === 'chop') {
    // Knife.
    ctx.beginPath();
    ctx.moveTo(-6, 4);
    ctx.lineTo(4, -5);
    ctx.lineTo(6, -3);
    ctx.lineTo(-4, 6);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-6, 4);
    ctx.lineTo(-8, 6);
    ctx.stroke();
  } else if (prep === 'boil') {
    // Pot with steam.
    ctx.beginPath();
    ctx.arc(0, 2, 5, 0, Math.PI);
    ctx.fill();
    ctx.fillRect(-5, 2, 10, 3);
    ctx.beginPath();
    ctx.moveTo(-2, -3);
    ctx.quadraticCurveTo(-4, -6, -2, -8);
    ctx.moveTo(2, -3);
    ctx.quadraticCurveTo(4, -6, 2, -8);
    ctx.stroke();
  } else if (prep === 'grill') {
    // Grill grate with flame.
    ctx.beginPath();
    ctx.moveTo(-6, 2);
    ctx.lineTo(6, 2);
    ctx.moveTo(-6, 5);
    ctx.lineTo(6, 5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, 1);
    ctx.lineTo(-3, -5);
    ctx.lineTo(0, -3);
    ctx.lineTo(3, -5);
    ctx.closePath();
    ctx.fill();
  } else if (prep === 'bake') {
    // Oven.
    ctx.strokeRect(-5, -5, 10, 10);
    ctx.beginPath();
    ctx.moveTo(-3, -1);
    ctx.lineTo(3, -1);
    ctx.stroke();
    ctx.fillRect(-3, 2, 6, 3);
  } else {
    // Ready ingredient: a small tick.
    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.lineTo(-1, 3);
    ctx.lineTo(5, -3);
    ctx.stroke();
  }
  ctx.restore();
}

/** A little flame shape, used on the Rush banner and over the grill. */
function drawFlame(ctx, x, y, s, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = color || '#ff7043';
  ctx.beginPath();
  ctx.moveTo(0, -12);
  ctx.quadraticCurveTo(7, -4, 6, 3);
  ctx.quadraticCurveTo(4, 8, 0, 8);
  ctx.quadraticCurveTo(-4, 8, -6, 3);
  ctx.quadraticCurveTo(-7, -4, 0, -12);
  ctx.fill();
  ctx.fillStyle = '#ffca28';
  ctx.beginPath();
  ctx.moveTo(0, -5);
  ctx.quadraticCurveTo(4, 0, 3, 4);
  ctx.quadraticCurveTo(2, 7, 0, 7);
  ctx.quadraticCurveTo(-2, 7, -3, 4);
  ctx.quadraticCurveTo(-4, 0, 0, -5);
  ctx.fill();
  ctx.restore();
}

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
      // A bowl of rice: bright white dome in a pale-blue bowl.
      ctx.fillStyle = '#90caf9';
      ctx.beginPath();
      ctx.arc(x, y + r * 0.35, r * 0.95, 0, Math.PI);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x, y + r * 0.15, r * 0.8, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#e3f2fd';
      circle(ctx, x - r * 0.35, y - r * 0.25, r * 0.1, '#e3f2fd');
      circle(ctx, x + r * 0.25, y - r * 0.4, r * 0.09, '#e3f2fd');
      circle(ctx, x + r * 0.05, y - r * 0.1, r * 0.09, '#e3f2fd');
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
      // Golden dough round with a darker crust edge and scored cross.
      ellipse(ctx, x, y, r, r * 0.72, '#e8b96a');
      ellipse(ctx, x, y, r * 0.82, r * 0.56, '#f5d9a0');
      ctx.strokeStyle = '#b07d2b';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x - r * 0.45, y - r * 0.2);
      ctx.lineTo(x + r * 0.45, y + r * 0.2);
      ctx.moveTo(x - r * 0.45, y + r * 0.2);
      ctx.lineTo(x + r * 0.45, y - r * 0.2);
      ctx.stroke();
      ctx.fillStyle = '#fff';
      circle(ctx, x - r * 0.3, y - r * 0.3, r * 0.09, '#fff');
      circle(ctx, x + r * 0.3, y - r * 0.05, r * 0.08, '#fff');
      break;
    }
    default:
      circle(ctx, x, y, r, ing.color);
  }
  ctx.restore();
  if (state === 'burnt') {
    // Charred black, with a wisp of smoke curling off it.
    ctx.fillStyle = 'rgba(30,20,15,0.72)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,120,120,0.8)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - 3, y - r - 2);
    ctx.quadraticCurveTo(x + 2, y - r - 8, x - 2, y - r - 13);
    ctx.stroke();
  }
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

function drawFridge(ctx, world, showLabels) {
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
  if (showLabels) drawStationLabel(ctx, st, near);
}

function drawBoard(ctx, world, showProgress, showLabels) {
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
    const pct = Math.min(1, c.t / c.total);
    drawIngredient(ctx, c.kind, st.x + st.w / 2 - 18, st.y + st.h / 2, 13, 'raw');
    if (showProgress) {
      // Circular timer around the food being chopped.
      drawProgressRing(ctx, st.x + st.w / 2 - 18, st.y + st.h / 2, 20, pct,
        pct < 0.6 ? '#66bb6a' : pct < 0.9 ? '#ffb300' : '#ff7043');
    }
    // Knife, chopping up and down with the chef's swing.
    const swing = world.chef.chopSwing ? Math.abs(Math.sin(world.chef.chopSwing)) : 0;
    const ky = st.y + 8 + swing * 8;
    ctx.save();
    ctx.translate(st.x + st.w - 34, ky + 8);
    ctx.rotate(0.5);
    ctx.fillStyle = '#eceff1';
    ctx.beginPath();
    ctx.moveTo(-14, -4);
    ctx.lineTo(10, -4);
    ctx.lineTo(14, 2);
    ctx.lineTo(-14, 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#5d4037';
    ctx.fillRect(-20, -3, 7, 7);
    ctx.restore();
  }
  if (showLabels) drawStationLabel(ctx, st, near);
}

function drawCooker(ctx, world, key, showProgress, showLabels) {
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
        // Bubbling pot while it boils.
        if (slot.state === 'cooking') {
          ctx.fillStyle = 'rgba(255,255,255,0.75)';
          const bt = world.time * 3 + i * 2;
          circle(ctx, cx - 6 + Math.sin(bt) * 3, cy - 4, 2, 'rgba(255,255,255,0.75)');
          circle(ctx, cx + 5, cy + 2 + Math.cos(bt * 1.3) * 2, 1.6, 'rgba(255,255,255,0.75)');
        }
        drawIngredient(ctx, slot.kind, cx, cy, 11, slot.state);
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
          // Flickering flames under the food.
          const fl = 0.8 + Math.sin(world.time * 9 + i * 2.4) * 0.25;
          drawFlame(ctx, cx - 8, cy + 16, 0.7 * fl, '#ff7043');
          drawFlame(ctx, cx + 8, cy + 16, 0.55 * fl, '#ff9800');
        }
        drawIngredient(ctx, slot.kind, cx, cy - 4, 12, slot.state);
      }
    } else {
      // Oven: door with a glowing window while baking.
      ctx.fillStyle = '#263238';
      rr(ctx, cx - slotW / 2 + 6, cy - 20, slotW - 12, 40, 5);
      ctx.fill();
      const glowing = slot && slot.state === 'cooking';
      ctx.fillStyle = glowing ? '#ffca28' : '#455a64';
      rr(ctx, cx - slotW / 2 + 12, cy - 12, slotW - 24, 16, 3);
      ctx.fill();
      if (glowing) {
        ctx.save();
        ctx.globalAlpha = 0.35 + Math.sin(world.time * 5) * 0.12;
        ctx.fillStyle = '#ff9800';
        rr(ctx, cx - slotW / 2 + 8, cy - 16, slotW - 16, 24, 4);
        ctx.fill();
        ctx.restore();
      }
      if (slot) drawIngredient(ctx, slot.kind, cx, cy + 12, 9, slot.state);
    }
    if (slot && showProgress) {
      const ing = INGREDIENTS[slot.kind];
      // Circular timer around the food: green → yellow → red, red once burnt.
      const frac = slot.state === 'ready'
        ? 1 - Math.min(1, (slot.t - ing.time) / 6)
        : slot.state === 'burnt' ? 0 : Math.min(1, slot.t / ing.time);
      const ringR = key === 'oven' ? 26 : 22;
      const ringY = key === 'oven' ? cy + 2 : cy;
      drawProgressRing(ctx, cx, ringY, ringR, frac, ringColor(slot, ing));
      if (slot.state === 'ready') text(ctx, 'READY!', cx, st.y - 24, 11, '#66bb6a', 'center');
      if (slot.state === 'burnt') text(ctx, 'BURNT!', cx, st.y - 24, 11, '#ff7043', 'center');
    }
  });
  if (showLabels) drawStationLabel(ctx, st, near);
}

function drawPlating(ctx, world, showLabels) {
  const st = STATIONS.plating;
  const near = nearestStation(world.chef) === 'plating';
  // Island counter: wooden top with a darker side, standing in the middle of the floor.
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  rr(ctx, st.x + 4, st.y + 10, st.w, st.h, 8);
  ctx.fill();
  ctx.fillStyle = '#5d4037';
  rr(ctx, st.x, st.y + 6, st.w, st.h, 8);
  ctx.fill();
  ctx.fillStyle = '#a1887f';
  rr(ctx, st.x, st.y, st.w, st.h - 6, 8);
  ctx.fill();
  ctx.fillStyle = '#d7ccc8';
  rr(ctx, st.x + 8, st.y + 6, st.w - 16, st.h - 18, 5);
  ctx.fill();
  if (world.plateOnCounter) {
    drawPlate(ctx, st.x + st.w / 2, st.y + st.h / 2 + 4, world.plateOnCounter.items, 1);
    if (world.plateOnCounter.items.length > 0) {
      const match = world.orders.some((o) => plateMatchesRecipe(world.plateOnCounter.items, o.recipe));
      text(ctx, match ? 'READY TO SERVE!' : 'PLATING…', st.x + st.w / 2, st.y - 12, 12,
        match ? '#66bb6a' : '#fff', 'center');
    }
  }
  if (showLabels) drawStationLabel(ctx, st, near);
}

function drawCustomer(ctx, order, x, y) {
  const frac = Math.max(0, order.patience / order.max);
  const c = order.cust || { skin: '#ffccbc', shirt: '#ef5350', hair: '#4e342e' };
  // Body.
  ctx.fillStyle = c.shirt;
  rr(ctx, x - 13, y + 8, 26, 22, 9);
  ctx.fill();
  // Head.
  circle(ctx, x, y, 12, c.skin);
  // Hair.
  ctx.fillStyle = c.hair;
  ctx.beginPath();
  ctx.arc(x, y - 3, 12, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(x - 12, y - 4, 24, 4);
  // Eyes.
  ctx.fillStyle = '#263238';
  circle(ctx, x - 4, y, 1.6, '#263238');
  circle(ctx, x + 4, y, 1.6, '#263238');
  // Mood mouth: smile while patient, flat, then worried frown.
  ctx.strokeStyle = '#263238';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (frac > 0.5) ctx.arc(x, y + 3, 4, 0.15 * Math.PI, 0.85 * Math.PI);
  else if (frac > 0.3) {
    ctx.moveTo(x - 4, y + 6);
    ctx.lineTo(x + 4, y + 6);
  } else ctx.arc(x, y + 9, 4, 1.15 * Math.PI, 1.85 * Math.PI);
  ctx.stroke();
  // Patience bar above the head.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  rr(ctx, x - 15, y - 24, 30, 5, 2);
  ctx.fill();
  ctx.fillStyle = frac > 0.5 ? '#66bb6a' : frac > 0.25 ? '#ffb300' : '#ff7043';
  rr(ctx, x - 15, y - 24, 30 * frac, 5, 2);
  ctx.fill();
}

function drawServe(ctx, world, showLabels) {
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
  // Customers queue at the window, one per open order.
  const spots = [
    { x: 838, y: 252 }, { x: 838, y: 306 }, { x: 838, y: 360 }, { x: 838, y: 414 },
  ];
  world.orders.slice(0, 4).forEach((order, i) => {
    drawCustomer(ctx, order, spots[i].x, spots[i].y);
  });
  if (showLabels) drawStationLabel(ctx, st, near);
}

function drawTrash(ctx, world, showLabels) {
  const st = STATIONS.trash;
  const near = nearestStation(world.chef) === 'trash';
  ctx.fillStyle = '#78909c';
  rr(ctx, st.x + 8, st.y + 4, st.w - 16, st.h - 8, 5);
  ctx.fill();
  ctx.fillStyle = '#546e7a';
  rr(ctx, st.x, st.y, st.w, 10, 4);
  ctx.fill();
  if (showLabels) drawStationLabel(ctx, st, near);
}

function drawChef(ctx, world) {
  const c = world.chef;
  const S = 1.5; // The chef is 1.5x the old size.
  const bob = c.moving ? Math.abs(Math.sin(c.bob)) * 3 : Math.sin(world.time * 2) * 0.8;
  const y = c.y - bob;
  ellipse(ctx, c.x, c.y + 30, 30, 10, 'rgba(0,0,0,0.25)');
  // Body / apron.
  ctx.fillStyle = '#eceff1';
  rr(ctx, c.x - 22 * S, y - 9 * S, 45 * S, 45 * S, 15);
  ctx.fill();
  ctx.fillStyle = '#90caf9';
  rr(ctx, c.x - 22 * S, y + 12 * S, 45 * S, 12 * S, 6);
  ctx.fill();
  // Head.
  circle(ctx, c.x, y - 24 * S, 19, '#ffccbc');
  // Chef hat.
  ctx.fillStyle = '#ffffff';
  circle(ctx, c.x - 13, y - 42, 10, '#ffffff');
  circle(ctx, c.x, y - 46, 12, '#ffffff');
  circle(ctx, c.x + 13, y - 42, 10, '#ffffff');
  rr(ctx, c.x - 18, y - 42, 36, 10, 4);
  ctx.fill();
  // Eyes.
  ctx.fillStyle = '#263238';
  circle(ctx, c.x - 7 + c.face * 3, y - 24 * S, 2.6, '#263238');
  circle(ctx, c.x + 7 + c.face * 3, y - 24 * S, 2.6, '#263238');
  // Smile.
  ctx.strokeStyle = '#263238';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(c.x + c.face * 2, y - 18 * S, 5, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  // Chopping arm: a knife that swings while the chef chops at the board.
  if (world.chopping && nearestStation(c) === 'board') {
    const swing = Math.abs(Math.sin(c.chopSwing)) * 10;
    ctx.save();
    ctx.translate(c.x + c.face * 26, y - 10 - swing);
    ctx.rotate(c.face * 0.4);
    ctx.fillStyle = '#eceff1';
    ctx.beginPath();
    ctx.moveTo(-12, -3);
    ctx.lineTo(10, -3);
    ctx.lineTo(13, 3);
    ctx.lineTo(-12, 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#5d4037';
    ctx.fillRect(-18, -3, 7, 7);
    ctx.restore();
  }
  // Item in hand, held up, with its name tagged beside it (dark outline so
  // the label reads over the board, the floor or the chef's hat, and clamped
  // so it never runs off the canvas edge).
  if (c.hands) {
    drawIngredient(ctx, c.hands.kind, c.x + c.face * 32, y - 20, 19, c.hands.state);
    const name = INGREDIENTS[c.hands.kind].name;
    const tx = Math.max(48, Math.min(W - 48, c.x + c.face * 88));
    ctx.save();
    ctx.font = `bold 12px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(78,52,46,0.9)';
    ctx.strokeText(name, tx, y - 20);
    ctx.fillStyle = '#fff';
    ctx.fillText(name, tx, y - 20);
    ctx.restore();
  }
  // Carried plate.
  if (c.plate) {
    drawPlate(ctx, c.x + c.face * 34, y + 4, c.plate.items, 1.3);
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
  // Name left, menu price in dollars right (the dish's price, not the score).
  // In the narrow 5-ticket Rush layout the number stays on the name and the
  // price moves to the bottom row, so all five tickets fit with a clear gap.
  const compact = w < 150;
  const nameText = `#${order.id} ${recipe.name}`;
  text(ctx, nameText, x + 10, y + 13, compact ? 9 : 10, '#4e342e', 'left');
  if (!compact) text(ctx, `$${recipe.base}`, x + w - 10, y + 13, 12, '#6d4c41', 'right');
  // Dish icon: the finished dish on a little plate, top right under the price.
  ellipse(ctx, x + w - 20, y + 33, 14, 5, '#eceff1');
  drawIngredient(ctx, recipe.ingredients[0], x + w - 20, y + 29, 8, 'ready');
  // Ingredients with their prep-station icon underneath each.
  recipe.ingredients.forEach((kind, i) => {
    const ix = x + 22 + i * (compact ? 30 : 34);
    drawIngredient(ctx, kind, ix, y + 40, 11, 'ready');
    drawPrepIcon(ctx, INGREDIENTS[kind].prep, ix, y + 58);
  });
  // Patience: seconds on the left, bar filling the rest (shortened in the
  // compact layout to leave room for the price at the bottom right).
  text(ctx, `${Math.ceil(order.patience)}s`, x + 10, y + h - 8, 10, urgent ? '#d32f2f' : '#6d4c41', 'left');
  const barW = compact ? w - 84 : w - 50;
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  rr(ctx, x + 40, y + h - 12, barW, 7, 3);
  ctx.fill();
  ctx.fillStyle = frac > 0.5 ? '#66bb6a' : frac > 0.25 ? '#ffb300' : '#ff7043';
  rr(ctx, x + 40, y + h - 12, barW * frac, 7, 3);
  ctx.fill();
  if (compact) text(ctx, `$${recipe.base}`, x + w - 10, y + h - 8, 11, '#6d4c41', 'right');
}

function drawHud(ctx, world) {
  // Order board background.
  ctx.fillStyle = '#4e342e';
  ctx.fillRect(0, 0, W, HUD_H);
  ctx.fillStyle = '#6d4c41';
  ctx.fillRect(0, HUD_H - 4, W, 4);
  // Five tickets squeeze in during Rush Hour; four at normal width otherwise.
  // Five at 130px + 5px gaps end at 678, leaving a clear gap to the TIME panel.
  const five = world.orders.length > 4;
  const ticketW = five ? 130 : 168;
  const gap = five ? 5 : 6;
  world.orders.forEach((order, i) => {
    drawOrderTicket(ctx, order, 8 + i * (ticketW + gap), 8, ticketW, 86);
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
  // Score panel: points, never dollars — the ticket shows the menu price in $.
  const sx = 820;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  rr(ctx, sx, 8, 132, 80, 8);
  ctx.fill();
  text(ctx, 'SCORE (PTS)', sx + 66, 20, 11, '#d7ccc8', 'center');
  text(ctx, `${world.score}`, sx + 66, 43, 24, '#ffd54f', 'center');
  const comboText = world.combo >= 1 ? `Combo x${world.combo}` : '';
  text(ctx, `LV ${world.level}${comboText ? `  •  ${comboText}` : ''}`, sx + 66, 64, 12, '#ffffff', 'center');
  // Next star target, so the player always knows what to chase.
  const nextStar = STAR_TARGETS.find((t) => world.score < t);
  text(ctx, nextStar ? `Next ★ ${nextStar} pts` : '★ ★ ★ Max!', sx + 66, 79, 11, '#ffe082', 'center');
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
  // Tiled backsplash along the wall under the order board.
  const bt = 12;
  for (let x = 0; x < W; x += bt) {
    ctx.fillStyle = (x / bt) % 2 === 0 ? '#ffccbc' : '#ffe0b2';
    ctx.fillRect(x, HUD_H, bt, 14);
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.fillRect(x, HUD_H + 12, bt, 2);
  }
  ctx.fillStyle = '#8d6e63';
  ctx.fillRect(0, HUD_H + 12, W, 2);
}

/** Floor mats, sink, wall shelf with spice jars, hanging pans, plants. */
function drawDecor(ctx, world) {
  // Floor mats in front of the work stations.
  ctx.fillStyle = '#b0a18e';
  rr(ctx, 186, 196, 158, 28, 6);
  ctx.fill();
  rr(ctx, 400, 196, 168, 28, 6);
  ctx.fill();
  rr(ctx, 400, 356, 160, 28, 6);
  ctx.fill();
  ctx.fillStyle = '#c8a882';
  rr(ctx, 192, 202, 146, 16, 4);
  ctx.fill();
  rr(ctx, 406, 202, 156, 16, 4);
  ctx.fill();
  rr(ctx, 406, 362, 148, 16, 4);
  ctx.fill();

  // Sink with a faucet, bottom left next to the trash.
  ctx.fillStyle = '#78909c';
  rr(ctx, 150, 496, 112, 44, 6);
  ctx.fill();
  ctx.fillStyle = '#b0bec5';
  rr(ctx, 158, 502, 96, 32, 4);
  ctx.fill();
  ctx.fillStyle = '#4fc3f7';
  rr(ctx, 164, 508, 84, 20, 3);
  ctx.fill();
  ctx.strokeStyle = '#546e7a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(206, 500);
  ctx.quadraticCurveTo(206, 482, 218, 486);
  ctx.stroke();

  // Wall shelf with spice jars above the stove and grill.
  // The jars sit on the backsplash strip, just below the order board.
  ctx.fillStyle = '#6d4c41';
  ctx.fillRect(360, 110, 590, 4);
  const jarColors = ['#e53935', '#fdd835', '#43a047', '#fb8c00', '#8e24aa'];
  jarColors.forEach((color, i) => {
    const jx = 420 + i * 104;
    ctx.fillStyle = color;
    rr(ctx, jx - 7, 98, 14, 12, 3);
    ctx.fill();
    ctx.fillStyle = '#5d4037';
    ctx.fillRect(jx - 7, 96, 14, 3);
  });

  // Hanging pans in the gaps between the top-row stations.
  [368, 592, 784].forEach((px) => {
    ctx.strokeStyle = '#5d4037';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, 110);
    ctx.lineTo(px, 118);
    ctx.stroke();
    ctx.fillStyle = '#37474f';
    circle(ctx, px, 130, 13, '#37474f');
    circle(ctx, px, 130, 9, '#546e7a');
  });

  // Potted plants in the corners.
  [[916, 528], [24, 556]].forEach(([px, py]) => {
    ctx.fillStyle = '#b71c1c';
    rr(ctx, px - 10, py, 20, 16, 3);
    ctx.fill();
    ctx.fillStyle = '#43a047';
    circle(ctx, px - 6, py - 6, 7, '#43a047');
    circle(ctx, px + 6, py - 8, 8, '#2e7d32');
    circle(ctx, px, py - 14, 7, '#66bb6a');
  });
}

function drawStar(ctx, x, y, r, filled) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    if (i === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
    else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
  }
  ctx.closePath();
  if (filled) {
    ctx.fillStyle = '#ffb300';
    ctx.fill();
  }
  ctx.strokeStyle = '#b07d2b';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function gradeFor(score) {
  if (score >= STAR_TARGETS[2]) return 'S';
  if (score >= STAR_TARGETS[1]) return 'A';
  if (score >= STAR_TARGETS[0]) return 'B';
  return 'C';
}

function drawOverlays(ctx, screen, world, best, newRecord) {
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
    text(ctx, `Stars: ${STAR_TARGETS.map((t) => `★${t}`).join('  ')} pts`, W / 2, 442, 14, '#ffe082', 'center');
    if (Math.floor(performance.now() / 500) % 2 === 0) {
      text(ctx, 'Press ENTER or click to start', W / 2, 472, 22, '#ffd54f', 'center');
    }
    if (best > 0) text(ctx, `Best score: ${best} pts`, W / 2, 505, 15, '#ffffff', 'center');
    return;
  }
  if (screen === 'over') {
    ctx.fillStyle = 'rgba(40,20,10,0.6)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff8e1';
    rr(ctx, W / 2 - 260, 92, 520, 424, 14);
    ctx.fill();
    text(ctx, 'SHIFT OVER!', W / 2, 128, 36, '#4e342e', 'center');
    // Stars earned and the letter grade.
    const stars = STAR_TARGETS.filter((t) => world.score >= t).length;
    [-1, 0, 1].forEach((off, i) => {
      drawStar(ctx, W / 2 - 70 + off * 70, 172, 24, i < stars);
    });
    text(ctx, gradeFor(world.score), W / 2 + 190, 172, 44, '#d84315', 'center');
    text(ctx, 'GRADE', W / 2 + 190, 200, 10, '#6d4c41', 'center');
    if (newRecord && world.score > 0) {
      ctx.fillStyle = '#ffb300';
      rr(ctx, W / 2 - 95, 206, 190, 28, 14);
      ctx.fill();
      text(ctx, '★ NEW RECORD! ★', W / 2, 221, 15, '#4e342e', 'center');
    }
    text(ctx, `Score: ${world.score} pts   •   Best: ${best} pts`, W / 2, 254, 20, '#d84315', 'center');
    // Row of dishes served, with counts.
    const served = Object.entries(world.servedDishes || {});
    if (served.length > 0) {
      const totalW = served.length * 64;
      served.forEach(([key, count], i) => {
        const dx = W / 2 - totalW / 2 + 32 + i * 64;
        ellipse(ctx, dx, 292, 22, 8, '#eceff1');
        drawIngredient(ctx, RECIPES[key].ingredients[0], dx, 286, 12, 'ready');
        text(ctx, `x${count}`, dx, 312, 12, '#4e342e', 'center');
      });
    } else {
      text(ctx, 'No dishes served', W / 2, 292, 14, '#6d4c41', 'center');
    }
    // Score breakdown.
    const b = world.breakdown || { base: 0, tips: 0, combo: 0, rush: 0 };
    const rows = [
      ['Base dishes', b.base],
      ['Tips (fast service)', b.tips],
      ['Combo bonus', b.combo],
      ['Rush Hour bonus', b.rush],
    ];
    rows.forEach(([label, value], i) => {
      const ry = 342 + i * 22;
      text(ctx, label, W / 2 - 150, ry, 14, '#4e342e', 'left');
      text(ctx, `${value} pts`, W / 2 + 150, ry, 14, '#4e342e', 'right');
    });
    ctx.strokeStyle = '#d7ccc8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(W / 2 - 150, 432);
    ctx.lineTo(W / 2 + 150, 432);
    ctx.stroke();
    text(ctx, `Dishes served: ${world.served}   •   Best combo: x${world.bestCombo}   •   Orders lost: ${world.expired}`, W / 2, 452, 13, '#6d4c41', 'center');
    const verdict = stars >= 3 ? 'A legendary shift! The Golden Ladle shines.'
      : stars >= 2 ? 'A solid shift — the regulars are happy.'
      : stars >= 1 ? 'The kitchen survived. Sharpen the knives and go again!'
      : 'No dishes served — the orders walked out. Try again!';
    text(ctx, verdict, W / 2, 478, 14, '#4e342e', 'center');
    if (Math.floor(performance.now() / 500) % 2 === 0) {
      text(ctx, 'Press ENTER to play again', W / 2, 502, 18, '#d84315', 'center');
    }
  }
}

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_OVER = 'over';

/** Draw the whole game for the given screen. */
export function render(ctx, world, screen, best, newRecord) {
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  // Screen shake on a big combo (seeded, so screenshot scenes stay deterministic).
  if (world.shakeT > 0) {
    const mag = world.shakeT * 14;
    ctx.translate((world.rng() - 0.5) * mag, (world.rng() - 0.5) * mag);
  }
  const showProgress = screen !== 'title';
  const showLabels = screen !== 'title';
  drawFloor(ctx);
  drawDecor(ctx, world);
  drawFridge(ctx, world, showLabels);
  drawBoard(ctx, world, showProgress, showLabels);
  drawCooker(ctx, world, 'stove', showProgress, showLabels);
  drawCooker(ctx, world, 'grill', showProgress, showLabels);
  drawCooker(ctx, world, 'oven', showProgress, showLabels);
  drawPlating(ctx, world, showLabels);
  drawServe(ctx, world, showLabels);
  drawTrash(ctx, world, showLabels);
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
  ctx.restore();

  drawHud(ctx, world);

  // Rush Hour: warm red-orange vignette and a pulsing border.
  if (world.rush && screen === 'play') {
    const grad = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.75);
    grad.addColorStop(0, 'rgba(255,80,0,0)');
    grad.addColorStop(1, 'rgba(255,60,0,0.30)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    const pulse = 0.45 + Math.sin(world.time * 6) * 0.25;
    ctx.strokeStyle = `rgba(255,90,0,${pulse})`;
    ctx.lineWidth = 7;
    ctx.strokeRect(4, 4, W - 8, H - 8);
    // Banner slides in from the top when Rush starts.
    const slide = Math.max(0, 1 - world.rushT / 0.5);
    const by = HUD_H + 6 - slide * 90;
    const blink = Math.floor(performance.now() / 300) % 2 === 0;
    ctx.fillStyle = blink ? '#d32f2f' : '#b71c1c';
    rr(ctx, W / 2 - 130, by, 260, 30, 8);
    ctx.fill();
    drawFlame(ctx, W / 2 - 108, by + 16, 0.9, '#ffca28');
    text(ctx, 'RUSH HOUR! 1.5x POINTS', W / 2 + 12, by + 16, 15, '#ffffff', 'center');
  }

  // Combo pop: big text and a flash when a combo lands.
  if (world.comboPopT > 0 && world.combo >= 2) {
    const a = Math.min(1, world.comboPopT * 2);
    if (world.comboPopT > 0.7) {
      ctx.fillStyle = `rgba(255,213,79,${(world.comboPopT - 0.7) * 0.4})`;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.save();
    ctx.globalAlpha = a;
    const pop = 1 + (0.9 - world.comboPopT) * 0.25;
    ctx.translate(W / 2, 250);
    ctx.scale(pop, pop);
    ctx.font = `bold 40px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#bf360c';
    ctx.strokeText(`COMBO x${world.combo}!`, 0, 0);
    ctx.fillStyle = '#ffca28';
    ctx.fillText(`COMBO x${world.combo}!`, 0, 0);
    ctx.restore();
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

  drawOverlays(ctx, screen, world, best, newRecord);
}
