// Game balance simulator — replicates the in-game formulas from src/lib/*
// to numerically check difficulty curves, EXP/level progression, evolution
// timing and the element/weakness chain.
import fs from 'node:fs';
import path from 'node:path';

const dataDir = path.join(process.cwd(), 'src', 'data');
const readCsv = (f) => {
  const lines = fs.readFileSync(path.join(dataDir, f), 'utf8').trim().split('\n');
  const headers = lines[0].split(',');
  return lines.slice(1).map((l) => {
    const v = l.split(',');
    return Object.fromEntries(headers.map((h, i) => [h, v[i]]));
  });
};

const evo = readCsv('evolution_data.csv');
const enemies = readCsv('enemy_data.csv');
const stageEnemies = readCsv('stage_enemies.csv');
const expTable = readCsv('exp_table.csv').map((r) => ({ level: +r.level, totalExp: +r.total_exp }));

const MONSTER = Object.fromEntries(evo.map((m) => [m.id, {
  ...m, baseHp: +m.baseHp, baseAttack: +m.baseAttack,
  strengths: m.elementalStrengths ? m.elementalStrengths.split('|') : [],
  weaknesses: m.elementalWeaknesses ? m.elementalWeaknesses.split('|') : [],
}]));
const ENEMY = Object.fromEntries(enemies.map((e) => [e.id, { ...e, hp: +e.hp, attack: +e.attack, expReward: +e.expReward }]));

// getMonsterStats: reads from MONSTER_DB (evolution_data) for BOTH player and enemy
const stats = (id, level) => {
  const m = MONSTER[id];
  if (!m) return { hp: 100, attack: 10 };
  const mult = 1 + (level - 1) * 0.1;
  return { hp: Math.floor(m.baseHp * mult), attack: Math.floor(m.baseAttack * mult) };
};
const getLevel = (exp) => {
  for (let i = expTable.length - 1; i >= 0; i--) if (exp >= expTable[i].totalExp) return expTable[i].level;
  return 1;
};

// Player monster line evolution (LEVEL based)
const checkEvo = (id, level) => {
  const m = MONSTER[id];
  if (m && m.evolutionConditionType === 'LEVEL' && level >= +m.evolutionConditionValue && m.nextFormId) return m.nextFormId;
  return null;
};

// Element multiplier from the PARTNER's perspective (as in BattleScene)
const dmgMult = (partnerId, enemyElement) => {
  const p = MONSTER[partnerId];
  if (p.strengths.includes(enemyElement)) return { atk: 2, label: 'SUPER' };
  if (p.weaknesses.includes(enemyElement)) return { atk: 0.5, label: 'weak' };
  return { atk: 1, label: '--' };
};
const enemyDmgMult = (partnerId, enemyElement) => MONSTER[partnerId].weaknesses.includes(enemyElement) ? 2 : 1;

const stagePlan = stageEnemies.map((s) => ({ stage: +s.stage_id, enemyId: ENEMY[s.enemy_id] ? s.enemy_id : s.enemy_id }));

