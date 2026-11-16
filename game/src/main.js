// EMBERFALL — Last Spark of the Forge. Entry point: boots the world, runs the
// fixed-step loop, switches screens, and wires sounds to world events. With
// ?shot=<name> it stages one deterministic frame instead of a live game.
import { STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EV_HIT, EV_LEVEL, EV_OVER, EV_WIN } from './world.js';
import { createRenderer } from './render.js';
import {
  ACTION_CONFIRM,
  ACTION_DRAFT1,
  ACTION_DRAFT2,
  ACTION_DRAFT3,
  ACTION_MUTE,
  ACTION_PAUSE,
  ACTION_RESTART,
  createInput,
} from './input.js';
import { createAudio } from './audio.js';
import { readBest, readMuted, saveBest, saveMuted } from './storage.js';
import { drawDraft, drawOver, drawPause, drawTitle, drawVictory } from './screens.js';
import { runAttract, stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed')) || 7;
const shotName = params.get('shot');

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const audio = createAudio();
const world = createWorld(createRandom(seed));
world.state.audio = audio;
const renderer = createRenderer(canvas);
const input = createInput(canvas);
let best = readBest();
let isBest = false;
audio.setMuted(readMuted());

let screen = 'title';
let prevQ = false;

function drawFrame() {
  renderer.draw(world.state, screen, best, isBest);
  if (screen === 'title') drawTitle(ctx, world.state, best, world.state.time);
  else if (screen === 'draft') drawDraft(ctx, world.state);
  else if (screen === 'pause') drawPause(ctx, world.state);
  else if (screen === 'over') drawOver(ctx, world.state, best, isBest);
  else if (screen === 'win') drawVictory(ctx, world.state, best, isBest);
}

function startRun() {
  audio.unlock();
  audio.click();
  isBest = false;
  world.reset();
  world.state.phase = 'play';
  screen = 'play';
  audio.setWave(1);
}

function toTitle() {
  world.reset();
  world.state.phase = 'play'; // attract mode: the world lives behind the title
  screen = 'title';
}

function finishRun() {
  const state = world.state;
  const won = state.phase === 'win';
  isBest = state.score > best.score && state.score > 0;
  best = {
    score: Math.max(best.score, state.score),
    wave: Math.max(best.wave, state.wave),
    wins: best.wins + (won ? 1 : 0),
    kills: Math.max(best.kills, state.kills),
  };
  saveBest(best);
  screen = won ? 'win' : 'over';
  if (won) {
    audio.waveClear();
    audio.levelup();
  } else {
    audio.roar();
  }
}

// Draft card geometry — must match screens.js drawDraft.
function draftCardAt(x, y) {
  if (!world.state.draft) return -1;
  const cardW = 250;
  const cardH = 300;
  const gap = 30;
  const n = world.state.draft.choices.length;
  const x0 = 640 - (n * cardW + (n - 1) * gap) / 2;
  const y0 = 210;
  if (y < y0 || y > y0 + cardH) return -1;
  for (let i = 0; i < n; i += 1) {
    const cx = x0 + i * (cardW + gap);
    if (x >= cx && x <= cx + cardW) return i;
  }
  return -1;
}

// ---- Shot mode: stage one deterministic frame and stop. ----
if (shotName) {
  try {
    const result = stageShot(shotName, world);
    screen = result.screen;
    if (screen === 'win' || screen === 'over') {
      isBest = true;
      best = {
        score: world.state.score,
        wave: world.state.wave,
        wins: screen === 'win' ? 1 : 0,
        kills: world.state.kills,
      };
    }
    drawFrame();
    window.__shotReady = true;
    window.__shotInfo = {
      shot: shotName,
      screen,
      wave: world.state.wave,
      score: world.state.score,
      kills: world.state.kills,
      level: world.state.level,
      boons: world.state.boons.length,
      enemies: world.state.enemies.length,
      time: Math.round(world.state.time * 10) / 10,
    };
  } catch (err) {
    window.__shotError = String(err && err.message ? err.message : err);
    window.__shotReady = true;
  }
} else {
  // ---- Live game. ----
  toTitle();
  let last = performance.now();
  let acc = 0;
  let prevShots = 0;
  let prevPickups = 0;
  let prevDashes = 0;
  let prevNovas = 0;
  let prevWave = 1;
  let prevBoss = false;
  let prevPlayerHp = world.state.player.hp;
  let prevHeartHp = world.state.heart.hp;

  function playStepSounds(events) {
    const state = world.state;
    if (state.stats.shots > prevShots) audio.shoot(state.player.weapon);
    if (state.stats.pickups > prevPickups) audio.pickup();
    if (state.stats.dashes > prevDashes) audio.dash();
    if (state.stats.novas > prevNovas) audio.nova();
    if (state.player.hp < prevPlayerHp) audio.hurt();
    if (state.heart.hp < prevHeartHp) audio.heartHit();
    if (state.wave > prevWave) {
      audio.waveClear();
      audio.setWave(state.wave);
    }
    if (state.boss && !prevBoss) audio.roar();
    if (events & EV_LEVEL) audio.levelup();
    prevShots = state.stats.shots;
    prevPickups = state.stats.pickups;
    prevDashes = state.stats.dashes;
    prevNovas = state.stats.novas;
    prevWave = state.wave;
    prevBoss = Boolean(state.boss);
    prevPlayerHp = state.player.hp;
    prevHeartHp = state.heart.hp;
  }

  function handleActions() {
    const actions = input.takeActions();
    const click = input.takeClick();
    const qEdge = input.cyclePressed && !prevQ;
    prevQ = input.cyclePressed;
    if (actions & ACTION_MUTE) {
      const m = !audio.muted;
      audio.setMuted(m);
      saveMuted(m);
    }
    if (actions & ACTION_PAUSE) {
      if (screen === 'play') screen = 'pause';
      else if (screen === 'pause') screen = 'play';
    }
    if (actions & ACTION_RESTART) {
      if (screen === 'play' || screen === 'pause' || screen === 'over' || screen === 'win') startRun();
    }
    if (qEdge && (screen === 'pause' || screen === 'over' || screen === 'win')) toTitle();
    if (actions & ACTION_CONFIRM) {
      audio.unlock();
      if (screen === 'title') startRun();
      else if (screen === 'over' || screen === 'win') startRun();
      else if (screen === 'pause') screen = 'play';
    }
    if (screen === 'draft') {
      let pick = -1;
      if (actions & ACTION_DRAFT1) pick = 0;
      else if (actions & ACTION_DRAFT2) pick = 1;
      else if (actions & ACTION_DRAFT3) pick = 2;
      else if (click) pick = draftCardAt(click.x, click.y);
      if (pick >= 0) {
        world.applyDraft(pick);
        if (world.state.phase === 'play') screen = 'play';
      }
    } else if (click && screen === 'title') {
      startRun();
    } else if (click && (screen === 'over' || screen === 'win')) {
      startRun();
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25;
    handleActions();
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < 5) {
      acc -= STEP;
      steps += 1;
      if (screen === 'title') {
        runAttract(world, STEP);
      } else if (screen === 'play') {
        const events = world.step(
          {
            move: input.move(),
            aim: input.aim(),
            dash: input.dashHeld,
            nova: input.novaHeld,
            weapon: input.weaponKey(),
            cycle: input.cyclePressed,
            draftPick: 0,
          },
          STEP,
        );
        playStepSounds(events);
        if (events & EV_OVER || events & EV_WIN) finishRun();
        else if (world.state.phase === 'draft') screen = 'draft';
      }
    }
    if (steps === 5) acc = 0;
    drawFrame();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === 'play') screen = 'pause';
  });
  requestAnimationFrame(frame);
}
