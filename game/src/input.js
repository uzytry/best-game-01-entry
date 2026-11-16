// Keyboard and mouse state, read once per frame. Movement is WASD or arrows;
// the mouse aims; Shift dashes; E or Space fires the nova; 1/2/3 or Q switch
// weapons. Actions are edge-triggered bits the main loop consumes each frame.
import { KEYS, WORLD } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_RESTART = 8;
export const ACTION_QUIT = 16;
export const ACTION_DRAFT1 = 32;
export const ACTION_DRAFT2 = 64;
export const ACTION_DRAFT3 = 128;

const KEY_ACTIONS = new Map();
for (const code of KEYS.confirm) KEY_ACTIONS.set(code, ACTION_CONFIRM);
for (const code of KEYS.pause) KEY_ACTIONS.set(code, ACTION_PAUSE);
for (const code of KEYS.mute) KEY_ACTIONS.set(code, ACTION_MUTE);
for (const code of KEYS.restart) KEY_ACTIONS.set(code, ACTION_RESTART);
KEY_ACTIONS.set('Digit1', ACTION_DRAFT1);
KEY_ACTIONS.set('Digit2', ACTION_DRAFT2);
KEY_ACTIONS.set('Digit3', ACTION_DRAFT3);

export function createInput(canvas) {
  const down = new Set();
  let actions = 0;
  let mouseX = WORLD.w / 2;
  let mouseY = WORLD.h / 2 - 120;
  let mouseDown = false;
  let clickedAt = null; // {x, y} in world coords, consumed by the loop

  function toWorld(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = WORLD.w / rect.width;
    const scaleY = WORLD.h / rect.height;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  }

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    down.add(event.code);
    const action = KEY_ACTIONS.get(event.code);
    if (action) actions |= action;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => down.delete(event.code));
  window.addEventListener('blur', () => down.clear());
  canvas.addEventListener('mousemove', (event) => {
    const p = toWorld(event.clientX, event.clientY);
    mouseX = p.x;
    mouseY = p.y;
  });
  canvas.addEventListener('mousedown', (event) => {
    mouseDown = true;
    const p = toWorld(event.clientX, event.clientY);
    clickedAt = p;
    if (event.button === 0) actions |= ACTION_CONFIRM;
  });
  window.addEventListener('mouseup', () => {
    mouseDown = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  function held(codes) {
    return codes.some((c) => down.has(c));
  }

  return {
    // Normalised movement vector from the held keys.
    move() {
      const x = (held(KEYS.right) ? 1 : 0) - (held(KEYS.left) ? 1 : 0);
      const y = (held(KEYS.down) ? 1 : 0) - (held(KEYS.up) ? 1 : 0);
      if (x === 0 && y === 0) return { x: 0, y: 0 };
      const len = Math.hypot(x, y);
      return { x: x / len, y: y / len };
    },
    aim() {
      return { x: mouseX, y: mouseY };
    },
    get dashHeld() {
      return held(KEYS.dash);
    },
    get novaHeld() {
      return held(KEYS.nova);
    },
    get mouseDown() {
      return mouseDown;
    },
    // Weapon key pressed this frame: 0, 1, 2 or 3 (3 = cycle). Consumed on read.
    weaponKey() {
      if (down.has('Digit1')) return 1;
      if (down.has('Digit2')) return 2;
      if (down.has('Digit3')) return 3;
      return 0;
    },
    get cyclePressed() {
      return down.has('KeyQ');
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    takeClick() {
      const click = clickedAt;
      clickedAt = null;
      return click;
    },
  };
}
