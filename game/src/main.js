// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between six screens: title, play, draft,
// paused, game over and victory.
//
// ?seed=N fixes the run's random pattern. ?shot=title|play|draft|victory (with
// &seed=N) stages that scene instead of running the loop, paints it twice and
// sets window.__shotReady for a screenshot.

import { FIELD, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BOSS, EVENT_GAME_OVER, EVENT_LEVEL_UP, EVENT_REVIVED, EVENT_VICTORY } from './world.js';
import { ACTION_CONFIRM, ACTION_DASH, ACTION_MUTE, ACTION_ONE, ACTION_PAUSE, ACTION_RESTART, ACTION_THREE, ACTION_TWO, createInput } from './input.js';
import { createRenderer } from './render.js';
import { createAudio } from './audio.js';
import { readRecords, saveBest, saveBestWave, saveMuted, saveWins } from './storage.js';
import { SCREEN_DRAFT, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_VICTORY, drawDraft, drawGameOver, drawPaused, drawTitle, drawVictory, hitButton } from './screens.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas, seed);
const records = readRecords();

// A few wisps drifting behind the title screen, placed with the run's seed.
const moteRandom = createRandom((seed ^ 0x51ed) >>> 0);
const MOTES = ['#8f7bff', '#4dd8ff', '#ff7ad9', '#7dffb0', '#ffb14d'].map((color) => ({
  color,
  x: moteRandom.next() * FIELD.width,
  y: 80 + moteRandom.next() * (FIELD.height - 160),
  speed: 8 + moteRandom.next() * 14,
  phase: moteRandom.next() * Math.PI * 2,
}));

