# Game Balance Documentation

## Elemental System
The game uses a 5-element cyclic system + Light/Dark mutual weakness.

  ### Main Cycle
  **Fire (🔥) > Nature (🌿) > Water (💧) > Fire (🔥)**

  - **Weakness Multiplier**: 2.0x Damage
  - **Resistance Multiplier**: 0.5x Damage

  ### Special Elements
  - **Light (✨) <-> Dark (🌑)**: Mutually weak (2.0x damage to each other). No resistance interactions with main cycle.
- **Boss (👿)**: Neutral to everything unless specified.
- **None (⚪)**: Neutral.

## Stats Calculation
Stats are calculated based on Base Stats and Level.

### Formula
```
HP = BaseHP * (1 + (Level - 1) * 0.1)
Attack = BaseAttack * (1 + (Level - 1) * 0.1)
```
- **BaseHP**: Typically 50-150
- **BaseAttack**: Typically 10-40

## Damage Formula
```
Damage = AttackerAttack + ComboCount (flat bonus, resets on mistake)
If Weakness: Damage *= 2.0
If Resistance: Damage *= 0.5
If PERFECT (kanji written with zero mistakes): Damage *= PERFECT_DAMAGE_MULT (1.5)
```
PERFECT is deterministic (skill-based), replacing random crits in quest battles.

## Victory Drops (variable reward)
- Shiny (色違い) version of the defeated monster: `SHINY_RATE` (2%)
- Rare capsule (EXP × `RARE_EXP_MULT` = 1.5): `RARE_RATE` (18%)
- Otherwise: empty capsule

## Bonus Rounds (risk choice)
After a victory the player may immediately fight the same enemy at
`+BONUS_ROUND_LEVEL_STEP` (4) levels with HP carried over, multiplying the
next victory's EXP by `BONUS_ROUND_EXP_MULT` (2) per round, up to
`BONUS_ROUND_MAX` (3) rounds. Losing forfeits only the unearned bonus.

## Daily Streak
One activity per day (practice write or battle win) advances the streak.
Milestones (3/7/14/30/60/100) grant `STREAK_MILESTONE_EXP` (200) EXP and one
streak freeze (protects a single missed day).

All tuning constants live in `src/lib/constants.ts`.

## Experience Points (EXP)

### Battle Mode
- **EXP Reward**: Granted **ONLY** upon defeating an enemy.
- **Values**: Significantly increased to compensate for removal of per-stroke EXP (approx. 10x previous values).
  - N5 Enemies: ~100-300 EXP
  - N4 Enemies: ~400-800 EXP
  - N3 Enemies: ~900-1500 EXP
  - Bosses: ~1000-5000 EXP

### Practice Mode
EXP gain depends on `practiceExpMode` setting.

#### Mode: 'CHAR' (Per Character)
- **EXP**: 10 EXP per correct character writing.
- **Trigger**: Immediate upon successful writing.

#### Mode: 'COMPLETE' (Stage Completion)
- **EXP**: `10 * WorldNumber`
- **Trigger**: Upon finishing practice set order.

### Level Up Curve
Exponential curve requiring more EXP per level.
*(See `src/lib/levelUtils.ts` or `exp_table.csv` if implemented)*

## Meta Monsters
Unlockable partners that provide specific elemental advantages.
- **Unlock Condition**: Complete all Kanji practice in a stage set (Order 1, 2, 3) — `PRACTICE_MASTERY_COUNT` (10) correct writes each. See `src/lib/constants.ts`.
- **Rewards**: Specific counter-element monsters for the next Boss.

### N5 Meta Monsters
- **Stage N5-1 Completion**: Unlocks Water Meta (Counters Fire Boss)
- **Stage N5-2 Completion**: Unlocks Nature Meta (Counters Water Boss)
- ...
