# Game Balance Design

This document records the game-balance model for Kanji GO, the problems that
were fixed, and how to re-verify the balance with the simulator.

## Core design intent

> Practice a stage's kanji → defeat its enemy → obtain a monster whose element
> is strong against the **next** stage → battles get easier as you keep the
> right partner equipped.

To make this loop work and keep the difficulty curve smooth, three systems are
kept in sync:

| Tier | Stages | Enemy type | Player form (expected) |
|------|--------|-----------|------------------------|
| 1    | 1–3    | Slime      | Starter (Lv1–3)        |
| 2    | 4–6    | Wolf       | Evolved (Lv4–7)        |
| 3    | 7–9    | Boss       | Final (Lv8–10)         |
| –    | 10     | Dragon     | Final (Lv10)           |

Player evolutions happen at **Lv4** and **Lv8**, deliberately aligned to the
start of the Wolf and Boss tiers, so the enemy step-up is matched by a player
power step-up. This removes the "enemy suddenly spikes" and "I suddenly become
unstoppable" problems.

## Element / weakness chain

Element triangle (FIRE → NATURE → AQUA → FIRE):

- FIRE is strong vs NATURE, weak vs AQUA
- NATURE is strong vs AQUA, weak vs FIRE
- AQUA is strong vs FIRE, weak vs NATURE

Stage enemy elements cycle so each stage's reward monster is **strong against
the next stage's enemy**:

```
S1 FIRE → S2 NATURE → S3 AQUA → S4 FIRE → S5 NATURE → S6 AQUA
→ S7 FIRE → S8 NATURE → S9 AQUA → S10 FIRE (Dragon)
```

(Previously the order was FIRE → AQUA → NATURE, which made every reward
**weak** to the next stage — the exact opposite of the intent.)

## Stat model

Both the player monster and (formerly) the enemy used
`getMonsterStats(id, level) = base * (1 + (level-1) * 0.1)`. Because the enemy
was scaled to the player's level, leveling never changed the difficulty ratio,
and — critically — the enemy actually read its base stats from
`evolution_data.csv`, leaving the `hp`/`attack` columns in `enemy_data.csv`
**dead and contradictory**.

Now:

- **Enemies** use fixed per-stage stats from `enemy_data.csv` (single source of
  truth). The difficulty of each stage is authored directly.
- **Player monsters** keep the `base * (1 + (level-1)*0.1)` growth from
  `evolution_data.csv`. The same file also defines the player-side stats of
  capturable enemy "skins", tiered to match the player's current form
  (Slime ≈ Starter, Wolf ≈ Evolved, Boss ≈ Final) so swapping is a
  side-grade that you take **for the element advantage**, never a single
  dominant monster.

### Key data files

- `src/data/enemy_data.csv` — fixed enemy combat stats + EXP rewards
- `src/data/stage_enemies.csv` — stage → enemy mapping (element cycle)
- `src/data/evolution_data.csv` — player monster lines + capturable skins
- `src/data/exp_table.csv` — level curve (≈ +1 level per stage)

## Verification

A standalone simulator replicates the in-game formulas and runs full
playthroughs at several accuracy levels and strategies.

```bash
node scripts/balance_sim.mjs
```

It reports, per stage: player/enemy stats, the element matchup, hits-to-kill,
mistakes-to-die, expected mistakes at the given accuracy, and a **margin**
(mistakes-to-die ÷ expected-mistakes; > 1 means a likely win).

### Results after rebalance (margin, 85% accuracy)

- **Element chain:** all 9 transitions are now "STRONG (good)".
- **Smart play (swap each stage):** every stage is super-effective, margins
  4.5–28, and the optimal partner changes every stage — no single monster
  carries the run.
- **No-swap (keep starter):** fully clearable on the FIRE/AQUA starters;
  margins dip (but stay > 1) on the recurring unfavorable stages, nudging the
  player to use the capture-and-swap mechanic instead of hard-walling them.
- **Final boss (Dragon, FIRE):** requires the AQUA counter (Leviathan, the
  reward from Stage 9) for a comfortable clear, as a final boss should.

Re-run the simulator after any change to the data files to confirm the curve
stays smooth.
