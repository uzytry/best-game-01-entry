// Keyboard and mouse, read once a frame. Movement is a normalised direction vector;
// actions are edge-triggered bits the game consumes with takeActions(), so a held key
// never fires twice. The mouse position is reported in the field's own coordinates
// (the canvas is scaled by CSS, so client pixels are mapped back through its box).

export const ACTION_CONFIRM = 1; // Enter, Space (on a menu) or a click on a button
export const ACTION_PAUSE = 2; // Escape or P
export const ACTION_DASH = 4; // Shift or Space while playing (Space is dash in play, confirm on menus)
export const ACTION_MUTE = 8; // M
export const ACTION_RESTART = 16; // R
export const ACTION_ONE = 32; // 1 — pick the first draft card
export const ACTION_TWO = 64; // 2 — pick the second draft card
export const ACTION_THREE = 128; // 3 — pick the third draft card

const MOVE_KEYS = {
  KeyW: [0, -1], ArrowUp: [0, -1],
  KeyS: [0, 1], ArrowDown: [0, 1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0],
  KeyD: [1, 0], ArrowRight: [1, 0],
};

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;
  let clicked = null; // { x, y } in field coordinates, consumed by takeClick()
  let mouseSeen = false;

  function toField(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * canvas.width,
      y: ((clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function onKeyDown(event) {
    if (event.repeat) return;
    held.add(event.code);
    if (event.code === 'Enter') actions |= ACTION_CONFIRM;
    else if (event.code === 'Space') actions |= ACTION_CONFIRM | ACTION_DASH;
    else if (event.code === 'Escape' || event.code === 'KeyP') actions |= ACTION_PAUSE;
    else if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') actions |= ACTION_DASH;
    else if (event.code === 'KeyM') actions |= ACTION_MUTE;
    else if (event.code === 'KeyR') actions |= ACTION_RESTART;
    else if (event.code === 'Digit1' || event.code === 'Numpad1') actions |= ACTION_ONE;
    else if (event.code === 'Digit2' || event.code === 'Numpad2') actions |= ACTION_TWO;
    else if (event.code === 'Digit3' || event.code === 'Numpad3') actions |= ACTION_THREE;
    // Space and the arrows scroll the page by default; the game owns them here.
    if (event.code === 'Space' || event.code.startsWith('Arrow')) event.preventDefault();
  }

  function onKeyUp(event) {
    held.delete(event.code);
  }

  function onMouseMove(event) {
    const point = toField(event.clientX, event.clientY);
    mouseX = point.x;
    mouseY = point.y;
    mouseSeen = true;
  }

  function onMouseDown(event) {
    if (event.button !== 0) return;
    mouseDown = true;
    const point = toField(event.clientX, event.clientY);
    mouseX = point.x;
    mouseY = point.y;
    clicked = point;
  }

  function onMouseUp(event) {
    if (event.button === 0) mouseDown = false;
  }

  function onBlur() {
    held.clear();
    mouseDown = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  // A click that starts outside the canvas still counts for menus; firing needs the canvas.
  canvas.addEventListener('click', (event) => {
    const point = toField(event.clientX, event.clientY);
    clicked = point;
  });

  return {
    // The movement direction, normalised, or { x: 0, y: 0 } when no move key is held.
    direction() {
      let x = 0;
      let y = 0;
      for (const code of held) {
        const delta = MOVE_KEYS[code];
        if (delta) {
          x += delta[0];
          y += delta[1];
        }
      }
      if (x === 0 && y === 0) return { x: 0, y: 0 };
      const length = Math.hypot(x, y);
      return { x: x / length, y: y / length };
    },
    firing() {
      return mouseDown;
    },
    aim() {
      return { x: mouseX, y: mouseY, seen: mouseSeen };
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    // The latest click, once, or null. Menus consume it; the game ignores it while playing.
    takeClick() {
      const taken = clicked;
      clicked = null;
      return taken;
    },
  };
}
