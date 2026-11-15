// The screens between the fighting: title, level-up draft, pause, game over and
// victory. Each draw call paints its overlay and returns the buttons it showed,
// as { id, x, y, width, height } rectangles the game loop hit-tests clicks
// against. Hovering a button lights it; every screen also answers its keys.

import { COLORS, FIELD } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_DRAFT = 'draft';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_VICTORY = 'victory';

function inside(rect, point) {
  return point && point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function drawButton(ctx, rect, label, mouse, primary = false) {
  const hovered = inside(rect, mouse);
  ctx.save();
  roundRect(ctx, rect.x, rect.y, rect.width, rect.height, 10);
  ctx.fillStyle = primary ? (hovered ? '#ffe9a8' : '#ffd97a') : hovered ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.08)';
  ctx.fill();
  ctx.strokeStyle = primary ? '#fff6d8' : 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = primary ? '#2a1a00' : COLORS.text;
  ctx.font = '700 19px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, rect.x + rect.width / 2, rect.y + rect.height / 2 + 1);
  ctx.restore();
}

function dim(ctx, alpha = 0.62) {
  ctx.fillStyle = `rgba(6, 4, 20, ${alpha})`;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

function statRows(ctx, rows, centreX, startY) {
  ctx.textAlign = 'center';
  rows.forEach(([label, value], index) => {
    const y = startY + index * 30;
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillStyle = COLORS.dim;
    ctx.fillText(label, centreX - 130, y);
    ctx.font = '700 17px system-ui, sans-serif';
    ctx.fillStyle = COLORS.text;
    ctx.textAlign = 'left';
    ctx.fillText(value, centreX + 10, y);
    ctx.textAlign = 'center';
  });
}

export function drawTitle(ctx, records, mouse, time) {
  const centre = FIELD.width / 2;
  // The title breathes with the light.
  const glowPulse = 0.65 + 0.35 * Math.sin(time * 1.4);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = '700 84px system-ui, sans-serif';
  ctx.shadowColor = `rgba(255, 217, 122, ${0.55 * glowPulse})`;
  ctx.shadowBlur = 42;
  ctx.fillStyle = COLORS.text;
  ctx.fillText('LUMEN DRIFT', centre, 190);
  ctx.restore();
  ctx.textAlign = 'center';
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillStyle = COLORS.gold;
  ctx.fillText('Keep the last light alive.', centre, 232);
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillStyle = COLORS.dim;
  ctx.fillText('The Gloom has swallowed every lantern but one — yours. Survive ten waves,', centre, 272);
  ctx.fillText('gather the fallen starlight, and let the dawn break again.', centre, 294);

  const startButton = { id: 'start', x: centre - 130, y: 330, width: 260, height: 56 };
  drawButton(ctx, startButton, '▶  BEGIN THE DRIFT', mouse, true);
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillStyle = COLORS.dim;
  ctx.fillText('or press Space', centre, 410);

  // The controls, in one readable block.
  ctx.font = '700 14px system-ui, sans-serif';
  ctx.fillStyle = COLORS.text;
  ctx.fillText('HOW TO PLAY', centre, 462);
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillStyle = COLORS.dim;
  const controls = [
    'WASD / Arrows — drift',
    'Mouse — aim    ·    Hold click — fire bolts of light',
    'Shift / Space — dash through danger',
    'Level up to choose a boon — 1 / 2 / 3 or click a card',
    'Esc — pause    ·    M — mute    ·    R — restart',
  ];
  controls.forEach((line, index) => ctx.fillText(line, centre, 488 + index * 22));

  if (records.best > 0 || records.wins > 0) {
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillStyle = COLORS.gold;
    ctx.fillText(
      `Best score ${records.best}  ·  Best wave ${records.bestWave}  ·  Dawns kept ${records.wins}`,
      centre, 622,
    );
  }
  return { buttons: [startButton] };
}

export function drawDraft(ctx, world, mouse) {
  dim(ctx, 0.66);
  const centre = FIELD.width / 2;
  ctx.textAlign = 'center';
  ctx.font = '700 34px system-ui, sans-serif';
  ctx.fillStyle = COLORS.gold;
  ctx.fillText(`LEVEL ${world.player.level} — CHOOSE A BOON`, centre, 120);
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillStyle = COLORS.dim;
  ctx.fillText('The starlight offers three gifts. Take one, Keeper.', centre, 148);

  const cardWidth = 250;
  const cardHeight = 300;
  const gap = 28;
  const total = cardWidth * 3 + gap * 2;
  const startX = centre - total / 2;
  const y = 190;
  const buttons = [];
  world.draftChoices.forEach((boon, index) => {
    const x = startX + index * (cardWidth + gap);
    const rect = { id: `card-${index}`, x, y, width: cardWidth, height: cardHeight };
    buttons.push(rect);
    const hovered = inside(rect, mouse);
    const level = world.boonLevels[boon.id] ?? 0;
    ctx.save();
    roundRect(ctx, x, y, cardWidth, cardHeight, 14);
    ctx.fillStyle = hovered ? 'rgba(60, 48, 110, 0.95)' : 'rgba(30, 24, 64, 0.92)';
    ctx.fill();
    ctx.strokeStyle = hovered ? COLORS.gold : 'rgba(255, 217, 122, 0.4)';
    ctx.lineWidth = hovered ? 3 : 2;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.font = '52px system-ui, sans-serif';
    ctx.fillStyle = COLORS.gold;
    ctx.fillText(boon.icon, x + cardWidth / 2, y + 84);
    ctx.font = '700 21px system-ui, sans-serif';
    ctx.fillStyle = COLORS.text;
    ctx.fillText(boon.name, x + cardWidth / 2, y + 128);
    ctx.font = '700 14px system-ui, sans-serif';
    ctx.fillStyle = '#9be8ff';
    ctx.fillText(boon.blurb, x + cardWidth / 2, y + 156);
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillStyle = COLORS.dim;
    // The detail wraps by hand, two lines at most.
    const words = boon.detail.split(' ');
    let line = '';
    let lineY = y + 192;
    for (const word of words) {
      const trial = line ? `${line} ${word}` : word;
      if (ctx.measureText(trial).width > cardWidth - 36 && line) {
        ctx.fillText(line, x + cardWidth / 2, lineY);
        line = word;
        lineY += 20;
      } else {
        line = trial;
      }
    }
    if (line) ctx.fillText(line, x + cardWidth / 2, lineY);
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.fillStyle = COLORS.gold;
    const stackText = boon.max >= 99 ? 'Always welcome' : level === 0 ? 'New boon' : `Owned x${level}  ·  max ${boon.max}`;
    ctx.fillText(stackText, x + cardWidth / 2, y + cardHeight - 40);
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = COLORS.dim;
    ctx.fillText(`Press ${index + 1} or click`, x + cardWidth / 2, y + cardHeight - 18);
    ctx.restore();
  });
  return { buttons };
}

export function drawPaused(ctx, mouse, muted) {
  dim(ctx, 0.66);
  const centre = FIELD.width / 2;
  ctx.textAlign = 'center';
  ctx.font = '700 44px system-ui, sans-serif';
  ctx.fillStyle = COLORS.text;
  ctx.fillText('PAUSED', centre, 200);
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillStyle = COLORS.dim;
  ctx.fillText('The gloom waits. So does the light.', centre, 232);
  const buttons = [
    { id: 'resume', x: centre - 130, y: 280, width: 260, height: 50 },
    { id: 'restart', x: centre - 130, y: 344, width: 260, height: 50 },
    { id: 'mute', x: centre - 130, y: 408, width: 260, height: 50 },
    { id: 'title', x: centre - 130, y: 472, width: 260, height: 50 },
  ];
  drawButton(ctx, buttons[0], 'Resume', mouse, true);
  drawButton(ctx, buttons[1], 'Restart run', mouse);
  drawButton(ctx, buttons[2], muted ? 'Sound: Off — turn on' : 'Sound: On — mute', mouse);
  drawButton(ctx, buttons[3], 'Back to title', mouse);
  return { buttons };
}

export function drawGameOver(ctx, world, records, isNewBest, mouse) {
  dim(ctx, 0.7);
  const centre = FIELD.width / 2;
  ctx.textAlign = 'center';
  ctx.font = '700 52px system-ui, sans-serif';
  ctx.fillStyle = COLORS.danger;
  ctx.shadowColor = 'rgba(255, 93, 115, 0.6)';
  ctx.shadowBlur = 28;
  ctx.fillText('THE LIGHT FADES', centre, 170);
  ctx.shadowBlur = 0;
  ctx.font = '17px system-ui, sans-serif';
  ctx.fillStyle = COLORS.dim;
  ctx.fillText(`The Gloom took the lantern on wave ${world.wave}. It can be lit again.`, centre, 208);
  if (isNewBest) {
    ctx.font = '700 18px system-ui, sans-serif';
    ctx.fillStyle = COLORS.gold;
    ctx.fillText('★ NEW BEST SCORE ★', centre, 244);
  }
  statRows(ctx, [
    ['Score', String(world.score)],
    ['Wave reached', `${world.wave} / 10`],
    ['Gloom slain', String(world.kills)],
    ['Level reached', String(world.player.level)],
    ['Time survived', formatTime(world.time)],
    ['Best score', String(Math.max(records.best, world.score))],
  ], centre, 292);
  const buttons = [
    { id: 'retry', x: centre - 270, y: 520, width: 250, height: 54 },
    { id: 'title', x: centre + 20, y: 520, width: 250, height: 54 },
  ];
  drawButton(ctx, buttons[0], '↻  TRY AGAIN', mouse, true);
  drawButton(ctx, buttons[1], 'Title screen', mouse);
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillStyle = COLORS.dim;
  ctx.fillText('or press R to retry', centre, 606);
  return { buttons };
}

export function drawVictory(ctx, world, records, isNewBest, mouse) {
  dim(ctx, 0.6);
  const centre = FIELD.width / 2;
  ctx.textAlign = 'center';
  ctx.font = '700 56px system-ui, sans-serif';
  ctx.fillStyle = COLORS.gold;
  ctx.shadowColor = 'rgba(255, 217, 122, 0.7)';
  ctx.shadowBlur = 34;
  ctx.fillText('DAWN BREAKS', centre, 160);
  ctx.shadowBlur = 0;
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillStyle = COLORS.text;
  ctx.fillText('The Gloom Herald is unmade. Ten waves weathered — the light is yours, Keeper.', centre, 198);
  if (isNewBest) {
    ctx.font = '700 18px system-ui, sans-serif';
    ctx.fillStyle = COLORS.gold;
    ctx.fillText('★ NEW BEST SCORE ★', centre, 232);
  }
  statRows(ctx, [
    ['Score', String(world.score)],
    ['Gloom slain', String(world.kills)],
    ['Level reached', String(world.player.level)],
    ['Time', formatTime(world.time)],
    ['Accuracy', world.shotsFired > 0 ? `${Math.round((world.shotsHit / world.shotsFired) * 100)}%` : '—'],
    ['Dawns kept', String(records.wins + 1)],
  ], centre, 282);
  const buttons = [
    { id: 'again', x: centre - 270, y: 520, width: 250, height: 54 },
    { id: 'title', x: centre + 20, y: 520, width: 250, height: 54 },
  ];
  drawButton(ctx, buttons[0], '↻  PLAY AGAIN', mouse, true);
  drawButton(ctx, buttons[1], 'Title screen', mouse);
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillStyle = COLORS.dim;
  ctx.fillText('or press R to play again', centre, 606);
  return { buttons };
}

export function hitButton(buttons, point) {
  if (!point) return null;
  for (const button of buttons) {
    if (inside(button, point)) return button.id;
  }
  return null;
}
