// Sizzle & Serve — entry point: game loop, screens, input wiring, and the
// deterministic ?shot= scenes used for the screenshots.
import { GAME_NAME, H, STEP, W } from './config.js';
import { createWorld, EVENT_OVER, resetWorld, stepWorld } from './world.js';
import { render, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { createInput, readAction } from './input.js';
import { playEvent, toggleMute, unlockAudio } from './audio.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const ctx = canvas.getContext('2d');

const params = new URLSearchParams(window.location.search);
const seed = Number.parseInt(params.get('seed') || '1', 10) || 1;
const shotName = params.get('shot');

const world = createWorld(seed);
resetWorld(world);
let screen = SCREEN_TITLE;
let best = 0;
try {
  best = Number.parseInt(window.localStorage.getItem('sizzle-serve-best') || '0', 10) || 0;
} catch (e) { best = 0; }

const input = createInput(canvas);

function fitCanvas() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const scale = Math.min(window.innerWidth / W, window.innerHeight / H);
  canvas.width = Math.round(W * scale * dpr);
  canvas.height = Math.round(H * scale * dpr);
  canvas.style.width = `${Math.round(W * scale)}px`;
  canvas.style.height = `${Math.round(H * scale)}px`;
  ctx.setTransform((canvas.width / W), 0, 0, (canvas.height / H), 0, 0);
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

function updateStatus() {
  if (!statusEl) return;
  statusEl.textContent = `${GAME_NAME}: screen=${screen} score=${world.score} `
    + `served=${world.served} combo=${world.combo} level=${world.level} `
    + `orders=${world.orders.length} timeLeft=${Math.ceil(world.timeLeft)} `
    + `over=${world.over} best=${best}`;
}

function startGame() {
  resetWorld(world);
  screen = SCREEN_PLAY;
  unlockAudio();
  updateStatus();
}

function drainEvents() {
  for (const name of world.events) playEvent(name);
  world.events.length = 0;
}

function frame(now) {
  if (screen === SCREEN_PLAY && !input.paused) {
    const action = readAction(input, world);
    const result = stepWorld(world, STEP, action);
    drainEvents();
    if (result & EVENT_OVER) {
      screen = SCREEN_OVER;
      best = Math.max(best, world.score);
      try { window.localStorage.setItem('sizzle-serve-best', String(best)); } catch (e) { /* storage is optional */ }
      playEvent('over');
    }
    updateStatus();
  }
  render(ctx, world, screen, best);
  if (input.paused && screen === SCREEN_PLAY) {
    ctx.fillStyle = 'rgba(40,20,10,0.55)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px "Trebuchet MS", Verdana, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Paused — press P to resume', W / 2, H / 2);
  }
  window.requestAnimationFrame(frame);
}

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'enter') {
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER) startGame();
  }
  if (k === 'm') toggleMute();
  if (k === 'r' && screen === SCREEN_OVER) startGame();
});
canvas.addEventListener('click', () => {
  unlockAudio();
  if (screen === SCREEN_TITLE || screen === SCREEN_OVER) startGame();
});

// Exposed for play-testing: the live world and a way to start a shift.
window.__game = { world, startGame, get screen() { return screen; } };

if (shotName) {
  // Deterministic screenshot scene: stage the world, draw one frame, stop.
  const staged = stageShot(shotName, world);
  screen = staged.screen;
  best = staged.best;
  render(ctx, world, screen, best);
  updateStatus();
  document.title = `${GAME_NAME} — shot ${shotName} score=${world.score} served=${world.served}`;
} else {
  updateStatus();
  window.requestAnimationFrame(frame);
}
