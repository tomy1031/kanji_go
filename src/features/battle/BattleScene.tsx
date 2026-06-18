import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import KanjiWriterCanvas from "../../components/KanjiWriterCanvas";
import MonsterDisplay from "./MonsterDisplay";
import { useUserStore } from "../../store/userStore";
import { useSound } from "../../hooks/useSound";
import { MONSTER_DB, getMonsterStats } from "../../lib/evolutionUtils";
import { ENEMY_DB, getEnemyForStage } from "../../lib/enemyUtils";
import { EXP_TABLE, getExpForNextLevel } from "../../lib/levelUtils";
import { getKanjiForStage } from "../../lib/kanjiUtils";
import { calculateNextReview } from "../../lib/srsAlgorithm";
import { type KanjiData } from "../../types";

interface BattleSceneProps {
  onComplete?: () => void;
}

const BattleScene: React.FC<BattleSceneProps> = ({ onComplete }) => {
  const {
    stats,
    partners,
    evolvePartner,
    addExp,
    progress,
    updateProgress,
    unlockSkin,
    currentStageId,
    unlockNextStage,
    setPartner,
  } = useUserStore();
  const { playBgm, playSfx } = useSound();

  // Game State
  const [playerHp, setPlayerHp] = useState(100);
  const [enemyHp, setEnemyHp] = useState(100);
  const [currentEnemy, setCurrentEnemy] = useState(ENEMY_DB[0]);

  const [battleMessage, setBattleMessage] = useState("Battle Start!");
  const [evolutionMessage, setEvolutionMessage] = useState<string | null>(null);
  const [levelUpMessage, setLevelUpMessage] = useState<boolean>(false);
  const [currentKanji, setCurrentKanji] = useState<KanjiData | null>(null);
  const [isEnemyHit, setIsEnemyHit] = useState(false);
  const [isPlayerHit, setIsPlayerHit] = useState(false);
  const [battleState, setBattleState] = useState<
    "start" | "battle" | "win" | "lose" | "complete"
  >("start");

  // Visual Effects State
  const [slashEffect, setSlashEffect] = useState<{
    id: number;
    x: number;
    y: number;
  } | null>(null);
  const [damageNumber, setDamageNumber] = useState<{
    value: number;
    id: number;
  } | null>(null);
  const [criticalEffect, setCriticalEffect] = useState<boolean>(false);

  // Stage State
  const [stageKanjiList, setStageKanjiList] = useState<KanjiData[]>([]);
  const [completedKanjiIds, setCompletedKanjiIds] = useState<string[]>([]);

  // Modal State
  const [showVictoryModal, setShowVictoryModal] = useState(false);
  const [showDefeatModal, setShowDefeatModal] = useState(false);
  const [expGained, setExpGained] = useState(0);
  const [isNewSkin, setIsNewSkin] = useState(false);

  // Derived Stats
  const currentPartner = MONSTER_DB[partners.currentMonsterId];
  const playerStats = getMonsterStats(
    partners.currentMonsterId,
    stats.playerLevel
  );
  const maxPlayerHp = playerStats.hp;
  const playerAttack = playerStats.attack;

  // Enemy Stats: fixed per-stage values from enemy_data.csv (single source of
  // truth). Enemies no longer scale to player level, so the difficulty curve is
  // authored per stage and stays smooth as the player levels/evolves.
  const enemyStats = { hp: currentEnemy.hp, attack: currentEnemy.attack };
  const maxEnemyHp = enemyStats.hp;

  const stageId = currentStageId || 1;

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

  // Initialize Battle
  useEffect(() => {
    playBgm("battle");

    console.log("BattleScene: Initializing battle");
    console.log("BattleScene: Current Partner:", currentPartner);
    console.log(
      "BattleScene: Player Image Path:",
      `/monsters/${currentPartner.id}.png`
    );

    if (battleState === "start") {
      setPlayerHp(maxPlayerHp);
    }

    const stageEnemy = getEnemyForStage(stageId);
    const enemy =
      stageEnemy || ENEMY_DB[Math.floor(Math.random() * ENEMY_DB.length)];

    console.log("BattleScene: Selected Enemy:", enemy);
    console.log("BattleScene: Enemy Image Path:", enemy.imagePath);

    // Use the enemy's fixed per-stage stats from enemy_data.csv
    const initialEnemyStats = { hp: enemy.hp, attack: enemy.attack };

    setCurrentEnemy(enemy);
    if (battleState === "start") {
      setEnemyHp(initialEnemyStats.hp);
    }

    const kanjis = getKanjiForStage(stageId);
    setStageKanjiList(kanjis);

    setBattleState("battle");
  }, [playBgm, stageId, stats.playerLevel]);

  // Check for evolution
  useEffect(() => {
    const checkEvo = async () => {
      const { checkEvolution, MONSTER_DB } = await import(
        "../../lib/evolutionUtils"
      );
      const nextFormId = checkEvolution(
        partners.currentMonsterId,
        stats.playerLevel
      );
      if (nextFormId) {
        evolvePartner(nextFormId);
        playSfx("evolve");
        setEvolutionMessage(
          `Your partner evolved into ${MONSTER_DB[nextFormId].name}!`
        );
        setTimeout(() => setEvolutionMessage(null), 3000);
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
    if (currentPartner.elementalWeaknesses.includes(currentEnemy.element)) {
      damage *= 2;
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

    // Player Attacks
    let damage = playerAttack;
    let isCritical = false;

    if (currentPartner.elementalStrengths.includes(currentEnemy.element)) {
      damage *= 2;
      setBattleMessage("Super Effective! " + damage + " damage!");
      setCriticalEffect(true);
      setTimeout(() => setCriticalEffect(false), 500);
      isCritical = true;
    } else if (
      currentPartner.elementalWeaknesses.includes(currentEnemy.element)
    ) {
      damage *= 0.5;
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
    setDamageNumber({ value: damage, id: getUniqueId() });
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

    addExp(10);

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

  const handleWriteFail = () => {
    if (!currentKanji || battleState !== "battle") return;
    playSfx("mistake");
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

    const exp = currentEnemy.expReward;
    setExpGained(exp);
    addExp(exp);

    if (!partners.unlockedSkins.includes(currentEnemy.id)) {
      unlockSkin(currentEnemy.id);
      setIsNewSkin(true);
    } else {
      setIsNewSkin(false);
    }

    unlockNextStage();

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

  // Calculate EXP progress for meter using the real EXP table
  const currentLevelBaseExp =
    EXP_TABLE.find((d) => d.level === stats.playerLevel)?.totalExp ?? 0;
  const nextLevelTotalExp = getExpForNextLevel(stats.playerLevel);
  const expSpan = nextLevelTotalExp - currentLevelBaseExp;
  const expInCurrentLevel = stats.currentExp - currentLevelBaseExp;
  const expPercent =
    expSpan === Infinity || expSpan <= 0
      ? 100
      : (expInCurrentLevel / expSpan) * 100;

  return (
    <div className="w-full h-dvh bg-gray-900 text-white flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20" />

      {/* Battle HUD */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-10">
        {/* Player HUD */}
        <div className="bg-black/60 backdrop-blur-md rounded-xl p-3 border border-white/20 min-w-[200px]">
          <div className="flex justify-between items-center mb-1">
            <span className="font-bold text-white">{currentPartner.name}</span>
            <span className="text-yellow-400 font-mono font-bold">
              Lv.{stats.playerLevel}
            </span>
          </div>

          {/* HP Bar */}
          <div className="relative w-full h-4 bg-gray-700 rounded-full overflow-hidden mb-1">
            <div
              className="absolute top-0 left-0 h-full bg-green-500 transition-all duration-500"
              style={{ width: `${(playerHp / maxPlayerHp) * 100}%` }}
            />
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white drop-shadow-md">
              {playerHp} / {maxPlayerHp}
            </span>
          </div>

          {/* EXP Bar */}
          <div className="relative w-full h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="absolute top-0 left-0 h-full bg-cyan-500 transition-all duration-500"
              style={{ width: `${expPercent}%` }}
            />
          </div>
        </div>

        {/* Battle Message */}
        <div className="bg-black/50 backdrop-blur-md rounded-lg p-2 px-4 font-bold text-yellow-400 border border-white/20 animate-pulse mt-2">
          {battleMessage}
        </div>

        {/* Enemy HUD */}
        <div className="bg-black/60 backdrop-blur-md rounded-xl p-3 border border-white/20 min-w-[200px] text-right">
          <div className="flex justify-between items-center mb-1">
            {/* Enemies have fixed per-stage stats, so show the stage number */}
            <span className="text-red-400 font-mono font-bold">
              Stage {stageId}
            </span>
            <span className="font-bold text-white">{currentEnemy.name}</span>
          </div>

          <div className="relative w-full h-4 bg-gray-700 rounded-full overflow-hidden ml-auto">
            <div
              className="absolute top-0 left-0 h-full bg-red-500 transition-all duration-500"
              style={{ width: `${(enemyHp / maxEnemyHp) * 100}%` }}
            />
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white drop-shadow-md">
              {enemyHp} / {maxEnemyHp}
            </span>
          </div>
        </div>
      </div>

      {/* Stage Progress */}
      <div className="absolute top-24 z-10 flex gap-1">
        {stageKanjiList.map((k) => (
          <div
            key={k.id}
            className={`w-3 h-3 rounded-full ${
              completedKanjiIds.includes(k.id) ? "bg-green-500" : "bg-gray-600"
            }`}
          />
        ))}
      </div>

      {/* Monsters Area */}
      <div className="absolute inset-0 flex items-center justify-between px-12 pointer-events-none">
        <div className="relative top-20">
          <MonsterDisplay
            name={currentPartner.name}
            element={currentPartner.element}
            level={stats.playerLevel}
            hp={playerHp}
            maxHp={maxPlayerHp}
            imagePath={`/monsters/${currentPartner.id}.png`}
            isHit={isPlayerHit}
          />
          {/* Level Up Effect */}
          <AnimatePresence>
            {levelUpMessage && (
              <motion.div
                initial={{ opacity: 0, y: 0 }}
                animate={{ opacity: 1, y: -50 }}
                exit={{ opacity: 0 }}
                className="absolute -top-20 left-0 right-0 text-center z-50"
              >
                <span className="text-4xl font-black text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.8)]">
                  LEVEL UP!
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="relative bottom-20">
          <MonsterDisplay
            name={currentEnemy.name}
            element={currentEnemy.element}
            level={stageId}
            hp={enemyHp}
            maxHp={maxEnemyHp}
            imagePath={currentEnemy.imagePath}
            isEnemy={true}
            isHit={isEnemyHit}
          />
          {/* Visual Effects Overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <AnimatePresence>
              {/* Slash Effect */}
              {slashEffect && (
                <motion.div
                  key={slashEffect.id}
                  initial={{
                    opacity: 1,
                    scale: 0.5,
                    rotate: -45,
                    pathLength: 0,
                  }}
                  animate={{
                    opacity: 0,
                    scale: 1.5,
                    rotate: 45,
                    pathLength: 1,
                  }}
                  exit={{ opacity: 0 }}
                  className="absolute w-64 h-2 bg-white shadow-[0_0_20px_rgba(255,255,255,0.8)]"
                  style={{
                    top: "50%",
                    left: "50%",
                    transform: `translate(-50%, -50%) translate(${slashEffect.x}px, ${slashEffect.y}px)`,
                  }}
                />
              )}
              {/* Critical Effect */}
              {criticalEffect && (
                <motion.div
                  initial={{ opacity: 0, scale: 2 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute text-6xl font-black text-red-600 z-50 drop-shadow-lg"
                >
                  CRITICAL!
                </motion.div>
              )}
              {/* Damage Number */}
              {damageNumber && (
                <motion.div
                  key={damageNumber.id}
                  initial={{ opacity: 1, y: 0, scale: 0.5 }}
                  animate={{ opacity: 0, y: -100, scale: 1.5 }}
                  className="absolute text-6xl font-black text-red-500 drop-shadow-[0_0_5px_rgba(0,0,0,0.8)]"
                  style={{
                    top: "0%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  -{damageNumber.value}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Kanji Writer Overlay */}
      <div className="absolute bottom-8 z-20 flex flex-col items-center">
        <div className="bg-black/60 backdrop-blur-md p-4 rounded-2xl border border-white/10 shadow-2xl">
          <div className="flex justify-between items-center mb-2 px-2">
            <span className="text-gray-300 text-sm font-mono">
              WRITE:{" "}
              <span className="text-white font-bold text-lg ml-2">
                {currentKanji.meanings[0]}
              </span>
            </span>
            <span className="text-cyan-400 font-bold text-lg">
              {currentKanji.readings.on[0]}
            </span>
          </div>

          <div className="bg-white rounded-xl overflow-hidden shadow-inner border-4 border-gray-600">
            {battleState !== "win" && (
              <KanjiWriterCanvas
                key={currentKanji.id} // Force remount on change
                char={currentKanji.char}
                size={280}
                onCorrectStroke={handleCorrectStroke}
                onComplete={handleWriteSuccess}
                onMistake={handleWriteFail}
                quizMode={true}
              />
            )}
            {battleState === "win" && (
              <div className="w-[280px] h-[280px] flex flex-col items-center justify-center bg-green-50 text-green-600 animate-bounce">
                <span className="text-6xl">🏆</span>
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
            <div className="bg-gray-900 border-2 border-yellow-500 p-8 rounded-2xl max-w-md w-full text-center shadow-[0_0_50px_rgba(234,179,8,0.3)] relative overflow-hidden">
              {/* Animated Background Rays */}
              <div className="absolute inset-0 bg-[conic-gradient(from_0deg,transparent_0_deg,rgba(234,179,8,0.1)_20deg,transparent_40deg)] animate-[spin_4s_linear_infinite]" />

              <h2 className="text-4xl font-black text-yellow-400 mb-4 drop-shadow-md relative z-10">
                STAGE CLEAR!
              </h2>

              <div className="mb-6 relative z-10 flex flex-col items-center">
                <div className="w-32 h-32 bg-black/50 rounded-full flex items-center justify-center mb-4 border-4 border-yellow-500 shadow-lg overflow-hidden">
                  <img
                    src={currentEnemy.imagePath}
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
                  Stats Comparison (Lv.{stats.playerLevel})
                </h3>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="text-gray-500"></div>
                  <div className="text-center font-bold text-cyan-400">YOU</div>
                  <div className="text-center font-bold text-red-400">
                    ENEMY
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
            <div className="bg-gray-900 border-2 border-red-600 p-8 rounded-2xl max-w-md w-full text-center shadow-[0_0_50px_rgba(220,38,38,0.3)]">
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
