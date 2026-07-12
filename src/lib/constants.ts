// Central gameplay tuning constants.

// Number of correct writes required to "master" a kanji in Practice Mode
// (also used for chapter-completion / meta-monster unlock checks).
// Single source of truth so the writing-practice count stays consistent.
export const PRACTICE_MASTERY_COUNT = 10;

// --- Battle feel / rewards tuning ---
// PERFECT (a kanji written with zero mistakes) multiplies the hit's damage.
// Skill → payoff is the core dopamine link, so it is deliberately strong but
// not so strong that sloppy play can't clear stages (audited separately).
export const PERFECT_DAMAGE_MULT = 1.5;
// Player HP ratio at/below which the "clutch" danger state kicks in
export const LOW_HP_RATIO = 0.25;
// Winning at/below this HP ratio counts as a clutch win
export const CLUTCH_HP_RATIO = 0.12;

// --- Victory drop (variable reward) ---
export const SHINY_RATE = 0.02;   // shiny (色違い) version of the defeated monster
export const RARE_RATE = 0.18;    // rare capsule: bonus EXP
export const RARE_EXP_MULT = 1.5; // rare capsule EXP multiplier
// CSS filter that renders a monster sprite as its shiny variant
export const SHINY_FILTER = 'hue-rotate(140deg) saturate(1.6) brightness(1.05)';

// --- Bonus round (risk choice after victory) ---
export const BONUS_ROUND_EXP_MULT = 2;    // reward multiplier per bonus round
export const BONUS_ROUND_LEVEL_STEP = 4;  // enemy level increase per round
export const BONUS_ROUND_MAX = 3;         // longest chain

// --- Daily streak ---
export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100];
export const STREAK_MILESTONE_EXP = 200;  // EXP granted per milestone reached

// --- Score attack ---
export const SCORE_ATTACK_SECONDS = 60;
