// The painter: the night sky, the arena, every entity and the HUD, all on one
// canvas. Glows are pre-rendered sprites (a radial gradient on a small offscreen
// canvas, drawn scaled) so a busy fight stays fast; the starfield is three layers
// that drift at different speeds. Nothing here knows the rules — it only reads
// the world and paints what is there.

import { COLORS, FIELD, WAVE_COUNT } from './config.js';
import { BOONS } from './upgrades.js';
import { createRandom } from './random.js';

const BOON_ICONS = new Map(BOONS.map((boon) => [boon.id, boon.icon]));

const STAR_LAYERS = [
  { count: 90, speed: 4, size: 1.1, alpha: 0.5 },
  { count: 60, speed: 9, size: 1.7, alpha: 0.75 },
  { count: 30, speed: 16, size: 2.4, alpha: 1 },
];

function makeGlowSprite(color) {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, color);
  gradient.addColorStop(0.35, color);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

export function createRenderer(canvas, seed = 1) {
  const ctx = canvas.getContext('2d');
  const glowCache = new Map();
  // The starfield is seeded with the run's seed, so a screenshot scene replays
  // the same sky every time.
  const starRandom = createRandom((seed ^ 0x9e3779b9) >>> 0);
  const stars = STAR_LAYERS.map((layer) => {
    const points = [];
    for (let i = 0; i < layer.count; i += 1) {
      points.push({ x: starRandom.next() * FIELD.width, y: starRandom.next() * FIELD.height, twinkle: starRandom.next() * Math.PI * 2 });
    }
    return { ...layer, points };
  });
  // Soft nebula blobs, painted once into an offscreen canvas.
  const nebula = document.createElement('canvas');
  nebula.width = FIELD.width;
  nebula.height = FIELD.height;
  {
    const nctx = nebula.getContext('2d');
    const blobs = [
      { x: 220, y: 150, r: 260, color: 'rgba(64, 48, 140, 0.55)' },
      { x: 1050, y: 520, r: 300, color: 'rgba(24, 80, 120, 0.45)' },
      { x: 640, y: 660, r: 240, color: 'rgba(120, 40, 90, 0.35)' },
    ];
    for (const blob of blobs) {
      const gradient = nctx.createRadialGradient(blob.x, blob.y, 0, blob.x, blob.y, blob.r);
      gradient.addColorStop(0, blob.color);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      nctx.fillStyle = gradient;
      nctx.fillRect(0, 0, FIELD.width, FIELD.height);
    }
  }

  function glow(color) {
    let sprite = glowCache.get(color);
    if (!sprite) {
      sprite = makeGlowSprite(color);
      glowCache.set(color, sprite);
    }
    return sprite;
  }

  function drawGlow(x, y, radius, color, alpha = 1) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha;
    ctx.drawImage(glow(color), x - radius, y - radius, radius * 2, radius * 2);
    ctx.restore();
  }

  function drawBackground(time) {
    const gradient = ctx.createLinearGradient(0, 0, 0, FIELD.height);
    gradient.addColorStop(0, COLORS.skyTop);
    gradient.addColorStop(1, COLORS.skyBottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.drawImage(nebula, 0, 0);
    for (const layer of stars) {
      for (const star of layer.points) {
        const x = (star.x + time * layer.speed) % FIELD.width;
        const twinkle = 0.6 + 0.4 * Math.sin(time * 1.5 + star.twinkle);
        ctx.globalAlpha = layer.alpha * twinkle;
        ctx.fillStyle = '#e8e4ff';
        ctx.fillRect(x, star.y, layer.size, layer.size);
      }
    }
    ctx.globalAlpha = 1;
    // A faint grid of light, so motion reads at a glance.
    ctx.strokeStyle = 'rgba(140, 130, 220, 0.07)';
    ctx.lineWidth = 1;
    for (let x = 80; x < FIELD.width; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, FIELD.height);
      ctx.stroke();
    }
    for (let y = 80; y < FIELD.height; y += 80) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(FIELD.width, y);
      ctx.stroke();
    }
    // The arena's edge: a soft frame of light.
    ctx.strokeStyle = 'rgba(255, 217, 122, 0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(4, 4, FIELD.width - 8, FIELD.height - 8);
  }

  function drawEnemy(enemy, time) {
    const { x, y, radius } = enemy;
    const flash = enemy.flash > 0;
    drawGlow(x, y, radius * 2.6, enemy.color, 0.55);
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = flash ? '#ffffff' : enemy.color;
    ctx.strokeStyle = enemy.core;
    ctx.lineWidth = 2;
    if (enemy.kind === 'wisp') {
      // A flickering flame: a circle with a wavering tip.
      const tip = Math.sin(time * 9 + enemy.wobble) * 4;
      ctx.beginPath();
      ctx.arc(0, 2, radius * 0.85, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-radius * 0.5, -radius * 0.3);
      ctx.quadraticCurveTo(0, -radius * 1.6 - tip, radius * 0.5, -radius * 0.3);
      ctx.closePath();
      ctx.fill();
    } else if (enemy.kind === 'darter') {
      const angle = Math.atan2(enemy.lungeY || 0, enemy.lungeX || 1);
      ctx.rotate(enemy.state === 'lunge' || enemy.state === 'windup' ? angle : Math.sin(time * 3 + enemy.wobble) * 0.4);
      ctx.beginPath();
      ctx.moveTo(radius * 1.4, 0);
      ctx.lineTo(-radius * 0.8, radius * 0.7);
      ctx.lineTo(-radius * 0.4, 0);
      ctx.lineTo(-radius * 0.8, -radius * 0.7);
      ctx.closePath();
      ctx.fill();
    } else if (enemy.kind === 'spitter') {
      for (let i = 0; i < 8; i += 1) {
        const angle = (i * Math.PI * 2) / 8 + time * 0.6;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * radius * 0.6, Math.sin(angle) * radius * 0.6);
        ctx.lineTo(Math.cos(angle) * radius * 1.35, Math.sin(angle) * radius * 1.35);
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.8, 0, Math.PI * 2);
      ctx.fill();
    } else if (enemy.kind === 'brute') {
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const angle = (i * Math.PI * 2) / 6 + Math.PI / 6;
        const px = Math.cos(angle) * radius;
        const py = Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (enemy.kind === 'splitter') {
      for (let i = 0; i < 3; i += 1) {
        const angle = (i * Math.PI * 2) / 3 + time * 1.2;
        ctx.beginPath();
        ctx.arc(Math.cos(angle) * radius * 0.55, Math.sin(angle) * radius * 0.55, radius * 0.55, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (enemy.kind === 'boss') {
      // The Herald: a great ringed eye, its outer ring turning.
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.save();
      ctx.rotate(time * 0.5);
      ctx.strokeStyle = enemy.core;
      ctx.lineWidth = 4;
      for (let i = 0; i < 6; i += 1) {
        const angle = (i * Math.PI * 2) / 6;
        ctx.beginPath();
        ctx.arc(0, 0, radius * 1.18, angle, angle + 0.7);
        ctx.stroke();
      }
      ctx.restore();
      ctx.fillStyle = enemy.core;
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.34, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a0a12';
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.16, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // A bright core every kind shares.
    ctx.fillStyle = flash ? '#ffffff' : enemy.core;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(3, radius * 0.3), 0, Math.PI * 2);
    ctx.fill();
    if (enemy.elite) {
      // Elites wear a crown of gold.
      ctx.strokeStyle = '#ffd97a';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(x, y, radius + 7, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Health bars for the tough ones only; the small fry die too fast to need one.
    if ((enemy.kind === 'brute' || enemy.kind === 'splitter' || enemy.elite) && enemy.hp < enemy.maxHp) {
      const width = radius * 2;
      const ratio = Math.max(0, enemy.hp / enemy.maxHp);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(x - width / 2, y - radius - 12, width, 5);
      ctx.fillStyle = enemy.color;
      ctx.fillRect(x - width / 2, y - radius - 12, width * ratio, 5);
    }
  }

  function drawPlayer(player, time) {
    const blink = player.invulnerable > 0 && Math.floor(time * 18) % 2 === 0;
    ctx.save();
    if (blink) ctx.globalAlpha = 0.45;
    const dashing = player.dashTimer > 0;
    drawGlow(player.x, player.y, 56, COLORS.player, 0.8);
    if (dashing) {
      // A streak of light along the dash.
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = '#9be8ff';
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(player.x - player.dashDirection.x * 34, player.y - player.dashDirection.y * 34);
      ctx.lineTo(player.x, player.y);
      ctx.stroke();
      ctx.restore();
    }
    // The lantern: a bright core in a golden ring, with an aim tick.
    ctx.translate(player.x, player.y);
    ctx.rotate(player.aimAngle);
    ctx.fillStyle = COLORS.player;
    ctx.beginPath();
    ctx.moveTo(player.radius + 10, 0);
    ctx.lineTo(player.radius + 2, -5);
    ctx.lineTo(player.radius + 2, 5);
    ctx.closePath();
    ctx.fill();
    ctx.rotate(-player.aimAngle);
    ctx.fillStyle = COLORS.playerCore;
    ctx.beginPath();
    ctx.arc(0, 0, player.radius * 0.62, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLORS.player;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    // Orbiting sparks.
    for (const spark of player.orbiterPositions()) {
      drawGlow(spark.x, spark.y, 20, '#ffd97a', 0.9);
      ctx.fillStyle = COLORS.playerCore;
      ctx.beginPath();
      ctx.arc(spark.x, spark.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function bar(x, y, width, height, ratio, fill, background = 'rgba(0,0,0,0.55)') {
    ctx.fillStyle = background;
    ctx.fillRect(x, y, width, height);
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, width * Math.max(0, Math.min(1, ratio)), height);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
  }

  function drawHUD(world, records) {
    const player = world.player;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    // Top-left: health and experience.
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.fillStyle = COLORS.text;
    ctx.fillText(`HP ${Math.max(0, Math.ceil(player.hp))} / ${player.stats.maxHp}`, 20, 30);
    bar(20, 38, 230, 16, player.hp / player.stats.maxHp, player.hp / player.stats.maxHp < 0.3 ? COLORS.danger : '#7ddb8a');
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.fillStyle = COLORS.dim;
    ctx.fillText(`LV ${player.level}`, 20, 74);
    bar(58, 62, 192, 10, player.xp / player.xpNeeded(), '#9be8ff');
    // Top-centre: the wave, and the Herald's health when it lives.
    ctx.textAlign = 'center';
    ctx.font = '700 20px system-ui, sans-serif';
    ctx.fillStyle = COLORS.text;
    const remaining = world.waves.remaining + world.enemies.list.length;
    ctx.fillText(world.wave === WAVE_COUNT ? 'FINAL WAVE' : `WAVE ${world.wave} / ${WAVE_COUNT}`, FIELD.width / 2, 30);
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillStyle = COLORS.dim;
    if (world.boss) {
      ctx.fillText(world.boss ? 'THE GLOOM HERALD' : '', FIELD.width / 2, 52);
      bar(FIELD.width / 2 - 180, 60, 360, 12, world.boss.hp / world.boss.maxHp, COLORS.danger);
    } else {
      ctx.fillText(world.phase === 'breather' ? 'The gloom gathers…' : `${remaining} gloom-spawn remain`, FIELD.width / 2, 52);
    }
    // Top-right: score, kills, combo.
    ctx.textAlign = 'right';
    ctx.font = '700 22px system-ui, sans-serif';
    ctx.fillStyle = COLORS.gold;
    ctx.fillText(String(world.score).padStart(6, '0'), FIELD.width - 20, 32);
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillStyle = COLORS.dim;
    ctx.fillText(`KILLS ${world.kills}   BEST ${Math.max(records.best, world.score)}`, FIELD.width - 20, 52);
    if (world.comboMultiplier > 1) {
      ctx.font = '700 16px system-ui, sans-serif';
      ctx.fillStyle = '#ff9ecb';
      ctx.fillText(`x${world.comboMultiplier} COMBO`, FIELD.width - 20, 76);
    }
    // Bottom-left: dash readiness and the boons carried.
    const dashRatio = 1 - Math.max(0, player.dashCooldownLeft) / player.stats.dashCooldown;
    ctx.textAlign = 'left';
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.fillStyle = dashRatio >= 1 ? '#9be8ff' : COLORS.dim;
    ctx.fillText(dashRatio >= 1 ? 'DASH READY [Shift]' : 'DASH…', 20, FIELD.height - 48);
    bar(20, FIELD.height - 42, 110, 8, dashRatio, '#9be8ff');
    let iconX = 150;
    for (const [id, level] of Object.entries(world.boonLevels)) {
      const icon = BOON_ICONS.get(id);
      if (!icon) continue;
      ctx.font = '16px system-ui, sans-serif';
      ctx.fillStyle = COLORS.gold;
      ctx.fillText(icon, iconX, FIELD.height - 32);
      ctx.font = '700 11px system-ui, sans-serif';
      ctx.fillStyle = COLORS.text;
      ctx.fillText(`x${level}`, iconX + 16, FIELD.height - 32);
      iconX += 48;
    }
    // Bottom-right: the controls, dim so they never shout.
    ctx.textAlign = 'right';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(164, 159, 208, 0.8)';
    ctx.fillText('WASD move · Mouse aim · Hold click to fire · Shift dash · Esc pause · M mute', FIELD.width - 20, FIELD.height - 16);
    // The wave banner.
    if (world.bannerTimer > 0) {
      const fade = Math.min(1, world.bannerTimer);
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.textAlign = 'center';
      ctx.font = '700 44px system-ui, sans-serif';
      ctx.fillStyle = COLORS.text;
      ctx.shadowColor = 'rgba(255, 217, 122, 0.8)';
      ctx.shadowBlur = 24;
      ctx.fillText(world.banner, FIELD.width / 2, FIELD.height / 2 - 120);
      ctx.restore();
    }
  }

  return {
    drawBackground,
    drawGlow,
    // The world mid-play: background, pools, pickups, enemies, Keeper, bolts, sparks.
    drawWorld(world, time) {
      const offset = world.particles.offset();
      ctx.save();
      ctx.translate(offset.x, offset.y);
      drawBackground(time);
      for (const pool of world.pools) {
        const fade = Math.min(1, pool.ttl);
        ctx.save();
        ctx.globalAlpha = 0.5 * fade;
        ctx.fillStyle = '#1c0f2e';
        ctx.beginPath();
        ctx.arc(pool.x, pool.y, pool.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#7a4dff';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }
      for (const orb of world.pickups.orbs) {
        const pulse = 1 + Math.sin(time * 6 + orb.x) * 0.15;
        drawGlow(orb.x, orb.y, 14 * pulse, COLORS.orb, 0.8);
        ctx.fillStyle = COLORS.orb;
        ctx.beginPath();
        ctx.arc(orb.x, orb.y, 4 * pulse, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const heart of world.pickups.hearts) {
        const pulse = 1 + Math.sin(time * 5 + heart.x) * 0.2;
        drawGlow(heart.x, heart.y, 22 * pulse, COLORS.heart, 0.8);
        ctx.font = `${Math.round(18 * pulse)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = COLORS.heart;
        ctx.fillText('♥', heart.x, heart.y);
        ctx.textBaseline = 'alphabetic';
      }
      for (const enemy of world.enemies.list) drawEnemy(enemy, time);
      if (world.phase !== 'lost') drawPlayer(world.player, time);
      // Bolts of light, drawn as streaks along their flight.
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      for (const bullet of world.bullets.player) {
        ctx.strokeStyle = COLORS.bullet;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(bullet.x - bullet.vx * 0.02, bullet.y - bullet.vy * 0.02);
        ctx.lineTo(bullet.x, bullet.y);
        ctx.stroke();
      }
      for (const bullet of world.bullets.enemy) {
        ctx.fillStyle = '#c86bff';
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      world.particles.draw(ctx);
      ctx.restore();
      // Hurt flash and the low-health pulse sit above the world, below the HUD.
      if (world.hurtFlash > 0) {
        ctx.fillStyle = `rgba(255, 40, 70, ${world.hurtFlash * 0.5})`;
        ctx.fillRect(0, 0, FIELD.width, FIELD.height);
      }
      const hpRatio = world.player.hp / world.player.stats.maxHp;
      if (hpRatio < 0.3 && world.phase !== 'lost') {
        const pulse = 0.1 + 0.08 * Math.sin(time * 5);
        const gradient = ctx.createRadialGradient(
          FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.35,
          FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.75,
        );
        gradient.addColorStop(0, 'rgba(255, 40, 70, 0)');
        gradient.addColorStop(1, `rgba(255, 40, 70, ${pulse})`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, FIELD.width, FIELD.height);
      }
    },
    drawHUD,
    // The ambient title backdrop: the starfield with a few wisps drifting past,
    // so the title screen is alive rather than a still frame.
    drawAmbient(time, motes) {
      drawBackground(time);
      for (const mote of motes) {
        const x = (mote.x + time * mote.speed) % (FIELD.width + 80) - 40;
        const y = mote.y + Math.sin(time * 0.7 + mote.phase) * 14;
        drawGlow(x, y, 26, mote.color, 0.5);
        ctx.fillStyle = mote.color;
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  };
}
