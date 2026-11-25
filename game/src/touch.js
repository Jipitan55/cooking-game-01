// Sizzle & Serve — touch controls (play-only layer for phones).
// Builds an on-screen D-pad, USE / pause / mute buttons and a rotate hint,
// shown only on touch devices. The buttons dispatch synthetic KeyboardEvents
// to window, so the existing keyboard handlers in input.js / main.js do all
// the work: no game logic, balance, scoring or rendering is touched here.
// Never active in the deterministic ?shot= capture path, so the entry
// screenshots reproduce exactly.

const params = typeof window !== 'undefined'
  ? new URLSearchParams(window.location.search)
  : new URLSearchParams();

/** True when this session should show the touch layer. */
export function isTouchMode() {
  if (typeof window === 'undefined') return false;
  if (params.get('shot')) return false; // deterministic screenshot scenes stay clean
  return window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
}

function keyDown(key) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}
function keyUp(key) {
  window.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true }));
}

/** Hold-to-move: press adds the direction key, release removes it. */
function holdButton(el, key) {
  const press = (e) => {
    e.preventDefault();
    try { el.setPointerCapture(e.pointerId); } catch (err) { /* pointer already gone */ }
    keyDown(key);
  };
  const release = (e) => {
    e.preventDefault();
    keyUp(key);
  };
  el.addEventListener('pointerdown', press);
  el.addEventListener('pointerup', release);
  el.addEventListener('pointercancel', release);
  el.addEventListener('lostpointercapture', release);
  el.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}

/** One-shot action: a tap dispatches a full key press. */
function tapButton(el, key) {
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    keyDown(key);
    keyUp(key);
  });
  el.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}

function buildUi() {
  const ui = document.createElement('div');
  ui.id = 'touch-ui';
  ui.innerHTML = `
    <div id="dpad" role="group" aria-label="Move">
      <button type="button" class="tbtn dir up" data-key="arrowup" aria-label="Move up">▲</button>
      <button type="button" class="tbtn dir left" data-key="arrowleft" aria-label="Move left">◀</button>
      <button type="button" class="tbtn dir right" data-key="arrowright" aria-label="Move right">▶</button>
      <button type="button" class="tbtn dir down" data-key="arrowdown" aria-label="Move down">▼</button>
    </div>
    <button type="button" id="btn-use" class="tbtn action" aria-label="Use station">USE</button>
    <button type="button" id="btn-pause" class="tbtn small" aria-label="Pause">II</button>
    <button type="button" id="btn-mute" class="tbtn small" aria-label="Mute">♪</button>
    <div id="rotate-hint"><p>Rotate your phone<br>to play in landscape</p></div>`;
  document.body.appendChild(ui);
  ui.querySelectorAll('#dpad .dir').forEach((b) => holdButton(b, b.dataset.key));
  tapButton(ui.querySelector('#btn-use'), 'e');
  tapButton(ui.querySelector('#btn-pause'), 'p');
  tapButton(ui.querySelector('#btn-mute'), 'm');
  return ui;
}

/** Size the D-pad / USE button to the free margin beside the canvas. */
function fitUi(ui) {
  const canvas = document.getElementById('game');
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const margin = Math.max(0, (window.innerWidth - rect.width) / 2);
  const pad = Math.max(84, Math.min(126, margin - 8));
  const use = Math.max(62, Math.min(84, margin - 24));
  ui.style.setProperty('--pad', `${pad}px`);
  ui.style.setProperty('--use', `${use}px`);
}

export function setupTouchControls() {
  if (typeof document === 'undefined' || !isTouchMode()) return;
  const ui = buildUi();
  ui.classList.add('on');
  fitUi(ui);
  window.addEventListener('resize', () => fitUi(ui));
}
