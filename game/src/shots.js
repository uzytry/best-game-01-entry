// Screenshot staging: each scene plays the real rules forward from a fresh
// world with the autopilot, so every frame is what a real game looks like and
// the same seed always gives the same frame. The title scene runs in god mode
// (an attract loop); the victory scene must be genuinely won.
import { STEP } from './config.js';
import { decide } from './autopilot.js';

const MAX_STEPS = 90000; // 25 minutes of game time, far past any real run

function answerDrafts(world) {
  let guard = 0;
  while (world.state.phase === 'draft' && guard < 5) {
    const input = decide(world.state);
    world.applyDraft(Math.max(0, input.draftPick));
    guard += 1;
  }
}

function stepPilot(world, godMode, autoDraft = true) {
  const state = world.state;
  if (godMode) {
    state.player.invulnT = 1;
    state.heart.hp = state.heart.maxHp;
  }
  const input = decide(state);
  world.step(input, STEP);
  if (autoDraft) answerDrafts(world);
}

export function runAttract(world, dt) {
  stepPilot(world, true);
}

export function stageShot(name, world) {
  const state = world.state;
  world.reset();
  state.phase = 'play';
  if (name === 'title') {
    // A lively attract loop behind the title panel.
    for (let i = 0; i < 8 / STEP; i += 1) stepPilot(world, true);
    state.phase = 'title';
    return { screen: 'title', best: 0 };
  }
  if (name === 'draft') {
    // Play to the third level-up and stop on the draft screen. Drafts stay
    // open here (autoDraft off) so the loop can count them.
    let draftsSeen = 0;
    let steps = 0;
    while (steps < MAX_STEPS) {
      stepPilot(world, false, false);
      steps += 1;
      if (state.phase === 'draft') {
        draftsSeen += 1;
        if (draftsSeen >= 3) return { screen: 'draft', best: 0 };
        answerDrafts(world);
      }
      if (state.phase === 'over' || state.phase === 'win') break;
    }
    return { screen: state.phase === 'draft' ? 'draft' : 'play', best: 0 };
  }
  if (name === 'victory') {
    let steps = 0;
    while (steps < MAX_STEPS) {
      stepPilot(world, false);
      steps += 1;
      if (state.phase === 'win') return { screen: 'win', best: state.score };
      if (state.phase === 'over') break;
    }
    throw new Error(`victory staging failed: pilot ${state.phase} at wave ${state.wave} after ${steps} steps`);
  }
  if (name === 'end') {
    // A reckless pilot: stand still and let the swarm win.
    let steps = 0;
    while (steps < MAX_STEPS) {
      const input = { move: { x: 0, y: 0 }, aim: { x: state.player.x, y: state.player.y - 100 }, dash: false, nova: false, weapon: 0, cycle: false, draftPick: 0 };
      world.step(input, STEP);
      answerDrafts(world);
      steps += 1;
      if (state.phase === 'over') return { screen: 'over', best: state.score };
      if (state.phase === 'win') break;
    }
    return { screen: 'over', best: state.score };
  }
  // Default: play — mid-combat late in the run, when the arena is busiest:
  // wave 10+ with ten or more hostiles, elites among them.
  let steps = 0;
  while (steps < MAX_STEPS) {
    stepPilot(world, false);
    steps += 1;
    if (state.wave >= 10 && state.waveState === 'active' && state.enemies.length >= 10) {
      // Half a second more so bullets and particles are mid-flight, but not
      // so long the pilot thins the crowd before the capture.
      for (let i = 0; i < 0.5 / STEP; i += 1) stepPilot(world, false);
      return { screen: 'play', best: 0 };
    }
    if (state.phase === 'over' || state.phase === 'win') break;
  }
  return { screen: 'play', best: 0 };
}
