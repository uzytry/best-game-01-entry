// The screenshot scenes behind ?shot=title|play|draft|victory. Each one plays the
// real game forward from a fresh world for a fixed stretch, steered by an
// autopilot (flee the nearest gloom, chase starlight when it is safe, sidestep
// incoming orbs, dash out of a crowd), so the frame is what a real game looks
// like and the same seed always gives the same frame. The victory scene stages
// the final wave with a champion's loadout — the boons a long run would have
// earned — and then plays the Herald fight for real until the boss falls.

import { FIELD, STEP, WAVE_COUNT } from './config.js';
import { EVENT_GAME_OVER, EVENT_LEVEL_UP, EVENT_VICTORY } from './world.js';
import { SCREEN_DRAFT, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_VICTORY } from './screens.js';

const PLAY_SECONDS = 105;
const DRAFT_LIMIT_SECONDS = 240;
const VICTORY_LIMIT_SECONDS = 300;

// The champion's loadout for the victory scene: twenty-one boons, as a run that
// reached the final wave would carry, with Second Wind in reserve.
const CHAMPION_BOONS = [
  'twin', 'twin', 'pierce', 'pierce', 'rapid', 'rapid', 'rapid',
  'heavy', 'heavy', 'heavy', 'swift', 'swift', 'heart', 'heart',
  'magnet', 'orbit', 'orbit', 'nova', 'nova', 'reach', 'wind',
];

function autopilot(world) {
  const player = world.player;
  const enemies = world.enemies.list;
  let moveX = 0;
  let moveY = 0;

  // Flee every nearby enemy, hardest from the closest.
  for (const enemy of enemies) {
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const distance = Math.hypot(dx, dy) || 1;
    if (distance < 240) {
      const weight = (240 - distance) / 240;
      moveX += (dx / distance) * weight * 2.2;
      moveY += (dy / distance) * weight * 2.2;
    }
  }
  // Sidestep an enemy orb that is closing in.
  for (const bullet of world.bullets.enemy) {
    const dx = player.x - bullet.x;
    const dy = player.y - bullet.y;
    const distance = Math.hypot(dx, dy) || 1;
    if (distance < 70) {
      const approaching = (bullet.vx * dx + bullet.vy * dy) > 0;
      if (approaching) {
        moveX += (-bullet.vy / 200) * 2;
        moveY += (bullet.vx / 200) * 2;
      }
    }
  }
  // Keep out of the gloom pools.
  for (const pool of world.pools) {
    const dx = player.x - pool.x;
    const dy = player.y - pool.y;
    const distance = Math.hypot(dx, dy) || 1;
    if (distance < pool.radius + 50) {
      moveX += (dx / distance) * 2;
      moveY += (dy / distance) * 2;
    }
  }
  // Chase the nearest starlight when nothing is close enough to threaten.
  const nearestEnemy = enemies.reduce((best, enemy) => {
    const distance = Math.hypot(enemy.x - player.x, enemy.y - player.y);
    return !best || distance < best.distance ? { enemy, distance } : best;
  }, null);
  if ((!nearestEnemy || nearestEnemy.distance > 190) && world.pickups.orbs.length > 0) {
    let nearestOrb = null;
    let nearestDistance = Infinity;
    for (const orb of world.pickups.orbs) {
      const distance = Math.hypot(orb.x - player.x, orb.y - player.y);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestOrb = orb;
      }
    }
    if (nearestOrb && nearestDistance < 420) {
      moveX += ((nearestOrb.x - player.x) / nearestDistance) * 1.4;
      moveY += ((nearestOrb.y - player.y) / nearestDistance) * 1.4;
    }
  }
  // Drift back toward the middle when the field is empty, and never hug a wall.
  if (moveX === 0 && moveY === 0) {
    moveX = (FIELD.width / 2 - player.x) / 400;
    moveY = (FIELD.height / 2 - player.y) / 400;
  }
  const margin = 60;
  if (player.x < margin) moveX += 1.5;
  if (player.x > FIELD.width - margin) moveX -= 1.5;
  if (player.y < margin) moveY += 1.5;
  if (player.y > FIELD.height - margin) moveY -= 1.5;

  const length = Math.hypot(moveX, moveY);
  const direction = length > 0 ? { x: moveX / length, y: moveY / length } : { x: 0, y: 0 };
  // Aim at the nearest enemy; fire whenever anything lives.
  const aim = nearestEnemy ? { x: nearestEnemy.enemy.x, y: nearestEnemy.enemy.y } : { x: player.x, y: player.y - 100 };
  // Dash out when something is right on top of the Keeper.
  const crowded = enemies.filter((enemy) => Math.hypot(enemy.x - player.x, enemy.y - player.y) < 110).length;
  const dash = (nearestEnemy && nearestEnemy.distance < 70) || crowded >= 3;
  return { direction, aim, firing: enemies.length > 0, dash };
}

