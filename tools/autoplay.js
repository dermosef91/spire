// Autoplay runner: drives the game at https://dermosef91.github.io/spire/ through a full playthrough.
// Logs state and takes screenshots of key moments.

import { spawn, execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { setTimeout as sleep } from 'node:timers/promises';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT_DIR = join(ROOT, 'docs', 'qa', 'autoplay');

const CHROMIUM = existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
  ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (e) {
  try {
    const globalRoot = execSync('npm root -g').toString().trim();
    ({ chromium } = require(require.resolve('playwright', { paths: [globalRoot] })));
  } catch (err) {
    console.error('Playwright is not available in this environment:', err.message);
    process.exit(2);
  }
}

// Target URL
const TARGET_URL = process.env.PLAY_URL || 'https://dermosef91.github.io/spire/';

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  console.log(`Starting autoplay playthrough on: ${TARGET_URL}`);

  const launchOptions = { headless: true };
  if (existsSync(CHROMIUM)) {
    launchOptions.executablePath = CHROMIUM;
    launchOptions.args = ['--no-sandbox'];
  }
  
  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({
    viewport: { width: 1024, height: 768 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  });

  // Inject meta state to skip tutorial and disable rhythm (to bypass QTEs for rapid headless play)
  await context.addInitScript(() => {
    try {
      localStorage.setItem('spire_of_ase_meta_v1', JSON.stringify({
        tutorialDone: true,
        multiEnemyTutorialDone: true,
        rhythm: false, // Disable rhythm game
        runs: 0,
        wins: 0,
        bestFloor: 0,
        ascension: 0,
        maxAscension: 0
      }));
    } catch {}
  });

  const page = await context.newPage();
  
  // Log console messages
  page.on('console', msg => {
    const text = msg.text();
    if (text.startsWith('Autoplay:')) {
      console.log(text);
    } else if (msg.type() === 'error') {
      console.warn(`Browser Error: ${text}`);
    }
  });

  page.on('pageerror', err => {
    console.error(`Browser Page Error: ${err.message}`);
  });

  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__ase, null, { timeout: 10000 });

  // Expose function to take screenshots
  let shotCount = 0;
  async function takeScreenshot(name) {
    shotCount++;
    const pad = String(shotCount).padStart(3, '0');
    const filename = `${pad}-${name}.jpg`;
    const filepath = join(OUT_DIR, filename);
    await page.screenshot({ path: filepath, type: 'jpeg', quality: 80 });
    console.log(`[Screenshot saved: ${filename}]`);
  }

  // The in-page autoplay logic
  await page.exposeFunction('hostLog', (msg) => {
    console.log(`[Page] ${msg}`);
  });

  await page.exposeFunction('hostScreenshot', async (name) => {
    await takeScreenshot(name);
  });

  // Evaluate the loop inside the browser context
  await page.evaluate(async () => {
    let lastActionTime = Date.now();
    let stepCount = 0;
    let lastSceneClass = '';
    let stuckCounter = 0;

    async function tick() {
      try {
        const game = window.__ase;
        if (!game) return;

        const bodyClass = document.body.className;
        // Detect current scene class
        const sceneClassMatch = bodyClass.match(/scene-(\S+)/);
        const sceneClass = sceneClassMatch ? sceneClassMatch[1] : '';

        // If the scene changed, take a screenshot
        if (sceneClass !== lastSceneClass) {
          lastSceneClass = sceneClass;
          await window.hostScreenshot(`scene_${sceneClass || 'unknown'}`);
          await window.hostLog(`Entered Scene: ${sceneClass || 'unknown'}`);
          stuckCounter = 0;
        }

        // Print basic run metrics
        if (game.run) {
          const run = game.run;
          // Periodically log status
          if (stepCount % 10 === 0) {
            await window.hostLog(`Run Stats: HP=${run.hp}/${run.maxHp}, Gold=${run.gold}, Act=${run.act}, Floor=${run.position ? run.position.row : 'start'}`);
          }
        }

        stepCount++;

        // 1. Check overlays (highest priority)
        // Confirm box
        const confirmBox = document.querySelector('.overlay-box.confirm-box');
        if (confirmBox && confirmBox.offsetHeight > 0) {
          const useBtn = Array.from(confirmBox.querySelectorAll('button')).find(b => b.textContent.includes('Use') || b.textContent.includes('Yes'));
          if (useBtn) {
            await window.hostLog("Overlay: Clicking Confirm");
            useBtn.click();
            lastActionTime = Date.now();
            return;
          }
        }

        // Reforge Smith preview
        const smithPreview = document.querySelector('.overlay-box.smith-preview');
        if (smithPreview && smithPreview.offsetHeight > 0) {
          const reforgeBtn = Array.from(smithPreview.querySelectorAll('button')).find(b => b.textContent.includes('Reforge') || b.textContent.includes('Confirm'));
          if (reforgeBtn) {
            await window.hostLog("Overlay: Clicking Reforge Confirm");
            reforgeBtn.click();
            lastActionTime = Date.now();
            return;
          }
        }

        // Card choice picker overlay (e.g. post-combat card choice)
        const cardPicker = document.querySelector('.card-picker');
        if (cardPicker && cardPicker.offsetHeight > 0) {
          // Check if there is a selected card already. If yes, double tap it. If not, select the first card.
          const selectedCard = cardPicker.querySelector('.card.selected');
          if (selectedCard) {
            await window.hostLog("Overlay: Confirming selected card");
            selectedCard.click();
          } else {
            const firstCard = cardPicker.querySelector('.card');
            if (firstCard) {
              await window.hostLog("Overlay: Selecting first card");
              firstCard.click();
            } else {
              const skipBtn = Array.from(cardPicker.querySelectorAll('button')).find(b => b.textContent.includes('Skip'));
              if (skipBtn) {
                await window.hostLog("Overlay: Clicking Skip card choice");
                skipBtn.click();
              }
            }
          }
          lastActionTime = Date.now();
          return;
        }

        // Deck picker overlay (e.g. for reforge or removal)
        const deckOverlay = document.querySelector('.deck-overlay');
        if (deckOverlay && deckOverlay.offsetHeight > 0) {
          const firstCard = deckOverlay.querySelector('.card:not(.disabled)');
          if (firstCard) {
            await window.hostLog("Overlay: Picking first valid card from deck");
            firstCard.click();
          } else {
            const cancelBtn = Array.from(deckOverlay.querySelectorAll('button')).find(b => b.textContent.includes('Cancel') || b.textContent.includes('Close'));
            if (cancelBtn) {
              await window.hostLog("Overlay: Clicking Cancel deck overlay");
              cancelBtn.click();
            }
          }
          lastActionTime = Date.now();
          return;
        }

        // Pile preview overlay (draw/discard pile)
        const pileOverlay = document.querySelector('.pile-overlay');
        if (pileOverlay && pileOverlay.offsetHeight > 0) {
          const closeBtn = Array.from(pileOverlay.querySelectorAll('button')).find(b => b.textContent.includes('Close') || b.textContent.includes('Cancel'));
          if (closeBtn) {
            await window.hostLog("Overlay: Closing pile overlay");
            closeBtn.click();
            lastActionTime = Date.now();
            return;
          }
        }

        // Helper: get all buttons that are not in the topbar
        const getNonTopbarButtons = (parent = document) => {
          return Array.from(parent.querySelectorAll('button')).filter(b => !b.closest('.topbar'));
        };

        // 2. Scene-specific actions
        // Title Screen
        if (sceneClass === 'title') {
          const newRunBtn = getNonTopbarButtons().find(b => b.textContent.includes('New Run'));
          if (newRunBtn) {
            await window.hostLog("Scene title: Clicking New Run");
            newRunBtn.click();
            lastActionTime = Date.now();
            return;
          }
        }

        // Character Select
        if (sceneClass === 'charselect') {
          const beginBtn = document.querySelector('.charselect button.begin-btn, .charselect button');
          if (beginBtn && !beginBtn.disabled) {
            await window.hostLog("Scene charselect: Clicking Begin");
            beginBtn.click();
            lastActionTime = Date.now();
            return;
          } else {
            // Select first character card
            const firstCharCard = document.querySelector('.char-card:not(.char-locked)');
            if (firstCharCard) {
              await window.hostLog("Scene charselect: Clicking first character card");
              firstCharCard.click();
              lastActionTime = Date.now();
              return;
            }
          }
        }

        // Act Intro
        if (sceneClass === 'intro' || document.querySelector('.act-intro')) {
          const enterBtn = getNonTopbarButtons().find(b => b.textContent.includes('Enter') || b.textContent.includes('Continue'));
          if (enterBtn) {
            await window.hostLog("Scene act-intro: Clicking Enter");
            enterBtn.click();
            lastActionTime = Date.now();
            return;
          }
        }

        // Map Scene
        if (sceneClass === 'map') {
          // Check if there is a Boss reward or something overlaying
          const bossRewardOverlay = document.querySelector('.boss-relic-picker');
          if (bossRewardOverlay) {
            const firstRelic = bossRewardOverlay.querySelector('.relic-reward');
            if (firstRelic) {
              await window.hostLog("Map overlay: Picking boss relic");
              firstRelic.click();
              lastActionTime = Date.now();
              return;
            }
          }

          const reachableNodes = Array.from(document.querySelectorAll('.map-node.reachable'));
          if (reachableNodes.length > 0) {
            // Prioritize campfire (rest), then treasure, then events, then shop, then elite, then combat
            const priorityNode = reachableNodes.find(n => n.classList.contains('node-rest')) ||
                                 reachableNodes.find(n => n.classList.contains('node-treasure')) ||
                                 reachableNodes.find(n => n.classList.contains('node-event')) ||
                                 reachableNodes[0];

            await window.hostLog(`Scene map: Entering node type=${priorityNode.className} title=${priorityNode.title}`);
            priorityNode.click();
            lastActionTime = Date.now();
            return;
          }
        }

        // Combat Scene
        if (sceneClass === 'combat') {
          const combat = window.__combat;
          const view = game.combatView;

          if (combat && view) {
            if (combat.over) {
              await window.hostLog("Combat: Fight is over, waiting...");
              lastActionTime = Date.now();
              return;
            }

            if (combat.animating) {
              return;
            }

            // Play cards
            const hand = combat.hand || [];
            let playedCard = false;
            for (const card of hand) {
              if (combat.canPlay(card)) {
                const living = combat.livingEnemies();
                const target = card.target === 'enemy' ? (living[0] || combat.randomEnemy()) : null;
                await window.hostLog(`Combat: Playing card=${card.name} target=${target ? target.name : 'none'}`);
                
                // Directly call playCard to bypass drag & drop / QTE
                await view.playCard(card, target);
                playedCard = true;
                break; // Play one card per tick to let state update
              }
            }

            if (!playedCard) {
              await window.hostLog("Combat: Ending Turn");
              view.endTurn();
            }

            lastActionTime = Date.now();
            return;
          }
        }

        // Reward Scene
        if (sceneClass === 'reward' || document.querySelector('.reward-scene')) {
          const rewardRows = Array.from(document.querySelectorAll('.reward-row'));
          if (rewardRows.length > 0) {
            await window.hostLog(`Scene reward: Taking reward: ${rewardRows[0].textContent.trim()}`);
            rewardRows[0].click();
            lastActionTime = Date.now();
            return;
          }
          const proceedBtn = getNonTopbarButtons().find(b => b.textContent.includes('Continue') || b.textContent.includes('Proceed'));
          if (proceedBtn) {
            await window.hostLog("Scene reward: Clicking Continue");
            proceedBtn.click();
            lastActionTime = Date.now();
            return;
          }
        }

        // Rest Scene
        if (sceneClass === 'rest' || document.querySelector('.rest-scene')) {
          const restBtns = getNonTopbarButtons(document.querySelector('.rest-scene') || document);
          if (restBtns.length > 0) {
            const actionBtn = restBtns.find(b => b.textContent.includes('Rest') || b.textContent.includes('Upgrade') || b.textContent.includes('Smith') || b.textContent.includes('Reforge')) || restBtns[0];
            await window.hostLog(`Scene rest: Clicking option: ${actionBtn.textContent.trim()}`);
            actionBtn.click();
            lastActionTime = Date.now();
            return;
          }
        }

        // Event Scene (Fixed Choice and Continue selector)
        if (sceneClass === 'event' || document.querySelector('.event-scene')) {
          // If choices are present, we click a choice button inside .choices
          const choicesContainer = document.querySelector('.event-scene .choices, .choices');
          if (choicesContainer) {
            const choiceBtns = getNonTopbarButtons(choicesContainer);
            if (choiceBtns.length > 0) {
              await window.hostLog(`Scene event choice: Selecting option: "${choiceBtns[0].textContent.trim()}"`);
              choiceBtns[0].click();
              lastActionTime = Date.now();
              return;
            }
          }
          
          // If no choices container or choiceBtns, we must be in the result overlay. Look for "Continue" button
          const continueBtn = getNonTopbarButtons(document.querySelector('.event-scene') || document)
            .find(b => b.textContent.includes('Continue') || b.textContent.includes('Proceed'));
          
          if (continueBtn) {
            await window.hostLog(`Scene event result: Clicking Continue button: "${continueBtn.textContent.trim()}"`);
            continueBtn.click();
            lastActionTime = Date.now();
            return;
          }
        }

        // Shop Scene
        if (sceneClass === 'shop' || document.querySelector('.shop-scene')) {
          const leaveBtn = getNonTopbarButtons().find(b => b.textContent.includes('Leave') || b.textContent.includes('Map') || b.textContent.includes('Continue'));
          if (leaveBtn) {
            await window.hostLog("Scene shop: Leaving Shop");
            leaveBtn.click();
            lastActionTime = Date.now();
            return;
          }
        }

        // Treasure Scene
        if (sceneClass === 'treasure' || document.querySelector('.treasure-scene')) {
          const openBtn = getNonTopbarButtons().find(b => b.textContent.includes('Open') || b.textContent.includes('Continue'));
          if (openBtn) {
            await window.hostLog("Scene treasure: Clicking Open/Continue");
            openBtn.click();
            lastActionTime = Date.now();
            return;
          }
        }

        // End Scene
        if (sceneClass === 'end' || document.querySelector('.end-scene')) {
          await window.hostLog("Scene end: Playthrough complete!");
          await window.hostScreenshot("playthrough_complete");
          return;
        }

        // Check if stuck
        if (Date.now() - lastActionTime > 8000) {
          stuckCounter++;
          await window.hostLog(`WARNING: No action performed for ${Math.round((Date.now() - lastActionTime)/1000)}s (stuckCounter=${stuckCounter})`);
          if (stuckCounter >= 3) {
            await window.hostLog("STUCK! Taking screenshot and forcing a retry or click.");
            await window.hostScreenshot("stuck_state");
            
            // Try clicking any non-topbar button that's not disabled
            const anyBtn = getNonTopbarButtons().find(b => !b.disabled);
            if (anyBtn) {
              await window.hostLog(`Stuck: Trying to force-click button: ${anyBtn.textContent}`);
              anyBtn.click();
            }
            lastActionTime = Date.now();
            stuckCounter = 0;
          }
        }

      } catch (err) {
        await window.hostLog(`ERROR in tick: ${err.message}`);
      }
    }

    // Run tick every 500ms
    setInterval(tick, 500);
  });

  // Run for a maximum of 3 minutes or until completion
  console.log("Autoplay is active. Waiting for playthrough to complete...");
  
  let done = false;
  const startTime = Date.now();
  
  while (!done) {
    await sleep(2000);
    const elapsedSec = Math.round((Date.now() - startTime) / 1000);
    
    const isEnd = await page.evaluate(() => {
      const endEl = document.querySelector('.scene.end, .end-scene');
      const isDead = window.__ase && window.__ase.run && window.__ase.run.isDead();
      return !!endEl || isDead;
    });

    if (isEnd) {
      console.log("Game end state detected (Victory or Defeat). Stopping autoplay.");
      await takeScreenshot("game_finished");
      done = true;
    } else if (elapsedSec > 180) { // 3 minutes limit
      console.log("Playthrough timeout (3 mins). Stopping autoplay.");
      await takeScreenshot("timeout");
      done = true;
    }
  }

  // Check console log for final results
  const summary = await page.evaluate(() => {
    if (window.__ase && window.__ase.run) {
      const run = window.__ase.run;
      return {
        dead: run.isDead(),
        hp: run.hp,
        maxHp: run.maxHp,
        gold: run.gold,
        act: run.act,
        floor: run.position ? run.position.row : -1,
        relics: run.relics
      };
    }
    return null;
  });

  console.log("Autoplay Summary:", JSON.stringify(summary, null, 2));

  await browser.close();
}

main().catch(err => {
  console.error("AUTOPLAY FAILURE:", err);
  process.exit(1);
});
