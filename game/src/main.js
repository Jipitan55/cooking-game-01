// Sizzle & Serve — entry point: game loop, screens, input wiring, and the
// deterministic ?shot= scenes used for the screenshots.
import { GAME_NAME, H, STEP, W } from './config.js';
import { createWorld, EVENT_OVER, resetWorld, stepWorld } from './world.js';
import { render, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { createInput, readAction } from './input.js';
import { isMuted, playEvent, toggleMute, unlockAudio } from './audio.js';
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
let newRecord = false;
try {
  best = Number.parseInt(window.localStorage.getItem('sizzle-serve-best') || '0', 10) || 0;
} catch (e) { best = 0; }

const input = createInput(canvas);

// Pause menu buttons (canvas coordinates): Resume, Restart, Mute, Quit.
const PAUSE_BUTTONS = [
  { id: 'resume', label: 'Resume', x: 370, y: 240, w: 220, h: 40 },
  { id: 'restart', label: 'Restart Shift', x: 370, y: 292, w: 220, h: 40 },
  { id: 'mute', label: 'Mute', x: 370, y: 344, w: 220, h: 40 },
  { id: 'quit', label: 'Quit to Title', x: 370, y: 396, w: 220, h: 40 },
];

function quitToTitle() {
  input.paused = false;
  resetWorld(world);
  screen = SCREEN_TITLE;
  newRecord = false;
  updateStatus();
}

function drawPauseMenu() {
  ctx.fillStyle = 'rgba(40,20,10,0.6)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff8e1';
  ctx.beginPath();
  ctx.roundRect(330, 180, 300, 260, 14);
  ctx.fill();
  ctx.fillStyle = '#4e342e';
  ctx.font = 'bold 32px "Trebuchet MS", Verdana, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PAUSED', W / 2, 212);
  for (const b of PAUSE_BUTTONS) {
    const label = b.id === 'mute' ? `Mute: ${isMuted() ? 'On' : 'Off'}` : b.label;
    ctx.fillStyle = '#6d4c41';
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.w, b.h, 8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 17px "Trebuchet MS", Verdana, sans-serif';
    ctx.fillText(label, b.x + b.w / 2, b.y + b.h / 2 + 1);
  }
  ctx.fillStyle = '#6d4c41';
  ctx.font = '14px "Trebuchet MS", Verdana, sans-serif';
  ctx.fillText('P resume  •  R restart  •  Q quit  •  M mute', W / 2, 462);
}

function pauseClick(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * W;
  const y = ((clientY - rect.top) / rect.height) * H;
  for (const b of PAUSE_BUTTONS) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
      if (b.id === 'resume') input.paused = false;
      else if (b.id === 'restart') { input.paused = false; startGame(); }
      else if (b.id === 'mute') toggleMute();
      else if (b.id === 'quit') quitToTitle();
      return true;
    }
  }
  return false;
}

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
  newRecord = false;
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
      newRecord = world.score > best && world.score > 0;
      best = Math.max(best, world.score);
      try { window.localStorage.setItem('sizzle-serve-best', String(best)); } catch (e) { /* storage is optional */ }
      playEvent('over');
    }
    updateStatus();
  }
  render(ctx, world, screen, best, newRecord);
  if (input.paused && screen === SCREEN_PLAY) drawPauseMenu();
  window.requestAnimationFrame(frame);
}

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'enter') {
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER) startGame();
  }
  if (k === 'm') toggleMute();
  if (k === 'r' && screen === SCREEN_OVER) startGame();
  if (input.paused && screen === SCREEN_PLAY) {
    if (k === 'r') { input.paused = false; startGame(); }
    if (k === 'q') quitToTitle();
  }
});
canvas.addEventListener('click', (e) => {
  unlockAudio();
  if (input.paused && screen === SCREEN_PLAY) {
    pauseClick(e.clientX, e.clientY);
    return;
  }
  if (screen === SCREEN_TITLE || screen === SCREEN_OVER) startGame();
});

// Exposed for play-testing: the live world and a way to start a shift.
window.__game = { world, startGame, get screen() { return screen; } };

if (shotName) {
  // Deterministic screenshot scene: stage the world, draw one frame, stop.
  const staged = stageShot(shotName, world);
  screen = staged.screen;
  best = staged.best;
  render(ctx, world, screen, best, staged.newRecord);
  updateStatus();
  document.title = `${GAME_NAME} — shot ${shotName} score=${world.score} served=${world.served}`;
} else {
  updateStatus();
  window.requestAnimationFrame(frame);
}
