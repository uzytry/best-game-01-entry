// The menu screens: title, level-up draft, pause, game over and victory. Each
// is drawn over the frozen world so the game never disappears behind a menu.
import { COLORS, WORLD } from './config.js';

const TAU = Math.PI * 2;

function panel(ctx, x, y, w, h, fill = 'rgba(16,10,20,0.88)', border = 'rgba(255,180,110,0.35)') {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = border;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
}

function text(ctx, str, x, y, size, color, align = 'left', weight = 700) {
  ctx.font = `${weight} ${size}px 'Segoe UI', system-ui, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

function dim(ctx, alpha = 0.55) {
  ctx.fillStyle = `rgba(10,6,14,${alpha})`;
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);
}

function statGrid(ctx, state, best, cx, y) {
  const rows = [
    ['SCORE', state.score.toLocaleString('en-US')],
    ['WAVE REACHED', `${state.wave} / 12`],
    ['KILLS', String(state.kills)],
    ['LEVEL', String(state.level)],
    ['BEST COMBO', `x${(1 + state.combo.best * 0.08).toFixed(1)} (${state.combo.best} kills)`],
    ['TIME', `${Math.floor(state.time / 60)}:${String(Math.floor(state.time % 60)).padStart(2, '0')}`],
    ['DAMAGE DEALT', state.stats.damageDealt.toLocaleString('en-US')],
    ['BEST SCORE', best.score.toLocaleString('en-US')],
  ];
  const colW = 238;
  const x0 = cx - colW;
  rows.forEach((row, i) => {
    const col = i % 2;
    const r = Math.floor(i / 2);
    const x = x0 + col * colW;
    const yy = y + r * 30;
    text(ctx, row[0], x, yy, 12, COLORS.dim, 'left', 600);
    text(ctx, row[1], x + 150, yy, 14, COLORS.text, 'left', 800);
  });
  return y + Math.ceil(rows.length / 2) * 30;
}

export function drawTitle(ctx, state, best, time) {
  dim(ctx, 0.45);
  // Ember glow behind the title.
  const g = ctx.createRadialGradient(640, 230, 10, 640, 230, 420);
  g.addColorStop(0, 'rgba(255,138,60,0.35)');
  g.addColorStop(1, 'rgba(255,138,60,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);
  text(ctx, 'EMBERFALL', 640, 180, 72, COLORS.gold, 'center', 800);
  text(ctx, 'LAST SPARK OF THE FORGE', 640, 232, 20, COLORS.text, 'center', 600);
  text(ctx, 'The Ashen swarm to swallow the last flame. Hold the Heart. Survive 12 waves. Slay the Hollow King.', 640, 268, 14, COLORS.dim, 'center', 600);
  // How to play.
  panel(ctx, 340, 300, 600, 190);
  text(ctx, 'HOW TO PLAY', 640, 322, 14, COLORS.gold, 'center', 800);
  const lines = [
    ['WASD / Arrows', 'Move the Warden'],
    ['Mouse', 'Aim — weapons fire on their own'],
    ['Shift', 'Dash (brief invulnerability)'],
    ['E / Space', 'Nova blast when the meter is full'],
    ['1 / 2 / 3  or  Q', 'Scatter  •  Lance  •  Mortar'],
    ['Esc / P', 'Pause      M — mute      R — restart'],
  ];
  lines.forEach((row, i) => {
    text(ctx, row[0], 380, 352 + i * 22, 13, COLORS.text, 'left', 700);
    text(ctx, row[1], 560, 352 + i * 22, 13, COLORS.dim, 'left', 600);
  });
  // Best records.
  const bestLine = best.score > 0
    ? `BEST  ${best.score.toLocaleString('en-US')} pts   •   Wave ${best.wave}   •   ${best.wins} victories   •   ${best.kills.toLocaleString('en-US')} kills`
    : 'No runs yet — light the forge.';
  text(ctx, bestLine, 640, 516, 13, COLORS.dim, 'center', 600);
  const pulse = 0.65 + 0.35 * Math.sin(time * 3.2);
  ctx.globalAlpha = pulse;
  text(ctx, '▶  PRESS SPACE OR CLICK TO START', 640, 566, 22, COLORS.playerCore, 'center', 800);
  ctx.globalAlpha = 1;
  text(ctx, 'Defend the Forge Heart at the arena centre — if it dies, the run ends.', 640, 606, 13, COLORS.dim, 'center', 600);
}

export function drawDraft(ctx, state) {
  dim(ctx, 0.6);
  text(ctx, `LEVEL ${state.level} — CHOOSE A BOON`, 640, 120, 30, COLORS.gold, 'center', 800);
  text(ctx, 'One boon joins the Warden. Rarer boons change the run more.', 640, 156, 14, COLORS.dim, 'center', 600);
  const choices = state.draft.choices;
  const cardW = 250;
  const cardH = 300;
  const gap = 30;
  const totalW = choices.length * cardW + (choices.length - 1) * gap;
  let x = 640 - totalW / 2;
  const y = 210;
  choices.forEach((boon, i) => {
    const color = boon.rarity === 'epic' ? COLORS.epic : boon.rarity === 'rare' ? COLORS.rare : COLORS.common;
    panel(ctx, x, y, cardW, cardH, 'rgba(20,12,24,0.95)', color);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, cardW, 6);
    text(ctx, boon.rarity.toUpperCase(), x + cardW / 2, y + 32, 12, color, 'center', 800);
    text(ctx, boon.name, x + cardW / 2, y + 66, 20, COLORS.text, 'center', 800);
    // Word-wrap the description.
    const words = boon.desc.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      if ((`${line} ${word}`).trim().length > 26) {
        lines.push(line.trim());
        line = word;
      } else {
        line = `${line} ${word}`;
      }
    }
    if (line.trim()) lines.push(line.trim());
    lines.forEach((ln, li) => text(ctx, ln, x + cardW / 2, y + 120 + li * 24, 14, COLORS.dim, 'center', 600));
    // Key hint.
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(x + cardW / 2 - 22, y + cardH - 52, 44, 32);
    text(ctx, String(i + 1), x + cardW / 2, y + cardH - 35, 18, COLORS.text, 'center', 800);
    text(ctx, 'or click', x + cardW / 2, y + cardH - 14, 11, COLORS.dim, 'center', 600);
    x += cardW + gap;
  });
}

export function drawPause(ctx, state) {
  dim(ctx, 0.6);
  panel(ctx, 390, 180, 500, 360);
  text(ctx, 'PAUSED', 640, 220, 36, COLORS.text, 'center', 800);
  const lines = [
    ['Esc / P / Click', 'Resume'],
    ['R', 'Restart the run'],
    ['Q', 'Quit to title'],
    ['M', 'Mute / unmute'],
    ['1 / 2 / 3', 'Switch weapon'],
    ['Shift', 'Dash      E — Nova'],
  ];
  lines.forEach((row, i) => {
    text(ctx, row[0], 440, 272 + i * 30, 14, COLORS.text, 'left', 700);
    text(ctx, row[1], 620, 272 + i * 30, 14, COLORS.dim, 'left', 600);
  });
  text(ctx, `Wave ${state.wave}  •  Score ${state.score.toLocaleString('en-US')}  •  Kills ${state.kills}`, 640, 486, 13, COLORS.dim, 'center', 600);
}

export function drawOver(ctx, state, best, isBest) {
  dim(ctx, 0.62);
  text(ctx, 'THE FORGE GOES DARK', 640, 130, 44, '#ff5d73', 'center', 800);
  const cause = state.cause === 'heart'
    ? 'The Forge Heart was extinguished.'
    : 'The Warden fell to the Ashen.';
  text(ctx, cause, 640, 172, 16, COLORS.dim, 'center', 600);
  if (isBest) {
    ctx.globalAlpha = 0.9 + 0.1 * Math.sin(state.time * 4);
    text(ctx, '★ NEW BEST SCORE ★', 640, 208, 20, COLORS.gold, 'center', 800);
    ctx.globalAlpha = 1;
  }
  panel(ctx, 390, 240, 500, 210);
  statGrid(ctx, state, best, 640, 268);
  const pulse = 0.65 + 0.35 * Math.sin(state.time * 3.2);
  ctx.globalAlpha = pulse;
  text(ctx, '▶  PRESS R OR CLICK TO TRY AGAIN', 640, 500, 20, COLORS.playerCore, 'center', 800);
  ctx.globalAlpha = 1;
  text(ctx, 'Q — back to title', 640, 536, 13, COLORS.dim, 'center', 600);
}

export function drawVictory(ctx, state, best, isBest) {
  dim(ctx, 0.55);
  const g = ctx.createRadialGradient(640, 200, 10, 640, 200, 460);
  g.addColorStop(0, 'rgba(255,209,102,0.3)');
  g.addColorStop(1, 'rgba(255,209,102,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);
  text(ctx, 'THE DAWN REKINDLED', 640, 120, 46, COLORS.gold, 'center', 800);
  text(ctx, 'The Hollow King is ash. The Forge Heart burns on — twelve waves survived.', 640, 164, 15, COLORS.text, 'center', 600);
  if (isBest) {
    ctx.globalAlpha = 0.9 + 0.1 * Math.sin(state.time * 4);
    text(ctx, '★ NEW BEST SCORE ★', 640, 198, 20, COLORS.gold, 'center', 800);
    ctx.globalAlpha = 1;
  }
  panel(ctx, 390, 230, 500, 210);
  statGrid(ctx, state, best, 640, 258);
  const pulse = 0.65 + 0.35 * Math.sin(state.time * 3.2);
  ctx.globalAlpha = pulse;
  text(ctx, '▶  PRESS R OR CLICK TO PLAY AGAIN', 640, 492, 20, COLORS.playerCore, 'center', 800);
  ctx.globalAlpha = 1;
  text(ctx, 'Q — back to title', 640, 528, 13, COLORS.dim, 'center', 600);
}
