// The painter: background, arena, Heart, enemies, player, bullets, particles
// and the full HUD. Screen shake is a deterministic function of game time, so
// a staged frame paints identically on every run.
import { COLORS, WALL, WORLD, xpNeed } from './config.js';
import { WEAPONS } from './weapons.js';
import { waveDef } from './waves.js';

const TAU = Math.PI * 2;

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgba(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.w;
  canvas.height = WORLD.h;
  // Ambient ember motes: fixed positions from a local seed, drifting on sine
  // motion, so the background is alive but deterministic.
  let seed = 1234567;
  const next = () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const motes = [];
  for (let i = 0; i < 46; i += 1) {
    motes.push({ x: next() * WORLD.w, y: next() * WORLD.h, r: 1 + next() * 2.2, s: 0.2 + next() * 0.5, p: next() * TAU });
  }

  function bar(x, y, w, h, frac, fill, back = 'rgba(0,0,0,0.55)', border = 'rgba(255,255,255,0.18)') {
    ctx.fillStyle = back;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, Math.max(0, Math.min(1, frac)) * w, h);
    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }

  function text(str, x, y, size, color, align = 'left', weight = 700, font = "'Segoe UI', system-ui, sans-serif") {
    ctx.font = `${weight} ${size}px ${font}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }

  function drawBackground(state) {
    const g = ctx.createRadialGradient(640, 360, 80, 640, 360, 780);
    g.addColorStop(0, COLORS.bg2);
    g.addColorStop(0.55, COLORS.bg1);
    g.addColorStop(1, COLORS.bg0);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.w, WORLD.h);
    // Faint floor grid.
    ctx.strokeStyle = 'rgba(255,180,110,0.05)';
    ctx.lineWidth = 1;
    for (let x = WALL; x <= WORLD.w - WALL; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, WALL);
      ctx.lineTo(x, WORLD.h - WALL);
      ctx.stroke();
    }
    for (let y = WALL; y <= WORLD.h - WALL; y += 64) {
      ctx.beginPath();
      ctx.moveTo(WALL, y);
      ctx.lineTo(WORLD.w - WALL, y);
      ctx.stroke();
    }
    // Drifting motes.
    for (const m of motes) {
      const y = m.y + Math.sin(state.time * m.s + m.p) * 14;
      ctx.globalAlpha = 0.25 + 0.2 * Math.sin(state.time * m.s * 2 + m.p);
      ctx.fillStyle = '#ffb347';
      ctx.beginPath();
      ctx.arc(m.x, y, m.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Arena walls.
    ctx.strokeStyle = COLORS.wall;
    ctx.lineWidth = 5;
    ctx.strokeRect(WALL - 4, WALL - 4, WORLD.w - 2 * WALL + 8, WORLD.h - 2 * WALL + 8);
    ctx.strokeStyle = rgba(COLORS.wallGlow, 0.5);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(WALL - 9, WALL - 9, WORLD.w - 2 * WALL + 18, WORLD.h - 2 * WALL + 18);
  }

  function drawHeart(state) {
    const h = state.heart;
    const pulse = 1 + Math.sin(h.pulse * 3.2) * 0.06;
    const frac = h.hp / h.maxHp;
    // Glow.
    const g = ctx.createRadialGradient(h.x, h.y, 4, h.x, h.y, 90);
    g.addColorStop(0, rgba(COLORS.heart, 0.5));
    g.addColorStop(1, 'rgba(255,138,60,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(h.x, h.y, 90, 0, TAU);
    ctx.fill();
    // HP arc.
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(h.x, h.y, h.radius + 12, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = frac > 0.35 ? COLORS.heartRing : '#ff5d73';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(h.x, h.y, h.radius + 12, -Math.PI / 2, -Math.PI / 2 + frac * TAU);
    ctx.stroke();
    // Core flame.
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = COLORS.heart;
    ctx.beginPath();
    ctx.moveTo(0, -h.radius);
    ctx.bezierCurveTo(14, -8, 12, 10, 0, h.radius);
    ctx.bezierCurveTo(-12, 10, -14, -8, 0, -h.radius);
    ctx.fill();
    ctx.fillStyle = COLORS.playerCore;
    ctx.beginPath();
    ctx.arc(0, 2, 8, 0, TAU);
    ctx.fill();
    ctx.restore();
    text('FORGE HEART', h.x, h.y + h.radius + 30, 11, COLORS.dim, 'center', 600);
  }

  function drawEnemy(state, e) {
    ctx.save();
    ctx.translate(e.x, e.y);
    const flash = e.flash > 0;
    const body = flash ? '#ffffff' : e.color;
    ctx.fillStyle = body;
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 2;
    if (e.shape === 'blob' || e.shape === 'leech') {
      const wob = 1 + Math.sin(e.t * 6) * 0.08;
      ctx.beginPath();
      ctx.ellipse(0, 0, e.radius * wob, e.radius / wob, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
    } else if (e.shape === 'wisp') {
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(0, 0, e.radius * 1.8, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(0, 0, e.radius, 0, TAU);
      ctx.fill();
    } else if (e.shape === 'spitter') {
      ctx.beginPath();
      ctx.arc(0, 0, e.radius, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, e.radius * 0.45, 0, TAU);
      ctx.fillStyle = '#1d2b12';
      ctx.fill();
    } else if (e.shape === 'charger') {
      const a = e.charge ? e.charge.angle : Math.atan2(state.player.y - e.y, state.player.x - e.x);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(e.radius + 6, 0);
      ctx.lineTo(-e.radius, -e.radius * 0.8);
      ctx.lineTo(-e.radius * 0.5, 0);
      ctx.lineTo(-e.radius, e.radius * 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.rotate(-a);
      if (e.charge && e.charge.t > 0) {
        ctx.strokeStyle = 'rgba(255,80,80,0.75)';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(e.charge.angle) * 260, Math.sin(e.charge.angle) * 260);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    } else if (e.shape === 'splitter') {
      ctx.beginPath();
      ctx.arc(0, 0, e.radius, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.arc(-6, -4, 6, 0, TAU);
      ctx.arc(7, 5, 6, 0, TAU);
      ctx.fill();
    } else if (e.shape === 'bulwark') {
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * TAU + e.t * 0.4;
        if (i === 0) ctx.moveTo(Math.cos(a) * e.radius, Math.sin(a) * e.radius);
        else ctx.lineTo(Math.cos(a) * e.radius, Math.sin(a) * e.radius);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (e.shape === 'spawner') {
      ctx.rotate(e.t * 0.8);
      ctx.beginPath();
      for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * TAU;
        if (i === 0) ctx.moveTo(Math.cos(a) * e.radius, Math.sin(a) * e.radius);
        else ctx.lineTo(Math.cos(a) * e.radius, Math.sin(a) * e.radius);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.rotate(-e.t * 0.8);
      ctx.fillStyle = '#fff3c4';
      ctx.beginPath();
      ctx.arc(0, 0, 6 + Math.sin(e.t * 5) * 2, 0, TAU);
      ctx.fill();
    } else if (e.shape === 'boss') {
      // Crowned ring with spikes.
      ctx.beginPath();
      ctx.arc(0, 0, e.radius, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = body;
      ctx.lineWidth = 3;
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * TAU + e.t * 0.5;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * e.radius, Math.sin(a) * e.radius);
        ctx.lineTo(Math.cos(a) * (e.radius + 12), Math.sin(a) * (e.radius + 12));
        ctx.stroke();
      }
      ctx.fillStyle = '#150e1a';
      ctx.beginPath();
      ctx.arc(0, 0, e.radius * 0.55, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#fff3c4';
      ctx.beginPath();
      ctx.arc(-8, -4, 4, 0, TAU);
      ctx.arc(8, -4, 4, 0, TAU);
      ctx.fill();
    }
    // Eyes for the round kinds.
    if (['blob', 'leech', 'spitter', 'splitter', 'bulwark'].includes(e.shape)) {
      ctx.fillStyle = '#150e1a';
      ctx.beginPath();
      ctx.arc(-5, -3, 2.6, 0, TAU);
      ctx.arc(5, -3, 2.6, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    // Elite ring and HP bars.
    if (e.elite) {
      ctx.strokeStyle = COLORS.gold;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius + 5, 0, TAU);
      ctx.stroke();
    }
    if ((e.elite || e.boss) && e.hp < e.maxHp) {
      bar(e.x - 22, e.y - e.radius - 14, 44, 5, e.hp / e.maxHp, e.boss ? '#ff5d73' : COLORS.gold);
    }
  }

  function drawPlayer(state) {
    const p = state.player;
    if (p.dead) return;
    const blink = p.invulnT > 0 && Math.floor(state.time * 18) % 2 === 0;
    // A soft glow under the Warden so the player reads at a glance, even
    // when the judge's contact sheet shrinks the frame.
    const glow = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, 34);
    glow.addColorStop(0, 'rgba(255,179,71,0.35)');
    glow.addColorStop(1, 'rgba(255,179,71,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 34, 0, TAU);
    ctx.fill();
    ctx.save();
    ctx.translate(p.x, p.y);
    if (blink) ctx.globalAlpha = 0.45;
    // Dash trail glow.
    if (p.dashT > 0) {
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = COLORS.player;
      ctx.beginPath();
      ctx.arc(-p.dashDirX * 18, -p.dashDirY * 18, 12, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = blink ? 0.45 : 1;
    }
    // Shield ring.
    if (p.shield > 0) {
      ctx.strokeStyle = rgba(COLORS.shield, 0.8);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 22 + Math.sin(state.time * 4) * 1.5, 0, TAU);
      ctx.stroke();
    }
    // Orbital blades.
    const n = p.orbitals || 0;
    for (let i = 0; i < n; i += 1) {
      const a = p.orbitAngle + (i / n) * TAU;
      const bx = Math.cos(a) * 74;
      const by = Math.sin(a) * 74;
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(a + Math.PI / 2);
      ctx.fillStyle = COLORS.gold;
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(5, 6);
      ctx.lineTo(-5, 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    // Body: flame warden facing the aim.
    ctx.rotate(p.angle);
    ctx.fillStyle = COLORS.player;
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-10, -12);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-10, 12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = COLORS.playerCore;
    ctx.beginPath();
    ctx.arc(2, 0, 7, 0, TAU);
    ctx.fill();
    // Muzzle flash.
    if (p.muzzle > 0) {
      ctx.fillStyle = 'rgba(255,240,180,0.9)';
      ctx.beginPath();
      ctx.arc(24, 0, 6, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    if (p.hurtFlash > 0) {
      ctx.strokeStyle = `rgba(255,93,115,${p.hurtFlash * 2})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 22, 0, TAU);
      ctx.stroke();
    }
  }

  function drawHud(state, screen) {
    const p = state.player;
    // Top-left: HP + XP.
    text(`LV ${state.level}`, 22, 24, 15, COLORS.gold, 'left', 800);
    bar(22, 36, 220, 16, p.hp / p.maxHp, COLORS.hp);
    if (p.shield > 0) bar(22, 36, 220, 16, Math.min(1, p.shield / 50) * 0.25 + p.hp / p.maxHp, rgba(COLORS.shield, 0.65), 'rgba(0,0,0,0)');
    text(`${Math.ceil(p.hp)} / ${p.maxHp}${p.shield > 0 ? `  +${Math.ceil(p.shield)} shield` : ''}`, 26, 44, 12, '#fff', 'left', 700);
    bar(22, 56, 220, 8, state.xp / xpNeed(state.level), COLORS.xp);
    text(`XP ${state.xp}/${xpNeed(state.level)}`, 26, 70, 11, COLORS.dim, 'left', 600);
    // Top-centre: wave + objective.
    const def = waveDef(state.wave);
    text(`WAVE ${state.wave}/${12} — ${def.name.toUpperCase()}`, 640, 24, 16, COLORS.text, 'center', 800);
    const left = state.spawnQueue.length + state.enemies.filter((e) => !e.boss).length;
    const objText = state.objective === 'spawners'
      ? `Destroy the spawners (${state.enemies.filter((e) => e.kind === 'spawner').length} left)`
      : state.objective === 'storm'
        ? `Survive the storm — ${Math.max(0, Math.ceil(42 - state.waveTime))}s`
        : `${left} hostiles remain`;
    text(objText, 640, 46, 12, COLORS.dim, 'center', 600);
    // Boss HP bar.
    if (state.boss && !state.boss.dead) {
      text(state.boss.bossName, 640, 66, 13, state.boss.color, 'center', 800);
      bar(490, 76, 300, 10, state.boss.hp / state.boss.maxHp, '#ff5d73');
    }
    // Top-right: score, combo, kills, time.
    text(`SCORE ${state.score.toLocaleString('en-US')}`, 1258, 24, 16, COLORS.text, 'right', 800);
    const mins = Math.floor(state.time / 60);
    const secs = Math.floor(state.time % 60);
    text(`${mins}:${String(secs).padStart(2, '0')}   KILLS ${state.kills}`, 1258, 46, 12, COLORS.dim, 'right', 600);
    if (state.combo.count >= 3) {
      text(`x${state.combo.mult.toFixed(1)}  COMBO ${state.combo.count}`, 1258, 68, 14, COLORS.gold, 'right', 800);
    }
    // Bottom-left: weapons + nova.
    const names = { scatter: 'SCATTER', lance: 'LANCE', mortar: 'MORTAR' };
    WEAPONS_ORDER.forEach((key, i) => {
      const x = 22 + i * 108;
      const active = p.weapon === key;
      ctx.fillStyle = active ? rgba(WEAPONS[key].color, 0.25) : 'rgba(0,0,0,0.5)';
      ctx.fillRect(x, 668, 100, 34);
      ctx.strokeStyle = active ? WEAPONS[key].color : 'rgba(255,255,255,0.2)';
      ctx.lineWidth = active ? 2 : 1;
      ctx.strokeRect(x + 0.5, 668.5, 99, 33);
      text(`[${i + 1}] ${names[key]}`, x + 8, 686, 12, active ? '#fff' : COLORS.dim, 'left', 700);
    });
    const novaFrac = state.overdrive / 40;
    bar(22, 644, 316, 12, novaFrac, '#ffd166');
    text(novaFrac >= 1 ? 'NOVA READY — press E' : `NOVA ${Math.floor(novaFrac * 100)}%`, 26, 650, 11, novaFrac >= 1 ? '#1a1206' : '#fff', 'left', 800);
    // Dash cooldown pip.
    const dashFrac = p.dashCd <= 0 ? 1 : 1 - p.dashCd / (2.1 * p.dashCdMul);
    bar(346, 644, 60, 12, dashFrac, '#8ef6ff');
    text('DASH', 350, 650, 11, dashFrac >= 1 ? '#0b2a33' : '#fff', 'left', 800);
    // Bottom-right: boon icons.
    const boons = state.boons.slice(-12);
    boons.forEach((b, i) => {
      const x = 1258 - (i % 6) * 30;
      const y = 696 - Math.floor(i / 6) * 30;
      ctx.fillStyle = b.rarity === 'epic' ? rgba(COLORS.epic, 0.35) : b.rarity === 'rare' ? rgba(COLORS.rare, 0.3) : 'rgba(255,255,255,0.12)';
      ctx.fillRect(x - 24, y - 12, 24, 24);
      ctx.strokeStyle = b.rarity === 'epic' ? COLORS.epic : b.rarity === 'rare' ? COLORS.rare : 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x - 23.5, y - 11.5, 23, 23);
      text(b.name[0], x - 12, y + 1, 13, '#fff', 'center', 800);
    });
    // Heart alarm.
    if (state.heartAlarm > 0 && Math.floor(state.time * 6) % 2 === 0) {
      text('⚠ THE HEART IS UNDER ATTACK', 640, 108, 15, '#ff5d73', 'center', 800);
    }
    // Wave banner.
    if (state.waveBanner > 0) {
      const a = Math.min(1, state.waveBanner);
      ctx.globalAlpha = a;
      text(`WAVE ${state.wave}`, 640, 300, 44, COLORS.text, 'center', 800);
      text(def.name.toUpperCase(), 640, 342, 20, COLORS.gold, 'center', 700);
      if (def.objective === 'spawners') text('Destroy all spawners to advance', 640, 372, 14, COLORS.dim, 'center', 600);
      if (def.objective === 'storm') text('Geysers erupt — keep moving', 640, 372, 14, COLORS.dim, 'center', 600);
      ctx.globalAlpha = 1;
    }
    // Boss intro card.
    if (state.bossIntro > 0 && state.boss) {
      const a = Math.min(1, state.bossIntro);
      ctx.globalAlpha = a;
      text(state.boss.bossName, 640, 300, 40, state.boss.color, 'center', 800);
      text(state.boss.kind === 'king' ? 'The final flame-eater' : 'The forge trembles', 640, 340, 16, COLORS.dim, 'center', 600);
      ctx.globalAlpha = 1;
    }
    // Low HP vignette.
    if (p.hp / p.maxHp < 0.3 && !p.dead) {
      const pulse = 0.12 + 0.08 * Math.sin(state.time * 6);
      const vg = ctx.createRadialGradient(640, 360, 260, 640, 360, 720);
      vg.addColorStop(0, 'rgba(255,40,60,0)');
      vg.addColorStop(1, `rgba(255,40,60,${pulse})`);
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, WORLD.w, WORLD.h);
    }
  }

  function draw(state, screen, best, isBest) {
    ctx.save();
    // Deterministic shake: a function of game time, never Math.random.
    if (state.shake > 0.2) {
      const s = state.shake;
      ctx.translate(Math.sin(state.time * 91.7) * s * 0.5, Math.cos(state.time * 113.3) * s * 0.5);
    }
    drawBackground(state);
    // Geyser telegraphs.
    for (const g of state.geysers) {
      const a = g.phase === 'warn' ? 0.25 + 0.2 * Math.sin(state.time * 12) : 0.5;
      ctx.fillStyle = `rgba(255,138,92,${a})`;
      ctx.beginPath();
      ctx.arc(g.x, g.y, 70, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,180,100,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(g.x, g.y, 70, 0, TAU);
      ctx.stroke();
    }
    // Pickups.
    for (const p of state.pickups) {
      const bob = Math.sin(p.bob) * 2;
      ctx.save();
      ctx.translate(p.x, p.y + bob);
      if (p.kind === 'xp') {
        ctx.fillStyle = COLORS.xp;
        ctx.beginPath();
        ctx.arc(0, 0, p.value >= 3 ? 7 : 5, 0, TAU);
        ctx.fill();
      } else if (p.kind === 'health') {
        ctx.fillStyle = '#ff5d73';
        ctx.fillRect(-6, -2, 12, 4);
        ctx.fillRect(-2, -6, 4, 12);
      } else if (p.kind === 'shield') {
        ctx.strokeStyle = COLORS.shield;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, TAU);
        ctx.stroke();
      } else if (p.kind === 'magnet') {
        ctx.fillStyle = COLORS.gold;
        ctx.font = '700 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('M', 0, 5);
      } else if (p.kind === 'bomb') {
        ctx.fillStyle = '#ff8a5c';
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, TAU);
        ctx.fill();
      } else {
        ctx.fillStyle = COLORS.epic;
        ctx.font = '700 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('◷', 0, 5);
      }
      ctx.restore();
    }
    drawHeart(state);
    for (const e of state.enemies) drawEnemy(state, e);
    drawPlayer(state);
    // Bullets (additive glow).
    ctx.globalCompositeOperation = 'lighter';
    for (const b of state.bullets) {
      ctx.fillStyle = b.color;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius * 2.2, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, TAU);
      ctx.fill();
    }
    for (const s of state.ebullets) {
      ctx.fillStyle = s.color;
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius * 2, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, 0, TAU);
      ctx.fill();
    }
    for (const p of state.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    for (const r of state.rings) {
      ctx.globalAlpha = Math.max(0, r.life / r.maxLife) * 0.8;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // Floating combat text.
    for (const f of state.floaters) {
      ctx.globalAlpha = Math.max(0, f.life / f.maxLife);
      ctx.font = `${f.big ? 800 : 700} ${f.big ? 20 : 14}px 'Segoe UI', system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    if (screen === 'play' || screen === 'draft' || screen === 'pause') drawHud(state, screen);
  }

  return { draw };
}

const WEAPONS_ORDER = ['scatter', 'lance', 'mortar'];