// ---- Simulate a playthrough ----
// Assumptions: player accuracy `acc`. Each kanji attempt: correct => attack, wrong => enemy attacks.
function simulate({ starter = 'starter_fire', acc = 0.85, equipBestSkin = false, label = '' }) {
  let exp = 0, level = 1, partner = starter;
  const unlocked = new Set([starter]);
  const rows = [];
  for (const sp of stagePlan) {
    const enemy = ENEMY[sp.enemyId];
    // possibly equip a better skin (element advantage or higher base atk)
    if (equipBestSkin) {
      let best = partner, bestScore = -1;
      for (const id of unlocked) {
        const m = MONSTER[id]; if (!m) continue;
        const adv = m.strengths.includes(enemy.element) ? 2 : m.weaknesses.includes(enemy.element) ? 0.5 : 1;
        const score = m.baseAttack * adv;
        if (score > bestScore) { bestScore = score; best = id; }
      }
      partner = best;
    }
    // evolve check at current level (player-line only)
    let next; while ((next = checkEvo(partner, level))) { partner = next; unlocked.add(partner); }

    const ps = stats(partner, level);
    const es = { hp: enemy.hp, attack: enemy.attack }; // enemies use FIXED per-stage stats (enemy_data.csv)
    const m = dmgMult(partner, enemy.element);
    const playerDmg = Math.floor(ps.attack * m.atk) || 1;
    const enemyDmg = Math.floor(es.attack * enemyDmgMult(partner, enemy.element)) || 1;

    const hitsToKill = Math.ceil(es.hp / playerDmg);
    const mistakesToDie = Math.ceil(ps.hp / enemyDmg);
    // expected attempts to land hitsToKill correct = hitsToKill/acc; wrong attempts ~ hitsToKill*(1-acc)/acc
    const expectedWrong = hitsToKill * (1 - acc) / acc;
    const survives = expectedWrong < mistakesToDie;
    // worst-case difficulty ratio: how close to dying (lower margin = harder). margin>1 win
    const margin = (mistakesToDie / Math.max(0.01, expectedWrong));

    rows.push({
      stage: sp.stage, enemy: enemy.name, eEl: enemy.element, partner: MONSTER[partner].name, pEl: MONSTER[partner].element,
      lvl: level, match: m.label, pHP: ps.hp, pATK: playerDmg, eHP: es.hp, eATK: enemyDmg,
      hitsToKill, mistakesToDie, expWrong: +expectedWrong.toFixed(1), margin: +margin.toFixed(2), survives,
    });

    // gain EXP: write EXP (10 per correct hit) + stage clear reward
    exp += hitsToKill * 10 + enemy.expReward;
    level = getLevel(exp);
    // acquire the defeated enemy as a skin
    unlocked.add(enemy.id);
  }
  return rows;
}

function printRows(title, rows) {
  console.log('\n=== ' + title + ' ===');
  console.log('St | Enemy(El)         | Partner(El)       Lv | Match | pHP  pATK | eHP  eATK | kill die expWrong margin');
  for (const r of rows) {
    console.log(
      `${String(r.stage).padStart(2)} | ${(r.enemy + '(' + r.eEl + ')').padEnd(17)} | ${(r.partner + '(' + r.pEl + ')').padEnd(17)} ${String(r.lvl).padStart(2)} | ${r.match.padEnd(5)} | ${String(r.pHP).padStart(4)} ${String(r.pATK).padStart(4)} | ${String(r.eHP).padStart(4)} ${String(r.eATK).padStart(4)} | ${String(r.hitsToKill).padStart(3)} ${String(r.mistakesToDie).padStart(3)} ${String(r.expWrong).padStart(6)} ${String(r.margin).padStart(6)} ${r.survives ? '' : '  <-- LIKELY LOSS'}`
    );
  }
}

for (const starter of ['starter_fire', 'starter_water', 'starter_nature']) {
  printRows(`Playthrough acc=85% starter=${starter} (no skin swap)`, simulate({ starter, acc: 0.85 }));
}
printRows('Playthrough acc=85% fire + EQUIP BEST SKIN each stage (optimizer)', simulate({ starter: 'starter_fire', acc: 0.85, equipBestSkin: true }));
printRows('Playthrough acc=95% fire (skilled player)', simulate({ starter: 'starter_fire', acc: 0.95 }));
printRows('Playthrough acc=70% fire (struggling player)', simulate({ starter: 'starter_fire', acc: 0.70 }));

// Element-chain analysis: does each stage's reward help the NEXT stage?
console.log('\n=== ELEMENT CHAIN: does defeating stage N give a monster strong vs stage N+1? ===');
for (let i = 0; i < stagePlan.length - 1; i++) {
  const cur = ENEMY[stagePlan[i].enemyId];
  const nxt = ENEMY[stagePlan[i + 1].enemyId];
  const reward = MONSTER[cur.id]; // the skin you get
  const rel = reward.strengths.includes(nxt.element) ? 'STRONG (good)'
    : reward.weaknesses.includes(nxt.element) ? 'WEAK (bad!)' : 'neutral';
  console.log(`Stage ${stagePlan[i].stage} reward ${reward.name}(${reward.element}) vs Stage ${stagePlan[i+1].stage} ${nxt.name}(${nxt.element}) => ${rel}`);
}
