// DOM-free combat presentation helpers. These functions only forecast already-
// telegraphed state; they never mutate combat or decide game outcomes.

// Estimate how much Block a plainly printed Block card would add. Dynamic cards
// deliberately return only their printed floor: the preview must never promise
// a conditional bonus that may not resolve.
export function previewCardBlock(combat, card) {
  if (!combat || !card || !card.block || card.type !== 'skill') return 0;
  const player = combat.player;
  if (player.powers.noBlock) return 0;
  let amount = card.block + (player.powers.dexterity || 0);
  if (player.powers.frail) amount = Math.floor(amount * 0.75);
  return Math.max(0, amount);
}

// Simulate a telegraphed enemy attack hit-by-hit. Sapped and Exposed are
// hit-counted in the real engine, so the preview consumes local copies as it
// goes instead of multiplying every hit by a stack that may expire mid-flurry.
export function previewEnemyAttack(combat, enemy, intent, { bonusBlock = 0 } = {}) {
  if (!combat || !enemy || !intent || !String(intent.type || '').startsWith('attack')) return null;

  const player = combat.player;
  const hits = Math.max(1, intent.hits || 1);
  let block = Math.max(0, player.block + bonusBlock);
  let hp = player.hp;
  let weak = Math.max(0, enemy.powers.weak || 0);
  let vulnerable = Math.max(0, player.powers.vulnerable || 0);
  let blocked = 0;
  let hpLost = 0;
  const perHit = [];

  for (let i = 0; i < hits; i++) {
    let dmg = (intent.dmg || 0) + (enemy.powers.strength || 0);
    if (weak > 0) dmg = Math.floor(dmg * 0.75);
    if (vulnerable > 0) dmg = Math.floor(dmg * 1.5);
    dmg = Math.max(0, Math.round(dmg * combat.run.enemyDamageMult()));
    if (player.powers.intangible && dmg > 1) dmg = 1;

    const absorbed = Math.min(block, dmg);
    const lost = Math.max(0, dmg - absorbed);
    block -= absorbed;
    hp = Math.max(0, hp - lost);
    blocked += absorbed;
    hpLost += lost;
    perHit.push(dmg);
    if (weak > 0) weak -= 1;
    if (vulnerable > 0) vulnerable -= 1;
  }

  const total = perHit.reduce((sum, n) => sum + n, 0);
  const lethal = hpLost >= player.hp;
  const heavy = !lethal && hpLost > 0 && (hpLost >= 14 || hpLost >= player.maxHp * 0.22);
  const guarded = hpLost === 0 && blocked > 0;

  return {
    hits,
    perHit,
    total,
    blocked,
    hpLost,
    afterBlock: block,
    afterHp: hp,
    lethal,
    heavy,
    guarded,
    severity: lethal ? 'lethal' : heavy ? 'danger' : guarded ? 'guarded' : 'routine',
  };
}

export function attackNotation(preview) {
  if (!preview || !preview.perHit.length) return '';
  const same = preview.perHit.every((n) => n === preview.perHit[0]);
  if (same) return preview.hits > 1 ? `${preview.perHit[0]} × ${preview.hits}` : String(preview.perHit[0]);
  return preview.perHit.join(' + ');
}

export function intentDescription(intent, preview) {
  const lines = [];
  if (preview) {
    lines.push(`Attack for ${attackNotation(preview)} damage.`);
    if (preview.guarded) lines.push(`Your Block absorbs all ${preview.total}.`);
    else if (preview.blocked > 0) lines.push(`${preview.blocked} is blocked; ${preview.hpLost} reaches HP.`);
    else lines.push(`${preview.hpLost} reaches HP.`);
  } else if (intent.block) {
    lines.push(`Gain ${intent.block} Block.`);
  }
  if (intent.gold) lines.push(`Steal up to ${intent.gold} Gold.`);
  if (intent.detail) lines.push(intent.detail);
  if (!lines.length) {
    if (String(intent.type || '').includes('debuff')) lines.push('Apply a debuff.');
    else if (String(intent.type || '').includes('buff')) lines.push('Gain a buff.');
    else lines.push('The outcome is concealed.');
  }
  return lines.join(' ');
}

// A single authored cadence for enemy actions. Routine utility moves should
// read briskly, while multi-hit and high-damage attacks keep enough wind-up to
// feel dangerous. This is presentation-only: the returned values never alter
// combat outcomes.
export function enemyMovePacing(intent = {}, { boss = false } = {}) {
  const type = String(intent.type || '');
  const hits = Math.max(1, intent.hits || 1);
  const totalDamage = Math.max(0, intent.dmg || 0) * hits;
  const heavy = type.startsWith('attack') && (totalDamage >= 18 || hits >= 3);
  if (heavy) return { read: boss ? 720 : 680, settle: 560, weight: 'heavy' };
  if (type.startsWith('attack')) return { read: 560, settle: 440, weight: 'attack' };
  return { read: 480, settle: 390, weight: 'utility' };
}

// Convert already-resolved hit facts into a purely cosmetic impact tier. The
// combat engine remains authoritative; this only gives every view the same
// language for ordinary, heavy, and marquee plays.
export function impactProfile({
  lethal = false,
  hpLost = 0,
  charge = 0,
  rhythmGrade = null,
  synergy = false,
  guardBroken = false,
} = {}) {
  let score = 0;
  if (hpLost >= 14) score += 1;
  if (charge >= 3) score += 1;
  if (synergy) score += 1;
  if (guardBroken) score += 1;
  if (rhythmGrade === 'perfect') score += 2;
  if (lethal) score += 4;
  const tier = score >= 4 ? 'apex' : score >= 2 ? 'heavy' : 'standard';
  return {
    tier,
    hitStop: tier === 'apex' ? 145 : tier === 'heavy' ? 105 : 0,
    particles: tier === 'apex' ? 34 : tier === 'heavy' ? 20 : 10,
    label: lethal ? 'FINISH' : rhythmGrade === 'perfect' ? 'PERFECT' : synergy ? 'SYNERGY' : guardBroken ? 'BREAK' : null,
  };
}
