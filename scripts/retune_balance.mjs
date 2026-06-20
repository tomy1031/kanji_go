// Re-tune the production data: give every monster that is USED AS A STAGE ENEMY
// real stats + non-zero EXP (only touching placeholders: 100/30 or 0-exp), and
// extend the EXP table so the player level can keep pace with enemy_level.
// Real, already-authored enemies (slimes/wolves/dragons/named bosses) are left
// untouched. Pure partner/meta monsters (never used as enemies) are untouched.
import fs from 'node:fs';
import path from 'node:path';

const dir = path.join(process.cwd(), 'src', 'data');
const read = (f) => fs.readFileSync(path.join(dir, f), 'utf8');

// --- parse stage_data to find enemy roles ---
const stageLines = read('stage_data.csv').trim().split('\n').filter(l => !l.startsWith('#'));
const enemyRole = {}; // id -> 'boss' | 'normal' (boss wins)
for (const line of stageLines.slice(1)) {
  const [, , , stage_type, enemy_id] = line.split(',');
  const id = enemy_id.trim();
  if (stage_type.trim() === 'boss') enemyRole[id] = 'boss';
  else if (!enemyRole[id]) enemyRole[id] = 'normal';
}

// --- tuning table by version + role ---
const TUNE = {
  N5: { normal: { hp: 80, atk: 18, exp: 150, gold: 8 }, boss: { hp: 280, atk: 40, exp: 1000, gold: 50 } },
  N4: { normal: { hp: 170, atk: 36, exp: 550, gold: 28 }, boss: { hp: 460, atk: 58, exp: 2200, gold: 110 } },
  N3: { normal: { hp: 430, atk: 72, exp: 1200, gold: 60 }, boss: { hp: 850, atk: 96, exp: 3800, gold: 190 } },
};
// small deterministic jitter so same-tier enemies aren't identical
const jitter = (id, span) => {
  let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return (h % (2 * span + 1)) - span;
};

// --- rewrite monster_data.csv ---
const monLines = read('monster_data.csv').trim().split('\n');
const header = monLines[0].split(',');
const col = Object.fromEntries(header.map((h, i) => [h, i]));
let tuned = 0;
const out = [monLines[0]];
for (const line of monLines.slice(1)) {
  const f = line.split(',');
  const id = f[col.id];
  const role = enemyRole[id];
  const isPlaceholder = +f[col.hp] === 100 && +f[col.attack] === 30;
  const zeroExp = (+f[col.expReward] || 0) === 0;
  // Only retune monsters that are actually used as enemies AND look untuned.
  if (role && (isPlaceholder || zeroExp)) {
    const ver = ['N5', 'N4', 'N3'].includes(f[col.version]) ? f[col.version] : 'N5';
    const t = TUNE[ver][role];
    f[col.hp] = String(Math.max(40, t.hp + jitter(id, role === 'boss' ? 30 : 12)));
    f[col.attack] = String(Math.max(8, t.atk + jitter(id + 'a', role === 'boss' ? 6 : 4)));
    f[col.expReward] = String(t.exp + jitter(id + 'e', role === 'boss' ? 50 : 20));
    f[col.goldReward] = String(t.gold);
    tuned++;
  }
  out.push(f.join(','));
}
fs.writeFileSync(path.join(dir, 'monster_data.csv'), out.join('\n') + '\n');
console.log(`monster_data.csv: retuned ${tuned} enemy rows.`);

// --- extend exp_table.csv to level 55 (formula total = 50*L*(L-1), matches existing) ---
const expOut = ['level,total_exp'];
for (let L = 1; L <= 55; L++) expOut.push(`${L},${50 * L * (L - 1)}`);
fs.writeFileSync(path.join(dir, 'exp_table.csv'), expOut.join('\n') + '\n');
console.log('exp_table.csv: extended to level 55 (total = 50*L*(L-1)).');
