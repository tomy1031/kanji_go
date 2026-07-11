import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  } = useUserStore();
  const { playBgm, stopBgm, playSfx } = useSound();

  // Game State
  const [playerHp, setPlayerHp] = useState(100);
  const [enemyHp, setEnemyHp] = useState(100);
  const [currentEnemy, setCurrentEnemy] = useState(ENEMY_DB[0]);

  // Battle message not used in new design
  const [, setBattleMessage] = useState("Battle Start!");
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
  // Width- and height-aware so the canvas never pushes the HUD off small phones
  const canvasSize = useCanvasSize(280, 0.36);

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

  // Enemy Stats (Scaled to stage-defined enemy level)
  const stageEnemyLevel = getEnemyLevelForStage(world, order, profile.currentVersion);
  const enemyStats = getMonsterStats(currentEnemy.id, stageEnemyLevel);
  const maxEnemyHp = enemyStats.hp;

  // Convert world/order to unique stage identifier for storage
  // const stageKey = `${world}-${order}`; // Unused for now

  // Refs for tracking previous values and unique IDs
  const prevLevelRef = useRef(stats.playerLevel);
  const effectIdCounter = useRef(0);
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
      // Delay boss BGM to let siren play first
      setTimeout(() => {
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
            `Your partner evolved into ${MONSTER_DB[nextFormId].name}!`
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

    // Check Weakness (Enemy Element vs Player Weakness)
    if (currentPartner?.weakness === currentEnemy.element) {
      damage *= 2;
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

    setBattleMessage(`${currentEnemy.name} attacks! ${damage} damage!`);

    if (newPlayerHp === 0) {
      setBattleMessage("You lost...");
      setBattleState("lose");
      setShowDefeatModal(true);
    }
  };

  const handleCorrectStroke = () => {
    // Increment combo on each successful stroke
    setCombo(prev => prev + 1);

    // Katana Slash Effect
    setSlashEffect({
      id: getUniqueId(),
      x: Math.random() * 100 - 50,
      y: Math.random() * 100 - 50,
    });
    setTimeout(() => setSlashEffect(null), 200);
  };

  const handleWriteSuccess = () => {
    if (!currentKanji || battleState !== "battle") return;

    // Player Attacks - base damage + combo bonus (1 per combo stroke)
    let damage = playerAttack + combo;
    let isCritical = false;

    // Check Weakness (Player Element vs Enemy Weakness)
    if (currentEnemy?.weakness === currentPartner?.element) {
      damage *= 2;
      setBattleMessage("Super Effective! " + damage + " damage!");
      setCriticalEffect(true);
      setTimeout(() => setCriticalEffect(false), 500);
      isCritical = true;
    }
    // Check Resistance (Player Element vs Enemy Resistance)
    else if (isResistant(currentPartner?.element, currentEnemy?.element)) {
      damage = Math.floor(damage * 0.5);
      setBattleMessage("Not very effective... " + damage + " damage.");
    } else {
      setBattleMessage("Hit! " + damage + " damage!");
    }

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
      }, 1000);
    }
  };

  const [mistakeCount, setMistakeCount] = useState(0);

  const handleWriteFail = () => {
    if (!currentKanji || battleState !== "battle") return;
    playSfx("mistake");
    setCombo(0); // Reset combo on mistake
    setMistakeCount(prev => prev + 1); // Track mistakes
    setBattleMessage("Missed! Enemy attacks!");

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
    setBattleMessage(`You defeated ${currentEnemy.name}!`);
    setBattleState("win");

    console.log("=== VICTORY ===");
    console.log("Current Enemy:", currentEnemy);
    console.log("EXP Reward:", currentEnemy.expReward);

    // Ensure we have a valid expReward (fallback to 10 if undefined)
    const exp = currentEnemy?.expReward || 10;
    setExpGained(exp);
    addExp(exp);

    console.log("EXP Gained:", exp);
    console.log("Adding EXP to player...");

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

  if (!currentKanji) return <div>Loading...</div>;



  return (
    <div className="w-full h-[100dvh] text-white flex flex-col relative overflow-hidden">
      {/* Battle Arena - Top Section - Uses flex-1 to take remaining space */}
      <div className="relative flex-1 flex items-center justify-center min-h-0">
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
              <span className="text-xs text-red-300 ml-1">Lv.{stageEnemyLevel}</span>
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
                    <span className="text-xs md:text-sm font-black text-yellow-400 drop-shadow-lg">CRITICAL!</span>
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
                style={{ animation: 'fighterIdle 2s ease-in-out infinite' }}
              />
              {/* Level Up Effect */}
              <AnimatePresence>
                {levelUpMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: 0 }}
                    animate={{ opacity: 1, y: -20 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <span className="text-sm md:text-lg font-black text-yellow-400 drop-shadow-lg">LEVEL UP!</span>
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
      </div>

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

        {/* Kanji Canvas - Fixed height container */}
        <div className="flex justify-center pb-3">
          <div
            className="relative rounded-xl overflow-hidden"
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
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {/* Victory Modal */}
        {showVictoryModal && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          >
            <div className="bg-gray-900 border-2 border-yellow-500 p-6 md:p-8 rounded-2xl max-w-md w-[90%] text-center shadow-[0_0_50px_rgba(234,179,8,0.3)] relative overflow-hidden">
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
                  You defeated{" "}
                  <span className="text-white font-bold">
                    {currentEnemy.name}
                  </span>
                  !
                </p>

                {isNewSkin && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="bg-yellow-500 text-black font-bold px-4 py-1 rounded-full text-sm mb-2 animate-pulse"
                  >
                    NEW MONSTER GET!
                  </motion.div>
                )}
              </div>

              {/* Stats Comparison */}
              <div className="bg-gray-800 rounded-lg p-4 mb-4 relative z-10 text-left">
                <h3 className="text-gray-400 text-xs font-bold mb-2 uppercase tracking-wider">
                  Stats Comparison
                </h3>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="text-gray-500"></div>
                  <div className="text-center font-bold text-cyan-400">YOU (Lv.{stats.playerLevel})</div>
                  <div className="text-center font-bold text-red-400">
                    ENEMY (Lv.{stageEnemyLevel})
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

              <div className="flex gap-2 relative z-10">
                <button
                  onClick={handleReturnToMap}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-xl transition-colors text-sm"
                >
                  RETURN
                </button>
                {isNewSkin && (
                  <button
                    onClick={handleEquipNewSkin}
                    className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-xl transition-colors text-sm"
                  >
                    EQUIP SKIN
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
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          >
            <div className="bg-gray-900 border-2 border-red-600 p-6 md:p-8 rounded-2xl max-w-md w-[90%] text-center shadow-[0_0_50px_rgba(220,38,38,0.3)]">
              <h2 className="text-5xl font-black text-red-600 mb-6 drop-shadow-md tracking-widest">
                GAMEOVER
              </h2>

              <div className="text-6xl mb-6">💀</div>

              <p className="text-gray-300 mb-8">
                Don't give up! Review your Kanji and try again.
              </p>

              <button
                onClick={handleReturnToMap}
                className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl transition-colors text-lg"
              >
                RETURN TO MAP
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
