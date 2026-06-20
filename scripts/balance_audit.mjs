// Balance audit for the real (production) data model: monster_data.csv +
// stage_data.csv + exp_table.csv. Replicates the in-game formulas.
import fs from 'node:fs';
import path from 'node:path';

const dir = path.join(process.cwd(), 'src', 'data');
const rows = (f) => {
  const L = fs.readFileSync(path.join(dir, f), 'utf8').trim().split('\n').filter(l => !l.startsWith('#'));
  const h = L[0].split(',');
  return L.slice(1).map(l => Object.fromEntries(h.map((k, i) => [k, (l.split(',')[i] ?? '').trim()])));
};

const M = {};
for (const m of rows('monster_data.csv')) {
  M[m.id] = { ...m, hp: +m.hp, attack: +m.attack, expReward: +(m.expReward || 0) };
}
const stages = rows('stage_data.csv').map(s => ({ ...s, world: +s.world, order: +s.order, enemy_level: +s.enemy_level }));
const exp = rows('exp_table.csv').map(r => ({ level: +r.level, total: +r.total_exp }));
const levelFromExp = (e) => { for (let i = exp.length - 1; i >= 0; i--) if (e >= exp[i].total) return exp[i].level; return 1; };
const stat = (base, lvl) => Math.floor(base * (1 + (lvl - 1) * 0.1));

// element cycle: FIRE>NATURE>WATER>FIRE ; counter(X) = element that is super-effective vs X = X.weakness
const counters = (atkEl, defEl) => {
  // super effective if def's weakness == atk element
  return null; // handled via weakness field
};

console.log('=== PER-STAGE AUDIT (player EXP progression assumes clearing each stage once) ===');
console.log('stage    | type  | enemy(elem)              eLv | base hp/atk  effHP effATK | exp | playerLv | flags');
let playerExp = 0;
const placeholders = new Set();
let zeroExpStages = 0;
const enemyPowerSeq = [];
for (const s of stages) {
  const e = M[s.enemy_id];
  const pLv = levelFromExp(playerExp);
  if (!e) { console.log(`${s.level}-${s.world}-${s.order} MISSING ENEMY ${s.enemy_id}`); continue; }
  const effHp = stat(e.hp, s.enemy_level), effAtk = stat(e.attack, s.enemy_level);
  const isPlaceholder = e.hp === 100 && e.attack === 30;
  if (isPlaceholder) placeholders.add(e.id);
  if (e.expReward === 0) zeroExpStages++;
  enemyPowerSeq.push({ key: `${s.level}-${s.world}-${s.order}`, power: effHp * effAtk, type: s.stage_type });
  const flags = [
    isPlaceholder ? 'PLACEHOLDER(100/30)' : '',
    e.expReward === 0 ? 'ZERO_EXP' : '',
    s.stage_type === 'boss' && effHp < 200 ? 'WEAK_BOSS' : '',
  ].filter(Boolean).join(' ');
  console.log(
    `${(s.level + '-' + s.world + '-' + s.order).padEnd(8)} | ${s.stage_type.padEnd(5)} | ${(e.name + '(' + e.element + ')').padEnd(24)} ${String(s.enemy_level).padStart(3)} | ${String(e.hp).padStart(4)}/${String(e.attack).padStart(3)}   ${String(effHp).padStart(5)} ${String(effAtk).padStart(5)} | ${String(e.expReward).padStart(4)} | ${String(pLv).padStart(3)} (eLv ${s.enemy_level}) | ${flags}`
  );
  playerExp += e.expReward;
}

console.log('\n=== SUMMARY ===');
console.log('stages total:', stages.length);
console.log('stages giving ZERO exp:', zeroExpStages);
console.log('distinct placeholder (100/30) monsters used:', placeholders.size, [...placeholders].join(', '));

console.log('\n=== BOSS COUNTER-CHAIN: does a meta reward in/before the boss world give the boss\'s weakness element? ===');
// group stages per version+world
for (const s of stages.filter(x => x.stage_type === 'boss')) {
  const boss = M[s.enemy_id];
  const need = boss?.weakness; // element super-effective vs boss
  // meta rewards available up to and including this world (same version, world <= boss world)
  const priorMetas = stages
    .filter(x => x.level === s.level && (x.world < s.world || (x.world === s.world && x.order < s.order)))
    .map(x => M[x.meta_monster_id]).filter(Boolean);
  const hasCounter = priorMetas.some(m => m.element === need);
  // also the immediate previous stage's meta
  console.log(`${s.level}-${s.world}-${s.order} boss ${boss.name}(${boss.element}, weak→${need}) : counter available before? ${hasCounter ? 'YES' : 'NO  <-- chain gap'}`);
}

console.log('\n=== META REWARD vs NEXT STAGE ENEMY (is each reward useful next?) ===');
for (let i = 0; i < stages.length - 1; i++) {
  const s = stages[i], n = stages[i + 1];
  if (s.level !== n.level) continue;
  const reward = M[s.meta_monster_id], nextEnemy = M[n.enemy_id];
  if (!reward || !nextEnemy) continue;
  const superEff = nextEnemy.weakness === reward.element; // reward strong vs next
  const bad = reward.weakness === nextEnemy.element;      // reward weak to next
  const tag = superEff ? 'STRONG' : bad ? 'WEAK' : 'neutral';
  if (n.stage_type === 'boss' || tag !== 'neutral')
    console.log(`${s.level}-${s.world}-${s.order} reward ${reward.name}(${reward.element}) -> ${n.order===4?'BOSS ':''}${nextEnemy.name}(${nextEnemy.element}) : ${tag}`);
}
