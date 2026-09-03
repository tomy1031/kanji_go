import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useAnimationControls } from "framer-motion";
import KanjiWriterCanvas from "../../components/KanjiWriterCanvas";
import { useUserStore } from "../../store/userStore";
import { useSound } from "../../hooks/useSound";
import { MONSTER_DB, getMonsterStats, isResistant } from "../../lib/evolutionUtils";
import { ENEMY_DB, getEnemyForStage, isBossStage, getEnemyLevelForStage } from "../../lib/enemyUtils";
import { getKanjiForStage } from "../../lib/kanjiUtils";
import { preloadCharData } from "../../lib/kanjiStrokeLoader";
import { calculateNextReview } from "../../lib/srsAlgorithm";
import { KanjiInfoDisplay } from '../../components/KanjiInfoDisplay';
import { KanjiListModal } from '../../components/KanjiListModal';
import { type KanjiData } from "../../types";
import { getAssetPath } from "../../utils/assetUtils";
import { useCanvasSize } from "../../hooks/useCanvasSize";
import {
  PERFECT_DAMAGE_MULT,
  LOW_HP_RATIO,
  CLUTCH_HP_RATIO,
  SHINY_RATE,
  RARE_RATE,
  RARE_EXP_MULT,
  SHINY_FILTER,
  BONUS_ROUND_EXP_MULT,
  BONUS_ROUND_LEVEL_STEP,
  BONUS_ROUND_MAX,
  STREAK_MILESTONE_EXP,
} from "../../lib/constants";


interface BattleSceneProps {
  world: number;
  order: number;
  onComplete?: () => void;
}

