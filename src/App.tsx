import { useState, useEffect } from 'react';
import BattleScene from './features/battle/BattleScene';
import CartridgeSelect from './features/launcher/CartridgeSelect';
import OpeningSequence from './features/launcher/OpeningSequence';
import StarterSelection from './features/launcher/StarterSelection';
import WorldMap from './features/map/WorldMap';
import TitleScreen from './features/title/TitleScreen';
import GameMenu from './features/menu/GameMenu';
import MonsterStatus from './features/menu/MonsterStatus';
import PracticeMode from './features/practice/PracticeMode';
import { GameVersion } from './types';
import { useUserStore } from './store/userStore';
import { SoundProvider } from './lib/SoundManager';
import InstallPrompt from './components/InstallPrompt';

type Scene = 'OPENING' | 'LAUNCHER' | 'STARTER_SELECT' | 'TITLE' | 'MENU' | 'MAP' | 'BATTLE' | 'STATUS' | 'PRACTICE';

function App() {
  const [scene, setScene] = useState<Scene>('OPENING');
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const { profile, partners } = useUserStore();

  // Prevent unused variable error
  useEffect(() => {
    if (selectedLevel) console.log(selectedLevel);
  }, [selectedLevel]);

  const handleOpeningComplete = () => {
    setScene('LAUNCHER');
  };

  const handleVersionSelect = (version: GameVersion) => {
    console.log(`Selected version: ${version} `);
    // Check if user has a starter
    if (!partners.currentMonsterId || partners.currentMonsterId === 'starter_fire') {
      // Note: 'starter_fire' is default in initial state, but we might want to force selection if it's a "fresh" start.
      // For now, let's assume if they haven't "really" picked, we show it.
      // Or better, check if they have unlocked any skins other than default?
      // Let's just show it if they are on the default and haven't played? 
      // Simplified: Always show starter select if it's the first time (we can track this via a flag or just check if unlockedSkins has only 1).
      if (partners.unlockedSkins.length <= 1) {
        setScene('STARTER_SELECT');
      } else {
        setScene('TITLE');
      }
    } else {
      setScene('TITLE');
    }
  };

  const handleStarterSelected = () => {
    setScene('TITLE');
  };

  const handleTitleStart = () => {
    setScene('MENU');
  };

  const handleTitleBack = () => {
    setScene('LAUNCHER');
  };

  const handleLevelSelect = (levelId: string) => {
    console.log(`Selected level: ${levelId} `);
    setSelectedLevel(levelId);
    setScene('BATTLE');
  };

  const handleBattleEnd = () => {
    setScene('MAP');
  };

  return (
    <SoundProvider>
      {/* min-h-dvh (not h-screen) lets pages grow taller than the viewport and
          scroll on small/landscape screens; overflow-x-hidden contains the
          decorative background layers. */}
      <div className="w-full min-h-dvh bg-gray-900 text-white font-sans overflow-x-hidden">
        {scene === 'OPENING' && <OpeningSequence onComplete={handleOpeningComplete} />}
        {scene === 'LAUNCHER' && <CartridgeSelect onSelect={handleVersionSelect} />}
        {scene === 'STARTER_SELECT' && <StarterSelection onSelect={handleStarterSelected} />}
        {scene === 'TITLE' && <TitleScreen version={profile.currentVersion} onStart={handleTitleStart} onBack={handleTitleBack} />}

        {scene === 'MENU' && (
          <GameMenu
            onQuest={() => setScene('MAP')}
            onPractice={() => setScene('PRACTICE')}
            onStatus={() => setScene('STATUS')}
            onBack={() => setScene('TITLE')}
          />
        )}

        {scene === 'PRACTICE' && <PracticeMode onBack={() => setScene('MENU')} />}

        {scene === 'STATUS' && <MonsterStatus onBack={() => setScene('MENU')} />}

        {scene === 'MAP' && <WorldMap onLevelSelect={handleLevelSelect} />}

        {scene === 'BATTLE' && (
          <div className="relative w-full h-dvh">
            {/* Bottom-right so it doesn't overlap the enemy HUD (top-right) */}
            <button
              onClick={handleBattleEnd}
              className="absolute bottom-4 right-4 z-50 bg-gray-800/70 px-3 py-1 rounded text-sm hover:bg-gray-700"
            >
              Exit Battle
            </button>
            <BattleScene onComplete={handleBattleEnd} />
          </div>
        )}

        <InstallPrompt />
      </div>
    </SoundProvider>
  );
}

export default App;