function runShot(name) {
  const scene = stageShot(name, world);
  // The staged records a fresh player would carry: no best yet, so a victory
  // shows its NEW BEST star the way a first win would.
  const shotRecords = { best: 0, bestWave: 0, wins: 0 };
  let painted = 0;
  function paint() {
    const time = world.time + 5;
    if (scene.screen === SCREEN_TITLE) {
      renderer.drawAmbient(time, MOTES);
      drawTitle(ctxOf(), shotRecords, null, time);
    } else if (scene.screen === SCREEN_DRAFT) {
      renderer.drawWorld(world, time);
      renderer.drawHUD(world, shotRecords);
      drawDraft(ctxOf(), world, null);
    } else if (scene.screen === SCREEN_VICTORY) {
      renderer.drawWorld(world, time);
      drawVictory(ctxOf(), world, shotRecords, true, null);
    } else if (scene.screen === SCREEN_OVER) {
      renderer.drawWorld(world, time);
      // The staged loss beats a fresh player's best of 0 only if it scored.
      drawGameOver(ctxOf(), world, shotRecords, world.score > 0, null);
    } else {
      renderer.drawWorld(world, time);
      renderer.drawHUD(world, shotRecords);
    }
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function ctxOf() {
  return canvas.getContext('2d');
}

function runGame() {
  const input = createInput(canvas);
  const audio = createAudio(records.muted);
  let screen = SCREEN_TITLE;
  let buttons = [];
  let accumulator = 0;
  let last = performance.now();
  let isNewBest = false;
  let runBestWave = 1;

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    world.reset();
    runBestWave = 1;
    isNewBest = false;
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.waveStart();
    announce('Playing. Wave 1. Survive ten waves.');
  }

  function finishRun(won) {
    runBestWave = Math.max(runBestWave, world.wave);
    if (world.score > records.best) {
      isNewBest = true;
      records.best = world.score;
      saveBest(world.score);
    }
    if (runBestWave > records.bestWave) {
      records.bestWave = runBestWave;
      saveBestWave(runBestWave);
    }
    if (won) {
      records.wins += 1;
      saveWins(records.wins);
      screen = SCREEN_VICTORY;
      audio.victory();
      announce(`Victory. Dawn breaks. Score ${world.score}.`);
    } else {
      screen = SCREEN_OVER;
      audio.gameOver();
      announce(`Game over on wave ${world.wave}. Score ${world.score}. Best ${records.best}.`);
    }
  }

  function toggleMute() {
    const muted = !audio.isMuted();
    audio.setMuted(muted);
    saveMuted(muted);
    announce(muted ? 'Sound off.' : 'Sound on.');
  }

  function aimPoint() {
    const aim = input.aim();
    if (aim.seen) return { x: aim.x, y: aim.y };
    // No mouse yet (keyboard-only play): aim at the nearest gloom-spawn.
    let nearest = null;
    let nearestDistance = Infinity;
    for (const enemy of world.enemies.list) {
      const distance = Math.hypot(enemy.x - world.player.x, enemy.y - world.player.y);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = enemy;
      }
    }
    return nearest ? { x: nearest.x, y: nearest.y } : { x: world.player.x, y: world.player.y - 100 };
  }

  function handleEvents(events) {
    if (events & EVENT_BOSS) {
      audio.bossRoar();
      announce('The Gloom Herald has come.');
    }
    if (events & EVENT_LEVEL_UP) {
      world.beginDraft();
      screen = SCREEN_DRAFT;
      audio.levelUp();
      announce(`Level ${world.player.level}. Choose a boon.`);
    }
    if (events & EVENT_REVIVED) {
      announce('Second Wind — the dawn returns you.');
    }
    if (events & EVENT_VICTORY) finishRun(true);
    else if (events & EVENT_GAME_OVER) finishRun(false);
  }

  function handleActions(actions, click) {
    if (actions & ACTION_MUTE) toggleMute();
    const pressed = hitButton(buttons, click);
    if (actions & ACTION_CONFIRM) audio.unlock();
    if (click) audio.unlock();

    if (screen === SCREEN_TITLE) {
      if ((actions & ACTION_CONFIRM) || pressed === 'start') startGame();
      return;
    }
    if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (actions & ACTION_RESTART) {
        startGame();
      }
      return;
    }
    if (screen === SCREEN_DRAFT) {
      let choice = -1;
      if (actions & ACTION_ONE) choice = 0;
      else if (actions & ACTION_TWO) choice = 1;
      else if (actions & ACTION_THREE) choice = 2;
      else if (pressed && pressed.startsWith('card-')) choice = Number(pressed.slice(5));
      if (choice >= 0 && choice < world.draftChoices.length) {
        world.chooseDraft(choice);
        audio.draftPick();
        if (world.draftPending <= 0) {
          screen = SCREEN_PLAY;
          announce('Playing.');
        }
      }
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if ((actions & ACTION_PAUSE) || pressed === 'resume') {
        screen = SCREEN_PLAY;
        announce('Playing.');
      } else if (pressed === 'restart' || (actions & ACTION_RESTART)) {
        startGame();
      } else if (pressed === 'mute') {
        toggleMute();
      } else if (pressed === 'title') {
        screen = SCREEN_TITLE;
        announce('Title screen.');
      }
      return;
    }
    if (screen === SCREEN_OVER || screen === SCREEN_VICTORY) {
      if ((actions & ACTION_RESTART) || (actions & ACTION_CONFIRM) || pressed === 'retry' || pressed === 'again') {
        startGame();
      } else if (pressed === 'title') {
        screen = SCREEN_TITLE;
        announce('Title screen.');
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const realDt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    const click = input.takeClick();
    const mouse = input.aim();
    handleActions(actions, click);
    audio.update(realDt);

    if (screen === SCREEN_PLAY) {
      accumulator += realDt;
      let dashQueued = Boolean(actions & ACTION_DASH);
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        const events = world.step(STEP, {
          direction: input.direction(),
          aim: aimPoint(),
          firing: input.firing(),
          dash: dashQueued,
        }, audio);
        dashQueued = false;
        accumulator -= STEP;
        handleEvents(events);
        runBestWave = Math.max(runBestWave, world.wave);
      }
    } else {
      accumulator = 0;
      // Sparks keep drifting on the end screens; the world itself is frozen.
      if (screen === SCREEN_OVER || screen === SCREEN_VICTORY) world.particles.update(realDt);
    }

    const time = world.time + now / 1000;
    const ctx = canvas.getContext('2d');
    if (screen === SCREEN_TITLE) {
      renderer.drawAmbient(now / 1000, MOTES);
      buttons = drawTitle(ctx, records, mouse, now / 1000).buttons;
    } else if (screen === SCREEN_DRAFT) {
      renderer.drawWorld(world, time);
      renderer.drawHUD(world, records);
      buttons = drawDraft(ctx, world, mouse).buttons;
    } else if (screen === SCREEN_PAUSED) {
      renderer.drawWorld(world, time);
      renderer.drawHUD(world, records);
      buttons = drawPaused(ctx, mouse, audio.isMuted()).buttons;
    } else if (screen === SCREEN_OVER) {
      renderer.drawWorld(world, time);
      buttons = drawGameOver(ctx, world, records, isNewBest, mouse).buttons;
    } else if (screen === SCREEN_VICTORY) {
      renderer.drawWorld(world, time);
      buttons = drawVictory(ctx, world, records, isNewBest, mouse).buttons;
    } else {
      renderer.drawWorld(world, time);
      renderer.drawHUD(world, records);
      buttons = [];
    }
  }

  // Leaving the tab pauses a running game rather than letting the gloom close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  world.reset();
  announce('Lumen Drift. Press Space or click Begin to play.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