const BattleScene: React.FC<BattleSceneProps> = ({ world, order, onComplete }) => {
  const {
    stats,
    partners,
    evolvePartner,
    addExp,
    progress,
    updateProgress,
    unlockSkin,
    updateStageRating,
    unlockNextStage,
    setPartner,
    profile,
    addShinySkin,
    recordClutchWin,
    recordDailyActivity,
  } = useUserStore();
  const { playBgm, stopBgm, playSfx, playStroke } = useSound();

  // Game State
  const [playerHp, setPlayerHp] = useState(100);
  const [enemyHp, setEnemyHp] = useState(100);
  const [currentEnemy, setCurrentEnemy] = useState(ENEMY_DB[0]);

  // Battle message banner (restored — it was being discarded, leaving the
  // child with no verbal feedback about what just happened)
  const [battleMessage, setBattleMessage] = useState("バトルスタート！");
  const [evolutionMessage, setEvolutionMessage] = useState<string | null>(null);
  const [levelUpMessage, setLevelUpMessage] = useState<boolean>(false);
  const [currentKanji, setCurrentKanji] = useState<KanjiData | null>(null);
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEnemyHit, setIsEnemyHit] = useState(false);
  const [isPlayerHit, setIsPlayerHit] = useState(false);
  const [battleState, setBattleState] = useState<
    "start" | "battle" | "win" | "lose" | "complete"
  >("start");

  // Slash effect for attack animation
  const [slashEffect, setSlashEffect] = useState<{
    id: number;
    x: number;
    y: number;
  } | null>(null);
  const [damageNumber, setDamageNumber] = useState<{
    value: number;
    id: number;
    isCritical?: boolean;
    isWeak?: boolean;
  } | null>(null);
  // Damage the PLAYER just took (rendered over the player frame)
  const [playerDamageNumber, setPlayerDamageNumber] = useState<{
    value: number;
    id: number;
    isWeak: boolean;
  } | null>(null);
  // Mercy window: rapid consecutive mis-strokes only hurt once
  const lastDamageMistakeRef = useRef(0);
  const canvasHandleRef = useRef<import('../../components/KanjiWriterCanvas').KanjiWriterHandle>(null);
  const [criticalEffect, setCriticalEffect] = useState<boolean>(false);

  // Stage State
  const [stageKanjiList, setStageKanjiList] = useState<KanjiData[]>([]);
  const [completedKanjiIds, setCompletedKanjiIds] = useState<string[]>([]);
  const [isBoss, setIsBoss] = useState(false);
  const [combo, setCombo] = useState(0);

  // Modal State
  const [showVictoryModal, setShowVictoryModal] = useState(false);
  const [showDefeatModal, setShowDefeatModal] = useState(false);
  const [expGained, setExpGained] = useState(0);
  const [isNewSkin, setIsNewSkin] = useState(false);
  // Width- and height-aware so the canvas never pushes the HUD off small
  // phones; the extra width margin reserves room for the hint button column.
  const canvasSize = useCanvasSize(280, 0.36, 104);

  // --- Dopamine systems state ---
  const [perfectFlash, setPerfectFlash] = useState(false);
  const [bonusRound, setBonusRound] = useState(0); // risk-choice chain after victory
  const [isClutchWin, setIsClutchWin] = useState(false);
  const [drop, setDrop] = useState<'shiny' | 'rare' | 'none' | null>(null); // victory capsule
  const [dropRevealed, setDropRevealed] = useState(false);
  const [streakToast, setStreakToast] = useState<number | null>(null);
  const arenaShake = useAnimationControls();
  const isPartnerShiny = (partners.shinySkins || []).includes(partners.currentMonsterId);

  // Derived Stats
  const currentPartner = MONSTER_DB[partners.currentMonsterId] || {
    id: 'starter_fire',
    name: 'Unknown',
    imagePath: getAssetPath('/monsters/starter_fire.png'),
    element: 'FIRE',
    weakness: 'WATER'
  }; // Fallback
  const playerStats = getMonsterStats(
    partners.currentMonsterId,
    stats.playerLevel
  );
  const maxPlayerHp = playerStats.hp;
  const playerAttack = playerStats.attack;

  // Enemy Stats (Scaled to stage-defined enemy level; bonus rounds raise it)
  const stageEnemyLevel = getEnemyLevelForStage(world, order, profile.currentVersion);
  const effectiveEnemyLevel = stageEnemyLevel + bonusRound * BONUS_ROUND_LEVEL_STEP;
  const enemyStats = getMonsterStats(currentEnemy.id, effectiveEnemyLevel);
  const maxEnemyHp = enemyStats.hp;

  // Convert world/order to unique stage identifier for storage
  // const stageKey = `${world}-${order}`; // Unused for now

  // Refs for tracking previous values and unique IDs
  const prevLevelRef = useRef(stats.playerLevel);
  const effectIdCounter = useRef(0);
  const bossBgmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 【修正1】Stateの即時参照用にRefを追加
  const completedKanjiIdsRef = useRef<string[]>([]);

  // 【修正2】Stateが更新されたらRefも更新するuseEffectを追加
  useEffect(() => {
    completedKanjiIdsRef.current = completedKanjiIds;
  }, [completedKanjiIds]);

  const getUniqueId = () => {
    effectIdCounter.current += 1;
    return Date.now() + effectIdCounter.current;
  };

  // Initialize enemy on mount
  useEffect(() => {
    // Only initialize if not already initialized
    if (battleState !== "start") return;

    // Check if this is a boss stage (determined by stage_type in CSV)
    const bossCheck = isBossStage(world, order, profile.currentVersion);
    setIsBoss(bossCheck);

    // Play boss siren SFX first for boss stages, then BGM
    if (bossCheck) {
      // Stop any playing music first
      stopBgm();
      playSfx("boss_siren");
      // Delay boss BGM to let siren play first (cleared on unmount so boss
      // music can't start over the world map after fleeing)
      bossBgmTimerRef.current = setTimeout(() => {
        playBgm("boss");
      }, 1500);
    } else {
      playBgm("battle");
    }

    console.log("BattleScene: Initializing battle");
    console.log("BattleScene: Current Partner:", currentPartner);
    console.log(
      "BattleScene: Player Image Path:",
      `/monsters/${currentPartner.id}.png`
    );

    if (battleState === "start") {
      setPlayerHp(maxPlayerHp);
    }



    const enemyData = getEnemyForStage(world, order, profile.currentVersion);

    // Fallback: if no enemy found for this stage, use first enemy
    const enemy = enemyData || ENEMY_DB[0];

    if (!enemyData) {
      console.warn(`No enemy found for world ${world} order ${order} in ${profile.currentVersion}, using fallback`);
    }

    setCurrentEnemy(enemy);

    // Initialize enemy HP from the stage-defined enemy level (must match
    // maxEnemyHp, which also uses stageEnemyLevel) so the HP bar starts full.
    const stageLevelForInit = getEnemyLevelForStage(world, order, profile.currentVersion);
    const initialEnemyStats = getMonsterStats(enemy.id, stageLevelForInit);
    setEnemyHp(initialEnemyStats.hp);

    const kanjis = getKanjiForStage(world, order, profile.currentVersion);
    setStageKanjiList(kanjis);
    // Preload all stroke data for this stage so the writing canvas is instant.
    preloadCharData(kanjis.map((k) => k.char));

    setBattleState("battle");

    return () => {
      if (bossBgmTimerRef.current) clearTimeout(bossBgmTimerRef.current);
    };
  }, [world, order, profile.currentVersion, battleState, maxPlayerHp, currentPartner, stats.playerLevel, playBgm, stopBgm, playSfx]);

  // Check for evolution
  useEffect(() => {
    const checkEvo = async () => {
      const { checkEvolution, MONSTER_DB } = await import(
        "../../lib/evolutionUtils"
      );
      // Pass 0 for masteryCount for now as it's not easily available here
      const canEvolve = checkEvolution(
        partners.currentMonsterId,
        stats.playerLevel,
        0
      );

      if (canEvolve) {
        const currentMonster = MONSTER_DB[partners.currentMonsterId];
        const nextFormId = currentMonster?.nextFormId;

        if (nextFormId) {
          evolvePartner(nextFormId);
          playSfx("evolve");
          setEvolutionMessage(
            `${MONSTER_DB[nextFormId].name}に しんかした！！`
          );
          setTimeout(() => setEvolutionMessage(null), 3000);
        }
      }
    };
    checkEvo();
  }, [stats.playerLevel, partners.currentMonsterId, evolvePartner, playSfx]);

  // Check for Level Up
  useEffect(() => {
    if (stats.playerLevel > prevLevelRef.current) {
      playSfx("win");
      setLevelUpMessage(true);
      setTimeout(() => setLevelUpMessage(false), 3000);
    }
    prevLevelRef.current = stats.playerLevel;
  }, [stats.playerLevel, playSfx]);

  // Kanji selection logic
  const pickNextKanji = React.useCallback(() => {
    if (stageKanjiList.length === 0) return;

    // 【修正3】Refから最新の完了リストを取得
    const completed = completedKanjiIdsRef.current;

    // 【修正4】完了していない、かつ「現在表示中ではない」漢字を候補にする
    // (これにより、同じ漢字が連続して選ばれてCanvasがリセットされない事故を防ぐ)
    let candidates = stageKanjiList.filter(
      (k) => !completed.includes(k.id) && k.id !== currentKanji?.id
    );

    // If all completed, recycle from the full list (allow duplicates)
    if (candidates.length === 0) {
      // 全て完了している場合でも、直前の漢字以外から選ぶようにする
      candidates = stageKanjiList.filter((k) => k.id !== currentKanji?.id);

      // それでも候補がない（ステージに漢字が1つしかない）場合は、
      // 強制的にその1つを選ぶしかないが、keyを変える工夫が必要。
      // ここでは単純にリスト全体に戻す
      if (candidates.length === 0) {
        candidates = stageKanjiList;
      }
    }

    // Safety check
    if (candidates.length === 0) return;

    let totalWeight = 0;
    const weightedItems = candidates.map((k) => {
      const p = progress[k.id];
      const streak = p ? p.streak : 0;
      const weight = 10 / (streak + 1);
      totalWeight += weight;
      return { kanji: k, weight };
    });

    let random = Math.random() * totalWeight;
    let selectedKanji = weightedItems[0].kanji;

    for (const item of weightedItems) {
      random -= item.weight;
      if (random <= 0) {
        selectedKanji = item.kanji;
        break;
      }
    }

    setCurrentKanji(selectedKanji);

    // 【修正5】依存配列から completedKanjiIds を削除し、currentKanjiを追加
  }, [stageKanjiList, progress, currentKanji]);
  // Initial Kanji Pick & Recovery
  useEffect(() => {
    // If we have kanji but none selected, pick one
    if (stageKanjiList.length > 0 && !currentKanji) {
      pickNextKanji();
    }
  }, [stageKanjiList, currentKanji, pickNextKanji]);

  const enemyAttack = () => {
    // Use scaled attack
    let damage = enemyStats.attack;
    let isWeak = false;

    // Check Weakness (Enemy Element vs Player Weakness)
    if (currentPartner?.weakness === currentEnemy.element) {
      damage *= 2;
      isWeak = true;
    }
    // Check Resistance (Enemy Element vs Player Resistance)
    else if (isResistant(currentEnemy.element, currentPartner?.element)) {
      damage = Math.floor(damage * 0.5);
    }

    const newPlayerHp = Math.max(0, playerHp - damage);
    setPlayerHp(newPlayerHp);
    setIsPlayerHit(true);
    playSfx("hit");
    setTimeout(() => setIsPlayerHit(false), 500);

    // Show WHY and HOW MUCH on the player's side — damage with no number or
    // cause reads as random punishment to a child
    setPlayerDamageNumber({ value: damage, id: getUniqueId(), isWeak });
    setTimeout(() => setPlayerDamageNumber(null), 1000);
    setBattleMessage(
      isWeak
        ? `${currentEnemy.name}の こうげき！ こうかは ばつぐん… -${damage}`
        : `${currentEnemy.name}の こうげき！ -${damage}`
    );

    if (newPlayerHp === 0) {
      setBattleMessage("まけてしまった…");
      stopBgm();
      playSfx("mistake");
      setBattleState("lose");
      setShowDefeatModal(true);
    }
  };

  const handleCorrectStroke = () => {
    // Increment combo on each successful stroke
    setCombo(prev => prev + 1);
    // Rising-pitch blip — the combo audibly "charges up"
    playStroke(combo + 1);

    // Katana Slash Effect
    setSlashEffect({
      id: getUniqueId(),
      x: Math.random() * 100 - 50,
      y: Math.random() * 100 - 50,
    });
    setTimeout(() => setSlashEffect(null), 200);
  };

  const handleWriteSuccess = (summary?: { character: string; totalMistakes: number }) => {
    if (!currentKanji || battleState !== "battle") return;

    // PERFECT: the whole kanji written without a single mistake.
    // Skill maps directly to payoff — this is the core dopamine link.
    const isPerfect = (summary?.totalMistakes ?? 1) === 0;

    // Player Attacks - base damage + combo bonus (1 per combo stroke)
    let damage = playerAttack + combo;
    let isCritical = false;

    // Check Weakness (Player Element vs Enemy Weakness)
    if (currentEnemy?.weakness === currentPartner?.element) {
      damage *= 2;
      setBattleMessage(`こうかは ばつぐんだ！ ${damage}ダメージ！`);
      setCriticalEffect(true);
      setTimeout(() => setCriticalEffect(false), 500);
      isCritical = true;
    }
    // Check Resistance (Player Element vs Enemy Resistance)
    else if (isResistant(currentPartner?.element, currentEnemy?.element)) {
      damage = Math.floor(damage * 0.5);
      setBattleMessage(`いまいちだ… ${damage}ダメージ`);
    } else {
      setBattleMessage(`ヒット！ ${damage}ダメージ！`);
    }

    if (isPerfect) {
      damage = Math.floor(damage * PERFECT_DAMAGE_MULT);
      isCritical = true;
      setPerfectFlash(true);
      setTimeout(() => setPerfectFlash(false), 900);
      setBattleMessage(`パーフェクト！！ ${damage}ダメージ！`);
    }

    // Impact shake — the finishing stroke should physically land
    arenaShake.start({
      x: isPerfect ? [0, -12, 12, -8, 8, -4, 0] : [0, -6, 6, -4, 0],
      transition: { duration: isPerfect ? 0.5 : 0.3 },
    });

    playSfx(isCritical ? "critical" : "hit");
    const newEnemyHp = Math.max(0, enemyHp - damage);
    setEnemyHp(newEnemyHp);
    setIsEnemyHit(true);
    setTimeout(() => setIsEnemyHit(false), 500);

    // Show floating damage
    setDamageNumber({
      value: damage,
      id: getUniqueId(),
      isCritical: isCritical,
      isWeak: damage < playerAttack // Simple check for weak hit
    });
    setTimeout(() => setDamageNumber(null), 1000);

    // Update SRS (Success)
    const currentProgress = progress[currentKanji.id];
    const previousInterval = currentProgress?.interval || 0;
    const previousStreak = currentProgress?.streak || 0;
    const { interval, nextReview, streak } = calculateNextReview(
      5,
      previousInterval,
      previousStreak
    );
    updateProgress(currentKanji.id, { interval, nextReview, streak });

    // addExp(10); // Removed per-stroke EXP

    // Mark as completed for this session
    setCompletedKanjiIds((prev) => [...prev, currentKanji.id]);

    if (newEnemyHp === 0) {
      handleVictory();
    } else {
      // Next Kanji immediately
      setTimeout(() => {
        pickNextKanji();
      }, 400);
    }
  };

  const [mistakeCount, setMistakeCount] = useState(0);

  const handleWriteFail = () => {
    if (!currentKanji || battleState !== "battle") return;
    playSfx("mistake");
    setCombo(0); // Reset combo on mistake
    setMistakeCount(prev => prev + 1); // Track mistakes

    // Mercy window: a child scribbling repeatedly used to eat one enemy
    // attack PER mis-stroke (5 quick misses could end the battle). Within
    // the window we still reset the combo and count the mistake, but the
    // enemy only attacks once.
    const now = Date.now();
    if (now - lastDamageMistakeRef.current < 1500) {
      setBattleMessage("ミス！ おちついて かこう");
      return;
    }
    lastDamageMistakeRef.current = now;
    setBattleMessage("ミス！ てきの こうげき！");

    // Enemy Attacks on Miss
    enemyAttack();

    // Update SRS (Fail)
    const currentProgress = progress[currentKanji.id];
    const previousInterval = currentProgress?.interval || 0;
    const previousStreak = currentProgress?.streak || 0;
    const { interval, nextReview, streak } = calculateNextReview(
      1,
      previousInterval,
      previousStreak
    );
    updateProgress(currentKanji.id, { interval, nextReview, streak });
  };

  const handleVictory = () => {
    playSfx("win");
    setBattleMessage(`${currentEnemy.name}を たおした！`);
    setBattleState("win");

    // Clutch win: barely survived — memorable moments deserve a badge
    const clutch = playerHp > 0 && playerHp <= Math.ceil(maxPlayerHp * CLUTCH_HP_RATIO);
    setIsClutchWin(clutch);
    if (clutch) recordClutchWin();

    // Victory capsule (variable reward): shiny > rare > none
    const roll = Math.random();
    const dropType: 'shiny' | 'rare' | 'none' =
      roll < SHINY_RATE ? 'shiny' : roll < SHINY_RATE + RARE_RATE ? 'rare' : 'none';
    setDrop(dropType);
    setDropRevealed(false);
    setTimeout(() => setDropRevealed(true), 900); // capsule "opens" after a beat
    if (dropType === 'shiny') {
      addShinySkin(currentEnemy.id);
    }

    // EXP: base × rare-capsule bonus × bonus-round multiplier
    const baseExp = currentEnemy?.expReward || 10;
    const exp = Math.floor(
      baseExp *
      (dropType === 'rare' ? RARE_EXP_MULT : 1) *
      Math.pow(BONUS_ROUND_EXP_MULT, bonusRound)
    );
    setExpGained(exp);
    addExp(exp);

    // Daily streak (counts once per day; milestones grant EXP + a freeze)
    const { milestone } = recordDailyActivity();
    if (milestone) {
      setStreakToast(milestone);
      setTimeout(() => setStreakToast(null), 3500);
    }

    // Calculate Stars
    let stars = 1;
    if (mistakeCount === 0) stars = 3;
    else if (mistakeCount < 3) stars = 2;

    updateStageRating(profile.currentVersion, world, order, stars);

    if (!partners.unlockedSkins.includes(currentEnemy.id)) {
      unlockSkin(currentEnemy.id);
      setIsNewSkin(true);
    } else {
      setIsNewSkin(false);
    }

    unlockNextStage();

    // If BOSS stage completed, clear selectedChapter to return to chapter selection
    if (order === 4) { // BOSS stage
      useUserStore.getState().setSelectedChapter(null);
    }

    setShowVictoryModal(true);
  };

  // Risk choice: keep your current HP and fight the same enemy at a higher
  // level for multiplied EXP. Lose and you keep only what you already earned.
  const handleBonusRound = () => {
    const nextRound = bonusRound + 1;
    setBonusRound(nextRound);
    const s = getMonsterStats(currentEnemy.id, stageEnemyLevel + nextRound * BONUS_ROUND_LEVEL_STEP);
    setEnemyHp(s.hp);
    setShowVictoryModal(false);
    setDrop(null);
    setIsClutchWin(false);
    setCompletedKanjiIds([]);
    setBattleState("battle");
    setBattleMessage("ボーナスバトル！ きをつけて！");
    playSfx("boss_siren");
  };

  // Instant retry after defeat — no re-navigating chapter → stage.
  // Resetting battleState to "start" re-runs the init effect from scratch.
  const handleRetry = () => {
    setShowDefeatModal(false);
    setBonusRound(0);
    setCombo(0);
    setMistakeCount(0);
    setCompletedKanjiIds([]);
    setCurrentKanji(null);
    setDrop(null);
    setIsClutchWin(false);
    setBattleMessage("バトルスタート！");
    setBattleState("start");
  };

  const handleReturnToMap = () => {
    if (onComplete) {
      onComplete();
    } else {
      window.location.reload();
    }
  };

  const handleEquipNewSkin = () => {
    setPartner(currentEnemy.id);
    handleReturnToMap();
  };

  if (!currentKanji) {
    return (
      <div className="w-full h-dvh bg-gray-900 text-white flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-4 border-gray-700 border-t-cyan-400 rounded-full animate-spin" />
        <div className="text-sm text-gray-400 font-bold">バトルの じゅんびちゅう…</div>
      </div>
    );
  }



  return (
    <div className="w-full h-[100dvh] text-white flex flex-col relative overflow-hidden">
      {/* Battle Arena - Top Section - Uses flex-1 to take remaining space */}
      <motion.div animate={arenaShake} className="relative flex-1 flex items-center justify-center min-h-0">
        {/* Diagonal Split Background */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Red side (Enemy) */}
          <div
            className="absolute inset-0 bg-gradient-to-br from-red-900 via-red-800 to-red-950"
            style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }}
          />
          {/* Blue side (Player) */}
          <div
            className="absolute inset-0 bg-gradient-to-tl from-blue-900 via-blue-800 to-blue-950"
            style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }}
          />
          {/* Radial light rays from center */}
          <div
            className="absolute inset-0 opacity-30"
            style={{
              background: 'repeating-conic-gradient(from 0deg, transparent 0deg 10deg, rgba(255,255,255,0.05) 10deg 20deg)',
              transformOrigin: 'center center',
            }}
          />
        </div>

        {/* Boss Warning Banner */}
        {isBoss && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="absolute top-0 left-0 right-0 z-30"
          >
            <div className="relative">
              {/* Hazard stripes top */}
              <div
                className="h-2 w-full"
                style={{
                  background: 'repeating-linear-gradient(45deg, #1a1a1a, #1a1a1a 10px, #fbbf24 10px, #fbbf24 20px)',
                }}
              />
              {/* Main banner */}
              <div className="bg-gradient-to-r from-red-900 via-red-700 to-red-900 py-1 px-4 text-center border-y-2 border-yellow-500">
                <span
                  className="text-yellow-400 font-black text-sm md:text-lg tracking-widest animate-pulse"
                  style={{ textShadow: '0 0 10px rgba(251, 191, 36, 0.8)' }}
                >
                  ⚠️ WARNING! BOSS BATTLE ⚠️
                </span>
              </div>
              {/* Hazard stripes bottom */}
              <div
                className="h-2 w-full"
                style={{
                  background: 'repeating-linear-gradient(-45deg, #1a1a1a, #1a1a1a 10px, #fbbf24 10px, #fbbf24 20px)',
                }}
              />
            </div>
          </motion.div>
        )}

        {/* Center Glow Effect */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(255,150,50,0.2) 0%, rgba(255,100,0,0.05) 35%, transparent 55%)',
          }}
        />
        {/* Center Sparks */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <motion.div
            className="w-1 h-1 bg-white rounded-full absolute"
            style={{ boxShadow: '0 0 10px #fff, 0 0 20px #ff0, 0 0 30px #f80' }}
            animate={{ opacity: [0, 1, 0], scale: [0.5, 1.5, 0.5] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="w-1 h-1 bg-white rounded-full absolute left-4 top-2"
            style={{ boxShadow: '0 0 10px #fff, 0 0 20px #ff0, 0 0 30px #f80' }}
            animate={{ opacity: [0, 1, 0], scale: [0.5, 1.5, 0.5] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
          />
          <motion.div
            className="w-1 h-1 bg-white rounded-full absolute -left-2 top-4"
            style={{ boxShadow: '0 0 10px #fff, 0 0 20px #ff0, 0 0 30px #f80' }}
            animate={{ opacity: [0, 1, 0], scale: [0.5, 1.5, 0.5] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
          />
        </div>

        {/* Fighters Row - Horizontal Layout */}
        <div className="absolute inset-0 flex items-center justify-between px-4 z-10">
          {/* Combo Display - Top Center of Battle Area */}
          {combo > 0 && (
            <motion.div
              initial={{ scale: 0, y: -20 }}
              animate={{ scale: 1, y: 0 }}
              className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-orange-600 to-red-600 px-4 py-1 rounded-full border-2 border-yellow-400 z-20"
              style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.3), 0 0 15px rgba(255,100,0,0.5)' }}
            >
              <span className="text-white font-black text-sm md:text-base">🔥 {combo} COMBO</span>
            </motion.div>
          )}
          {/* Enemy Fighter */}
          <motion.div
            className="flex flex-col items-center w-[40%]"
            animate={{ x: isEnemyHit ? [-8, 8, -8, 8, 0] : 0 }}
            transition={{ duration: 0.3 }}
            style={{ filter: isEnemyHit ? 'brightness(2)' : 'none' }}
          >
            {/* Enemy Name */}
            <div className="text-red-400 text-[10px] md:text-sm font-black mb-1 flex items-center gap-1">
              <span>{
                currentEnemy.element === 'WATER' ? '💧' :
                  currentEnemy.element === 'NATURE' ? '🌿' :
                    currentEnemy.element === 'LIGHT' ? '✨' :
                      currentEnemy.element === 'DARK' ? '🌑' :
                        currentEnemy.element === 'BOSS' ? '👿' : '🔥'
              }</span>
              <span>{currentEnemy.name}</span>
              <span className="text-xs text-red-300 ml-1">Lv.{effectiveEnemyLevel}</span>
            </div>
            {/* Enemy Frame */}
            <div
              className="w-full aspect-square max-w-[100px] md:max-w-[120px] rounded-xl border-3 flex items-center justify-center relative overflow-hidden"
              style={{
                borderColor: '#ff4444',
                background: 'linear-gradient(180deg, rgba(100,0,0,0.9) 0%, rgba(50,0,0,0.95) 100%)',
                boxShadow: '0 0 20px rgba(255,0,0,0.4), inset 0 0 20px rgba(255,0,0,0.2)',
              }}
            >
              <img
                src={getAssetPath(currentEnemy.imagePath || '')}
                alt={currentEnemy.name}
                className="w-[75%] h-[75%] object-contain drop-shadow-lg"
                style={{ transform: 'scaleX(-1)', animation: 'fighterIdle 2s ease-in-out infinite' }}
              />
              {/* Damage Effects */}
              <AnimatePresence>
                {slashEffect && (
                  <motion.div
                    key={slashEffect.id}
                    initial={{ opacity: 1, scale: 0.5, rotate: -45 }}
                    animate={{ opacity: 0, scale: 1.5, rotate: 45 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 flex items-center justify-center pointer-events-none"
                  >
                    <div className="w-16 h-0.5 bg-white shadow-[0_0_20px_rgba(255,255,255,0.8)]" />
                  </motion.div>
                )}
                {damageNumber && (
                  <motion.div
                    key={damageNumber.id}
                    initial={{ opacity: 1, y: 0, scale: 0.5 }}
                    animate={{ opacity: 0, y: -30, scale: 1.2 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <span className="text-2xl md:text-3xl font-black text-yellow-400 drop-shadow-lg"
                      style={{ textShadow: '2px 2px 0 #cc0000, 0 0 15px #ff0000' }}
                    >
                      -{damageNumber.value}
                    </span>
                  </motion.div>
                )}
                {criticalEffect && (
                  <motion.div
                    initial={{ opacity: 0, scale: 2 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute top-0 left-1/2 transform -translate-x-1/2"
                  >
                    <span className="text-xs md:text-sm font-black text-yellow-400 drop-shadow-lg">クリティカル！</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            {/* Enemy Stats */}
            <div className="w-full max-w-[100px] md:max-w-[120px] mt-2">
              <div className="flex justify-between text-[8px] md:text-xs text-gray-300 mb-0.5">
                <span>HP</span>
                <span>{enemyHp}/{maxEnemyHp}</span>
              </div>
              <div className="h-2.5 bg-gray-800 rounded border border-gray-600 overflow-hidden shadow-inner">
                <motion.div
                  className={`h-full rounded ${(enemyHp / maxEnemyHp) > 0.5
                    ? 'bg-gradient-to-b from-green-400 to-green-600'
                    : (enemyHp / maxEnemyHp) > 0.25
                      ? 'bg-gradient-to-b from-yellow-400 to-orange-500'
                      : 'bg-gradient-to-b from-red-400 to-red-600'
                    }`}
                  style={{
                    boxShadow: (enemyHp / maxEnemyHp) <= 0.25 ? '0 0 8px #ff0000' : (enemyHp / maxEnemyHp) > 0.5 ? '0 0 8px #00ff00' : '0 0 8px #ffcc00',
                  }}
                  initial={{ width: '100%' }}
                  animate={{ width: `${(enemyHp / maxEnemyHp) * 100}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
              <div className="flex justify-between text-[8px] md:text-xs mt-1">
                <span className="text-gray-400">ATK</span>
                <span className="text-orange-400 font-bold">{enemyStats.attack}</span>
              </div>
            </div>
          </motion.div>

          {/* VS */}
          <div className="flex items-center justify-center">
            <motion.span
              className="text-2xl md:text-4xl font-black text-white"
              style={{
                fontFamily: "'Black Ops One', cursive",
                textShadow: '0 0 20px #ff6600, 0 0 40px #ff3300, 3px 3px 0 #993300',
              }}
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            >
              VS
            </motion.span>
          </div>

          {/* Player Fighter */}
          <motion.div
            className="flex flex-col items-center w-[40%]"
            animate={{ x: isPlayerHit ? [-8, 8, -8, 8, 0] : 0 }}
            transition={{ duration: 0.3 }}
            style={{ filter: isPlayerHit ? 'brightness(2)' : 'none' }}
          >
            {/* Player Name */}
            <div className="text-cyan-400 text-[10px] md:text-sm font-black mb-1 flex items-center gap-1">
              <span>✨</span>
              <span>{currentPartner.name}</span>
              <span className="text-xs text-cyan-300 ml-1">Lv.{stats.playerLevel}</span>
            </div>
            {/* Player Frame */}
            <div
              className="w-full aspect-square max-w-[100px] md:max-w-[120px] rounded-xl border-3 flex items-center justify-center relative overflow-hidden"
              style={{
                borderColor: '#4488ff',
                background: 'linear-gradient(180deg, rgba(0,30,100,0.9) 0%, rgba(0,15,60,0.95) 100%)',
                boxShadow: '0 0 20px rgba(0,100,255,0.4), inset 0 0 20px rgba(0,100,255,0.2)',
              }}
            >
              <img
                src={getAssetPath(`/monsters/${currentPartner.id}.png`)}
                alt={currentPartner.name}
                className="w-[75%] h-[75%] object-contain drop-shadow-lg"
                style={{
                  animation: 'fighterIdle 2s ease-in-out infinite',
                  filter: isPartnerShiny ? SHINY_FILTER : undefined,
                }}
              />
              {isPartnerShiny && (
                <span className="absolute top-0.5 right-1 text-[10px]" title="色ちがい">✨</span>
              )}
              {/* Level Up Effect */}
              <AnimatePresence>
                {levelUpMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: 0 }}
                    animate={{ opacity: 1, y: -20 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <span className="text-sm md:text-lg font-black text-yellow-400 drop-shadow-lg">レベルアップ！</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Damage taken by the player (number + reason) */}
              <AnimatePresence>
                {playerDamageNumber && (
                  <motion.div
                    key={playerDamageNumber.id}
                    initial={{ opacity: 1, y: 0, scale: 0.6 }}
                    animate={{ opacity: 0, y: 26, scale: 1.15 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-20"
                  >
                    <span
                      className="text-2xl md:text-3xl font-black text-red-400"
                      style={{ textShadow: '2px 2px 0 #7f1d1d, 0 0 12px #ef4444' }}
                    >
                      -{playerDamageNumber.value}
                    </span>
                    {playerDamageNumber.isWeak && (
                      <span className="text-[9px] md:text-[10px] font-black text-orange-300 bg-black/60 px-1.5 rounded-full mt-0.5">
                        ばつぐん…！
                      </span>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            {/* Player Stats */}
            <div className="w-full max-w-[100px] md:max-w-[120px] mt-2">
              <div className="flex justify-between text-[8px] md:text-xs text-gray-300 mb-0.5">
                <span>HP</span>
                <span>{playerHp}/{maxPlayerHp}</span>
              </div>
              <div className="h-2.5 bg-gray-800 rounded border border-gray-600 overflow-hidden shadow-inner">
                <motion.div
                  className={`h-full rounded ${(playerHp / maxPlayerHp) > 0.5
                    ? 'bg-gradient-to-b from-green-400 to-green-600'
                    : (playerHp / maxPlayerHp) > 0.25
                      ? 'bg-gradient-to-b from-yellow-400 to-orange-500'
                      : 'bg-gradient-to-b from-red-400 to-red-600'
                    }`}
                  style={{
                    boxShadow: (playerHp / maxPlayerHp) <= 0.25 ? '0 0 8px #ff0000' : (playerHp / maxPlayerHp) > 0.5 ? '0 0 8px #00ff00' : '0 0 8px #ffcc00',
                  }}
                  initial={{ width: '100%' }}
                  animate={{ width: `${(playerHp / maxPlayerHp) * 100}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
              <div className="flex justify-between text-[8px] md:text-xs mt-1">
                <span className="text-gray-400">ATK</span>
                <span className="text-orange-400 font-bold">
                  {playerAttack}{combo > 0 ? <span className="text-yellow-400"> +{combo}</span> : ''}
                </span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Stage Progress - Center Top */}
        <div className={`absolute ${isBoss ? 'top-14' : 'top-2'} left-1/2 transform -translate-x-1/2 z-10`}>
          <div className="flex gap-0.5 items-center bg-black/40 rounded-full px-2 py-0.5">
            {stageKanjiList.map((k, i) => (
              <div
                key={k.id}
                className={`w-1.5 h-1.5 md:w-2.5 md:h-2.5 rounded-full transition-colors ${completedKanjiIds.includes(k.id)
                  ? "bg-green-500"
                  : i === completedKanjiIds.length
                    ? "bg-yellow-400 animate-pulse"
                    : "bg-gray-600"
                  }`}
              />
            ))}
          </div>
        </div>

        {/* Bonus round badge */}
        {bonusRound > 0 && (
          <div className="absolute top-2 left-2 z-20 bg-gradient-to-r from-amber-500 to-orange-600 text-black font-black text-[10px] md:text-xs px-2.5 py-1 rounded-full border border-yellow-300 shadow-lg">
            ⚡ ボーナス x{Math.pow(BONUS_ROUND_EXP_MULT, bonusRound)}
          </div>
        )}

        {/* Low-HP danger vignette (clutch tension) */}
        {battleState === "battle" && playerHp > 0 && playerHp <= maxPlayerHp * LOW_HP_RATIO && (
          <div
            className="absolute inset-0 pointer-events-none z-20 animate-pulse"
            style={{ background: 'radial-gradient(ellipse at center, transparent 50%, rgba(220,38,38,0.4) 100%)' }}
          />
        )}

        {/* Battle message banner — the game's voice, in Japanese */}
        {battleMessage && battleState === "battle" && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 max-w-[94%]">
            <motion.div
              key={battleMessage}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-black/60 backdrop-blur-sm text-white text-xs md:text-sm font-bold px-4 py-1.5 rounded-full border border-white/15 whitespace-nowrap overflow-hidden text-ellipsis text-center"
            >
              {battleMessage}
            </motion.div>
          </div>
        )}

        {/* PERFECT flash */}
        <AnimatePresence>
          {perfectFlash && (
            <motion.div
              initial={{ opacity: 0, scale: 2.2, rotate: -6 }}
              animate={{ opacity: 1, scale: 1, rotate: -6 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: 'spring', stiffness: 400, damping: 16 }}
              className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none"
            >
              <span
                className="text-4xl md:text-6xl font-black italic text-yellow-300"
                style={{ textShadow: '0 0 24px rgba(250,204,21,0.9), 4px 4px 0 #b45309' }}
              >
                PERFECT!!
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Paper Texture Divider */}
      <div
        className="relative h-3 w-full z-10 flex-shrink-0"
        style={{
          background: 'linear-gradient(180deg, transparent 0%, #d4c4a8 30%)',
        }}
      >
        <svg viewBox="0 0 100 10" preserveAspectRatio="none" className="absolute bottom-0 w-full h-full">
          <path
            d="M0,10 Q10,5 20,8 T40,6 T60,9 T80,5 T100,8 L100,10 Z"
            fill="#d4c4a8"
          />
        </svg>
      </div>

      {/* Kanji Writing Section - Paper Texture Background */}
      <div
        className="relative z-20 flex-shrink-0 flex flex-col"
        style={{
          background: 'linear-gradient(180deg, #d4c4a8 0%, #c4b498 50%, #b4a488 100%)',
        }}
      >
        {/* Small spacer - combo display moved to battle area */}
        <div className="h-2" />

        {/* Question / Hint Row */}
        {/* Question / Hint Row */}
        <KanjiInfoDisplay
          kanji={currentKanji}
          className="mb-2"
          onClick={() => setIsModalOpen(true)}
        />
        <KanjiListModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          kanjiList={stageKanjiList}
        />

        {/* Kanji Canvas - Fixed height container.
            The hint button lives OUTSIDE the canvas box: the box clips its
            overflow, which hid the button entirely on small phones (SE-sized). */}
        <div className="flex justify-center items-start gap-2 pb-3">
          <div
            className="relative rounded-xl overflow-hidden shrink-0"
            style={{
              width: canvasSize,
              height: canvasSize,
              background: 'linear-gradient(145deg, #2a2a3e 0%, #1a1a2e 50%, #0f0f1f 100%)',
              border: '4px solid #4a4a5e',
              boxShadow: '0 6px 25px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
            }}
          >
            {/* Rune border effect */}
            <div
              className="absolute inset-0 pointer-events-none rounded-xl"
              style={{
                border: '2px solid #8b7355',
                borderRadius: '12px',
                opacity: 0.5,
              }}
            />
            {battleState !== "win" && currentKanji && (
              <KanjiWriterCanvas
                ref={canvasHandleRef}
                char={currentKanji.char}
                size={canvasSize}
                onCorrectStroke={handleCorrectStroke}
                onComplete={handleWriteSuccess}
                onMistake={handleWriteFail}
                quizMode={true}
              />
            )}
            {battleState === "win" && (
              <div className="flex flex-col items-center justify-center w-full h-full bg-green-900/50 text-green-400">
                <span className="text-5xl">🏆</span>
              </div>
            )}
          </div>

          {/* Stroke-order hint: a struggling child always has a way forward.
              Costs the current combo so it stays a choice, not a freebie. */}
          {battleState === "battle" && currentKanji && (
            <button
              onClick={() => {
                canvasHandleRef.current?.animateStroke();
                setCombo(0);
                setBattleMessage("書きじゅんを おぼえよう！");
              }}
              className="shrink-0 flex flex-col items-center justify-center gap-0.5 w-14 min-h-[56px] bg-yellow-400 hover:bg-yellow-300 text-yellow-950 rounded-2xl border-2 border-yellow-600 shadow-lg active:scale-95 transition-transform"
            >
              <span className="text-xl leading-none">👀</span>
              <span className="text-[10px] font-black leading-none">ヒント</span>
            </button>
          )}
        </div>
      </div>

      {/* Streak milestone toast */}
      <AnimatePresence>
        {streakToast && (
          <motion.div
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-[60] bg-gradient-to-r from-orange-500 to-red-500 text-white font-black px-5 py-2 rounded-full border border-yellow-300 shadow-xl text-xs md:text-sm whitespace-nowrap"
          >
            🔥 {streakToast}日 れんぞく達成！ +{STREAK_MILESTONE_EXP}EXP ＆ ストリーク保護 +1
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <AnimatePresence>
        {/* Victory Modal */}
        {showVictoryModal && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 z-50 flex bg-black/80 backdrop-blur-sm overflow-y-auto py-6"
          >
            {/* my-auto keeps the card centered but lets tall content scroll on short screens */}
            <div className="bg-gray-900 border-2 border-yellow-500 p-6 md:p-8 rounded-2xl max-w-md w-[90%] text-center shadow-[0_0_50px_rgba(234,179,8,0.3)] relative overflow-hidden m-auto">
              {/* Animated Background Rays */}
              <div className="absolute inset-0 bg-[conic-gradient(from_0deg,transparent_0_deg,rgba(234,179,8,0.1)_20deg,transparent_40deg)] animate-[spin_4s_linear_infinite]" />

              <h2 className="text-4xl font-black text-yellow-400 mb-4 drop-shadow-md relative z-10">
                STAGE CLEAR!
              </h2>

              <div className="mb-6 relative z-10 flex flex-col items-center">
                <div className="flex gap-1 mb-2">
                  {[1, 2, 3].map(star => (
                    <span key={star} className={`text-3xl ${star <= (mistakeCount === 0 ? 3 : mistakeCount < 3 ? 2 : 1) ? 'text-yellow-400' : 'text-gray-600'}`}>★</span>
                  ))}
                </div>

                <div className="w-32 h-32 bg-black/50 rounded-full flex items-center justify-center mb-4 border-4 border-yellow-500 shadow-lg overflow-hidden">
                  <img
                    src={getAssetPath(currentEnemy.imagePath || '')}
                    alt={currentEnemy.name}
                    className="w-24 h-24 object-contain"
                  />
                </div>
                <p className="text-gray-300 text-lg mb-2">
                  <span className="text-white font-bold">{currentEnemy.name}</span>
                  を たおした！
                </p>

                {isNewSkin && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="bg-yellow-500 text-black font-bold px-4 py-1 rounded-full text-sm mb-2 animate-pulse"
                  >
                    あたらしい なかまを ゲット！
                  </motion.div>
                )}

                {isClutchWin && (
                  <motion.div
                    initial={{ scale: 0, rotate: -8 }}
                    animate={{ scale: 1, rotate: -3 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 12 }}
                    className="bg-gradient-to-r from-red-600 to-orange-500 text-white font-black px-4 py-1 rounded-full text-sm mb-2 border border-yellow-300 shadow-[0_0_16px_rgba(249,115,22,0.7)]"
                  >
                    ⚡ クラッチ勝利！（ギリギリで勝った！）
                  </motion.div>
                )}

                {/* Victory capsule — variable reward reveal */}
                {drop && (
                  <div className="mb-2 min-h-[64px] flex items-center justify-center">
                    {!dropRevealed ? (
                      <motion.div
                        animate={{ rotate: [0, -12, 12, -12, 12, 0], scale: [1, 1.1, 1] }}
                        transition={{ duration: 0.8, repeat: Infinity }}
                        className="text-5xl"
                      >
                        🎁
                      </motion.div>
                    ) : drop === 'shiny' ? (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 260, damping: 12 }}
                        className="flex flex-col items-center gap-1"
                      >
                        <div className="relative w-16 h-16 rounded-full bg-black/60 border-2 border-fuchsia-400 shadow-[0_0_24px_rgba(232,121,249,0.8)] flex items-center justify-center overflow-hidden">
                          <img
                            src={getAssetPath(currentEnemy.imagePath || '')}
                            alt="shiny"
                            className="w-12 h-12 object-contain"
                            style={{ filter: SHINY_FILTER }}
                          />
                        </div>
                        <span className="text-fuchsia-300 font-black text-sm animate-pulse">✨ 色ちがい GET!! ✨</span>
                      </motion.div>
                    ) : drop === 'rare' ? (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 260, damping: 14 }}
                        className="flex items-center gap-2 bg-cyan-500/20 border border-cyan-400 rounded-full px-4 py-1.5"
                      >
                        <span className="text-xl">💎</span>
                        <span className="text-cyan-300 font-black text-sm">レアカプセル！ EXP x{RARE_EXP_MULT}</span>
                      </motion.div>
                    ) : (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-gray-500 text-xs"
                      >
                        カプセルは からっぽ… （✨色ちがいは {Math.round(SHINY_RATE * 100)}% でドロップ！）
                      </motion.div>
                    )}
                  </div>
                )}
              </div>

              {/* Stats Comparison */}
              <div className="bg-gray-800 rounded-lg p-4 mb-4 relative z-10 text-left">
                <h3 className="text-gray-400 text-xs font-bold mb-2 uppercase tracking-wider">
                  たたかいの きろく
                </h3>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="text-gray-500"></div>
                  <div className="text-center font-bold text-cyan-400">あなた (Lv.{stats.playerLevel})</div>
                  <div className="text-center font-bold text-red-400">
                    あいて (Lv.{effectiveEnemyLevel})
                  </div>

                  <div className="text-gray-400 font-mono">HP</div>
                  <div className="text-center text-white">{maxPlayerHp}</div>
                  <div className="text-center text-white">{maxEnemyHp}</div>

                  <div className="text-gray-400 font-mono">ATK</div>
                  <div className="text-center text-white">{playerAttack}</div>
                  <div className="text-center text-white">
                    {enemyStats.attack}
                  </div>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg p-4 mb-6 relative z-10">
                <div className="flex justify-between text-sm text-gray-400 mb-1">
                  <span>EXP</span>
                  <span>+{expGained}</span>
                </div>
                <div className="w-full h-4 bg-gray-700 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    className="h-full bg-cyan-400"
                  />
                </div>
              </div>

              {/* Risk choice: fight a stronger version, HP carries over */}
              {bonusRound < BONUS_ROUND_MAX && playerHp > 0 && (
                <button
                  onClick={handleBonusRound}
                  className="w-full mb-2 relative z-10 bg-gradient-to-r from-amber-500 to-orange-600 hover:brightness-110 text-black font-black py-3 rounded-xl transition-all text-sm border border-yellow-300 shadow-[0_0_16px_rgba(245,158,11,0.5)] active:scale-[0.98]"
                >
                  ⚡ れんぞくバトル！（敵 Lv+{BONUS_ROUND_LEVEL_STEP}・EXP x{BONUS_ROUND_EXP_MULT} / HPそのまま）
                </button>
              )}

              <div className="flex gap-2 relative z-10">
                <button
                  onClick={handleReturnToMap}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-xl transition-colors text-sm"
                >
                  もどる
                </button>
                {isNewSkin && (
                  <button
                    onClick={handleEquipNewSkin}
                    className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-xl transition-colors text-sm"
                  >
                    つれていく
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Defeat Modal */}
        {showDefeatModal && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 z-50 flex bg-black/80 backdrop-blur-sm overflow-y-auto py-6"
          >
            <div className="bg-gray-900 border-2 border-red-600 p-6 md:p-8 rounded-2xl max-w-md w-[90%] text-center shadow-[0_0_50px_rgba(220,38,38,0.3)] m-auto">
              <h2 className="text-4xl md:text-5xl font-black text-red-600 mb-4 drop-shadow-md tracking-widest">
                まけてしまった…
              </h2>

              <div className="text-6xl mb-4">💀</div>

              <p className="text-gray-300 mb-6 text-sm">
                だいじょうぶ！ なんども かけば つよくなる！
              </p>

              <button
                onClick={handleRetry}
                className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:brightness-110 text-white font-black py-4 rounded-xl transition-all text-lg mb-3 border border-red-400/50 shadow-[0_0_16px_rgba(220,38,38,0.4)] active:scale-[0.98]"
              >
                🔥 もういちど！
              </button>
              <button
                onClick={handleReturnToMap}
                className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-xl transition-colors text-sm"
              >
                マップへ もどる
              </button>
            </div>
          </motion.div>
        )}

        {/* Evolution Message */}
        {evolutionMessage && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/80"
          >
            <div className="text-4xl font-bold text-yellow-400 animate-pulse text-center">
              {evolutionMessage}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BattleScene;