function runSim(world, seconds, stopOn, passive = false) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const input = passive
      ? { direction: { x: 0, y: 0 }, aim: { x: world.player.x, y: world.player.y - 100 }, firing: false, dash: false }
      : autopilot(world);
    const events = world.step(STEP, input, null);
    if (events & EVENT_GAME_OVER) return 'lost';
    if (stopOn && (events & stopOn)) return 'stopped';
    if (events & EVENT_LEVEL_UP) {
      // A real player takes a boon on levelling up; the pilot takes the first
      // card, so a long scene shows a Keeper that is properly equipped.
      while (world.draftPending > 0) {
        world.beginDraft();
        world.chooseDraft(0);
      }
    }
    if (world.phase === 'won') return 'won';
  }
  return 'time';
}

/**
 * Stage the named scene and return the screen to draw over the world.
 * Unknown names fall back to the title.
 */
export function stageShot(name, world) {
  if (name === 'play') {
    world.reset();
    const outcome = runSim(world, PLAY_SECONDS, 0);
    // If the pilot fell (it should not, this early), replay a shorter stretch.
    if (outcome === 'lost') {
      world.reset();
      runSim(world, 40, 0);
    }
    return { screen: SCREEN_PLAY };
  }
  if (name === 'draft') {
    world.reset();
    const outcome = runSim(world, DRAFT_LIMIT_SECONDS, EVENT_LEVEL_UP);
    if (outcome === 'stopped') {
      world.beginDraft();
      return { screen: SCREEN_DRAFT };
    }
    // Fallback: grant the level outright so the draft still shows.
    world.reset();
    world.player.gainXp(world.player.xpNeeded());
    world.draftPending = 1;
    world.beginDraft();
    return { screen: SCREEN_DRAFT };
  }
  if (name === 'victory') {
    world.stageForShot(WAVE_COUNT, CHAMPION_BOONS, 18740, 312, 512);
    const outcome = runSim(world, VICTORY_LIMIT_SECONDS, EVENT_VICTORY);
    if (outcome === 'won' || world.phase === 'won') return { screen: SCREEN_VICTORY };
    // The pilot lost the staged fight: restage with the Herald already wounded.
    world.stageForShot(WAVE_COUNT, CHAMPION_BOONS, 18740, 312, 512);
    runSim(world, 6, 0);
    if (world.boss) world.boss.hp = Math.floor(world.boss.maxHp * 0.25);
    runSim(world, VICTORY_LIMIT_SECONDS, EVENT_VICTORY);
    return { screen: world.phase === 'won' ? SCREEN_VICTORY : SCREEN_OVER };
  }
  if (name === 'end') {
    // The game-over screen: a Keeper that stands still and never fires, so the
    // first wave takes it — the fastest honest route to the end screen.
    world.reset();
    runSim(world, 120, EVENT_GAME_OVER, true);
    return { screen: SCREEN_OVER };
  }
  world.reset();
  return { screen: SCREEN_TITLE };
}
