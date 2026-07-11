import { useState, useEffect, useCallback, useRef } from 'react';
import BattleScene from './features/battle/BattleScene';
import CartridgeSelect from './features/launcher/CartridgeSelect';
import OpeningSequence from './features/launcher/OpeningSequence';

import WorldMap from './features/map/WorldMap';
import TitleScreen from './features/title/TitleScreen';
import GameMenu from './features/menu/GameMenu';
import MonsterStatus from './features/menu/MonsterStatus';
import PracticeMode from './features/practice/PracticeMode';
import OnlineLobby from './features/online/OnlineLobby';
import AssetPreloader from './components/AssetPreloader';
import DebugMode from './components/DebugMode';
import { GameVersion } from './types';
import { useUserStore } from './store/userStore';
import { SoundProvider } from './lib/SoundManager';
import OnlineBattleScene from './features/online/OnlineBattleScene';
import { useOnlineStore } from './features/online/onlineStore';

type Scene = 'PRELOAD' | 'OPENING' | 'LAUNCHER' | 'TITLE' | 'MENU' | 'MAP' | 'BATTLE' | 'STATUS' | 'PRACTICE' | 'ONLINE' | 'ONLINE_BATTLE';

// Hidden command: Press Shift+D 5 times within 2 seconds to open debug mode
const DEBUG_KEY_COUNT = 5;
const DEBUG_KEY_TIMEOUT = 2000;
// Mobile: 5 rapid taps anywhere on screen
const DEBUG_TAP_COUNT = 10;

function App() {
  const [scene, setScene] = useState<Scene>('PRELOAD');
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const { profile } = useUserStore();
  const { connectionStatus } = useOnlineStore();

  // Effect to switch to ONLINE_BATTLE when connected
  useEffect(() => {
    if (scene === 'ONLINE' && connectionStatus === 'connected') {
      setScene('ONLINE_BATTLE');
    }
  }, [scene, connectionStatus]);

  // Debug mode key tracking
  const debugKeyPresses = useRef<number[]>([]);
  const debugTaps = useRef<number[]>([]);

  // Listen for debug mode activation (Shift+D x 5)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && e.key.toLowerCase() === 'd') {
        const now = Date.now();
        debugKeyPresses.current.push(now);

        // Filter out old presses
        debugKeyPresses.current = debugKeyPresses.current.filter(
          time => now - time < DEBUG_KEY_TIMEOUT
        );

        // Check if we have enough presses
        if (debugKeyPresses.current.length >= DEBUG_KEY_COUNT) {
          setShowDebug(true);
          debugKeyPresses.current = [];
        }
      }
    };

    // Mobile: 5 rapid taps anywhere on screen (using touchend for better detection)
    const handleTouch = () => {
      const now = Date.now();
      debugTaps.current.push(now);

      // Filter out old taps
      debugTaps.current = debugTaps.current.filter(
        time => now - time < DEBUG_KEY_TIMEOUT
      );

      // Check if we have enough taps
      if (debugTaps.current.length >= DEBUG_TAP_COUNT) {
        setShowDebug(true);
        debugTaps.current = [];
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('touchend', handleTouch);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('touchend', handleTouch);
    };
  }, []);

  // Prevent unused variable error
  useEffect(() => {
    if (selectedLevel) console.log(selectedLevel);
  }, [selectedLevel]);

  const handleOpeningComplete = () => {
    setScene('LAUNCHER');
  };

  const handleVersionSelect = (version: GameVersion) => {
    console.log(`Selected version: ${version} `);
    // Skip starter selection, go directly to title
    setScene('TITLE');
  };

  const handleTitleStart = () => {
    setScene('MENU');
  };

  const handleTitleBack = () => {
    setScene('LAUNCHER');
  };

  const handleLevelSelect = (stageKey: string) => {
    console.log(`Selected stage: ${stageKey}`);
    setSelectedLevel(stageKey);
    setScene('BATTLE');
  };

  const handleBattleEnd = () => {
    setScene('MAP');
  };

  const handlePreloadComplete = useCallback(() => {
    setScene('OPENING');
  }, []);

  return (
    <SoundProvider>
      <div className="w-full h-dvh bg-gray-900 text-white font-sans overflow-hidden">
        {scene === 'PRELOAD' && (
          <AssetPreloader onComplete={handlePreloadComplete}>
            <div />
          </AssetPreloader>
        )}
        {scene === 'OPENING' && <OpeningSequence onComplete={handleOpeningComplete} />}
        {scene === 'LAUNCHER' && <CartridgeSelect onSelect={handleVersionSelect} />}

        {scene === 'TITLE' && <TitleScreen version={profile.currentVersion} onStart={handleTitleStart} onBack={handleTitleBack} />}

        {scene === 'MENU' && (
          <GameMenu
            onQuest={() => setScene('MAP')}
            onPractice={() => setScene('PRACTICE')}
            onStatus={() => setScene('STATUS')}
            onOnline={() => setScene('ONLINE')}
            onBack={() => setScene('TITLE')}
          />
        )}

        {scene === 'PRACTICE' && <PracticeMode onBack={() => setScene('MENU')} />}

        {scene === 'ONLINE' && <OnlineLobby onBack={() => setScene('MENU')} />}
        {scene === 'ONLINE_BATTLE' && <OnlineBattleScene onLeave={() => setScene('ONLINE')} />}

        {scene === 'STATUS' && <MonsterStatus onBack={() => setScene('MENU')} />}

        {scene === 'MAP' && <WorldMap onLevelSelect={handleLevelSelect} onBack={() => setScene('MENU')} />}

        {scene === 'BATTLE' && (
          <div className="relative w-full h-full">
            <button
              onClick={handleBattleEnd}
              aria-label="バトルをやめる"
              className="absolute top-2 right-2 z-50 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-bold text-white/80 border border-white/20 hover:bg-black/80 hover:text-white active:scale-95 transition-all"
            >
              ✕ にげる
            </button>
            {selectedLevel && (() => {
              const [world, order] = selectedLevel.split('-').map(Number);
              return <BattleScene world={world} order={order} onComplete={handleBattleEnd} />;
            })()}
          </div>
        )}

        {/* Debug Mode Modal */}
        <DebugMode isOpen={showDebug} onClose={() => setShowDebug(false)} />
      </div>
    </SoundProvider>
  );
}

export default App;
