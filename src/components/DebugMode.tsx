import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUserStore } from '../store/userStore';
import { getAssetPath } from '../utils/assetUtils';
import { MONSTER_DB } from '../lib/evolutionUtils';

// Debug parameters with default values
const DEFAULT_DEBUG_PARAMS = {
    // Hanzi Writer parameters
    strokeAnimationSpeed: 1,       // 0.5-3
    strokeWidth: 30,               // 10-50
    outlineWidth: 2,               // 1-10
    showOutline: true,
    showCharacter: true,
    drawingWidth: 15,              // 5-30
    strokeHighlightSpeed: 1,       // 0.5-3
    delayBetweenStrokes: 200,      // 0-500ms
    leniency: 1.0,                 // 0.5-2.0 (stroke matching leniency)

    // Game parameters
    expMultiplier: 1.0,            // 0.5-5.0
    goldMultiplier: 1.0,           // 0.5-5.0
    damageMultiplier: 1.0,         // 0.5-5.0
    masteryThreshold: 20,          // 5-50

    // Battle parameters
    comboBonus: 1,                 // 0-10 per combo
    criticalChance: 0.1,           // 0-1
    criticalMultiplier: 1.5,       // 1-3

    // Online battle parameters
    onlineAttackDamage: 15,        // Base damage when opponent succeeds (damage dealt TO you)
    onlineMistakeDamage: 5,        // Damage dealt TO you when YOU make a mistake
};

export type DebugParams = typeof DEFAULT_DEBUG_PARAMS;

// Storage key for debug params
const DEBUG_PARAMS_KEY = 'kanjigo-debug-params';

// Get debug params from localStorage
export const getDebugParams = (): DebugParams => {
    try {
        const stored = localStorage.getItem(DEBUG_PARAMS_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            const result = { ...DEFAULT_DEBUG_PARAMS };

            // Merge stored values, ignore unknown keys
            Object.keys(DEFAULT_DEBUG_PARAMS).forEach(key => {
                if (key in parsed) {
                    (result as any)[key] = parsed[key];
                }
            });

            // Warn about unknown keys
            Object.keys(parsed).forEach(key => {
                if (!(key in DEFAULT_DEBUG_PARAMS)) {
                    console.warn(`[Debug] Unknown parameter: ${key}`);
                }
            });

            return result;
        }
    } catch (e) {
        console.error('[Debug] Failed to load params:', e);
    }
    return { ...DEFAULT_DEBUG_PARAMS };
};

// Save debug params to localStorage
export const setDebugParams = (params: Partial<DebugParams>) => {
    try {
        const current = getDebugParams();
        const updated = { ...current, ...params };
        localStorage.setItem(DEBUG_PARAMS_KEY, JSON.stringify(updated));
        return updated;
    } catch (e) {
        console.error('[Debug] Failed to save params:', e);
        return getDebugParams();
    }
};

interface DebugModeProps {
    isOpen: boolean;
    onClose: () => void;
}

type TabType = 'params' | 'save' | 'csv';

const DebugMode: React.FC<DebugModeProps> = ({ isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState<TabType>('params');
    const [params, setParams] = useState<DebugParams>(getDebugParams());
    const { partners, stats, progress, stageRatings, maxUnlockedStage, profile, debugSettings, updateDebugSettings } = useUserStore();

    useEffect(() => {
        setParams(getDebugParams());
    }, [isOpen]);

    const handleParamChange = (key: keyof DebugParams, value: number | boolean) => {
        const updated = setDebugParams({ [key]: value });
        setParams(updated);
    };

    const handleExportParams = () => {
        const dataStr = JSON.stringify(params, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'kanjigo-debug-params.json';
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleImportParams = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const imported = JSON.parse(event.target?.result as string);
                const updated = setDebugParams(imported);
                setParams(updated);
                alert('パラメータをインポートしました');
            } catch (err) {
                alert('JSONの解析に失敗しました');
            }
        };
        reader.readAsText(file);
    };

    const handleExportSaveData = () => {
        const saveData = {
            partners,
            stats,
            progress,
            stageRatings,
            maxUnlockedStage,
            profile,
        };
        const dataStr = JSON.stringify(saveData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'kanjigo-save-data.json';
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleImportSaveData = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const imported = JSON.parse(event.target?.result as string);
                // Apply each part of the save data
                if (imported.partners) {
                    useUserStore.setState({ partners: imported.partners });
                }
                if (imported.stats) {
                    useUserStore.setState({ stats: imported.stats });
                }
                if (imported.progress) {
                    useUserStore.setState({ progress: imported.progress });
                }
                if (imported.stageRatings) {
                    useUserStore.setState({ stageRatings: imported.stageRatings });
                }
                if (imported.maxUnlockedStage) {
                    useUserStore.setState({ maxUnlockedStage: imported.maxUnlockedStage });
                }
                if (imported.profile) {
                    useUserStore.setState({ profile: imported.profile });
                }
                alert('セーブデータをインポートしました');
            } catch (err) {
                alert('JSONの解析に失敗しました');
            }
        };
        reader.readAsText(file);
    };

    const handleResetSaveData = () => {
        if (confirm('本当にセーブデータを初期化しますか？この操作は取り消せません。')) {
            localStorage.removeItem('kanjigo-storage');
            window.location.reload();
        }
    };

    const handleUnlockAllStages = () => {
        useUserStore.setState({ maxUnlockedStage: 60 }); // High number for all stages
        alert('全ステージをアンロックしました');
    };

    const handleUnlockAllMonsters = () => {
        // Get all monster IDs from MONSTER_DB (no magic numbers)
        const allMonsterIds = Object.keys(MONSTER_DB);
        useUserStore.setState(state => ({
            partners: {
                ...state.partners,
                unlockedSkins: [...new Set([...state.partners.unlockedSkins, ...allMonsterIds])]
            }
        }));
        alert(`全モンスター(${allMonsterIds.length}体)をアンロックしました`);
    };

    const handleSetPlayerLevel = (level: number) => {
        useUserStore.setState(state => ({
            stats: { ...state.stats, playerLevel: level, exp: 0 }
        }));
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="bg-gray-900 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-red-500"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="p-4 bg-red-900 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <span className="text-2xl">🔧</span>
                            <h2 className="text-xl font-bold text-white">DEBUG MODE</h2>
                        </div>
                        <button onClick={onClose} className="text-white hover:text-red-300 text-2xl">✕</button>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-gray-700 bg-gray-800">
                        {[
                            { id: 'params', label: 'パラメータ' },
                            { id: 'save', label: 'セーブデータ' },
                            { id: 'csv', label: 'CSVエディタ' },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as TabType)}
                                className={`px-6 py-3 font-bold transition-colors ${activeTab === tab.id
                                    ? 'bg-red-600 text-white'
                                    : 'text-gray-400 hover:text-white'
                                    }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-4">
                        {activeTab === 'params' && (
                            <div className="space-y-6">
                                {/* Import/Export */}
                                <div className="flex gap-2 mb-4">
                                    <button
                                        onClick={handleExportParams}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-white font-bold"
                                    >
                                        📤 エクスポート
                                    </button>
                                    <label className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded text-white font-bold cursor-pointer">
                                        📥 インポート
                                        <input type="file" accept=".json" onChange={handleImportParams} className="hidden" />
                                    </label>
                                </div>

                                {/* Hanzi Writer Parameters */}
                                <div className="bg-gray-800 rounded-lg p-4">
                                    <h3 className="text-lg font-bold text-cyan-400 mb-4">漢字書き取り設定</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <ParamSlider
                                            label="ストローク判定（緩さ）"
                                            value={params.leniency}
                                            min={0.5} max={2} step={0.1}
                                            onChange={(v) => handleParamChange('leniency', v)}
                                            hint="高いほど判定が緩くなります"
                                        />
                                        <ParamSlider
                                            label="描画線の太さ"
                                            value={params.drawingWidth}
                                            min={5} max={30} step={1}
                                            onChange={(v) => handleParamChange('drawingWidth', v)}
                                        />
                                        <ParamSlider
                                            label="アニメーション速度"
                                            value={params.strokeAnimationSpeed}
                                            min={0.5} max={3} step={0.1}
                                            onChange={(v) => handleParamChange('strokeAnimationSpeed', v)}
                                        />
                                        <ParamSlider
                                            label="ストローク間の遅延(ms)"
                                            value={params.delayBetweenStrokes}
                                            min={0} max={500} step={50}
                                            onChange={(v) => handleParamChange('delayBetweenStrokes', v)}
                                        />
                                        <ParamToggle
                                            label="アウトライン表示"
                                            value={params.showOutline}
                                            onChange={(v) => handleParamChange('showOutline', v)}
                                        />
                                        <ParamToggle
                                            label="文字表示"
                                            value={params.showCharacter}
                                            onChange={(v) => handleParamChange('showCharacter', v)}
                                        />
                                    </div>
                                </div>

                                {/* Game Parameters */}
                                <div className="bg-gray-800 rounded-lg p-4">
                                    <h3 className="text-lg font-bold text-yellow-400 mb-4">ゲーム設定</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <ParamSlider
                                            label="経験値倍率"
                                            value={params.expMultiplier}
                                            min={0.5} max={5} step={0.5}
                                            onChange={(v) => handleParamChange('expMultiplier', v)}
                                        />
                                        <ParamSlider
                                            label="ゴールド倍率"
                                            value={params.goldMultiplier}
                                            min={0.5} max={5} step={0.5}
                                            onChange={(v) => handleParamChange('goldMultiplier', v)}
                                        />
                                        <ParamSlider
                                            label="ダメージ倍率"
                                            value={params.damageMultiplier}
                                            min={0.5} max={5} step={0.5}
                                            onChange={(v) => handleParamChange('damageMultiplier', v)}
                                        />
                                        <ParamSlider
                                            label="マスター閾値"
                                            value={params.masteryThreshold}
                                            min={5} max={50} step={5}
                                            onChange={(v) => handleParamChange('masteryThreshold', v)}
                                        />
                                        <ParamToggle
                                            label="練習モードEXP加算"
                                            value={debugSettings.practiceExpMode === 'CHAR'}
                                            onChange={(v) => updateDebugSettings({ practiceExpMode: v ? 'CHAR' : 'COMPLETE' })}
                                        />
                                        <div className="text-xs text-gray-400 col-span-1 md:col-span-2 text-right">
                                            {debugSettings.practiceExpMode === 'CHAR'
                                                ? '文字ごと (1回毎に加算)'
                                                : 'ステージ完了時 (まとめて加算)'}
                                        </div>
                                    </div>
                                </div>

                                {/* Battle Parameters */}
                                <div className="bg-gray-800 rounded-lg p-4">
                                    <h3 className="text-lg font-bold text-red-400 mb-4">バトル設定</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <ParamSlider
                                            label="被ダメージ (相手成功)"
                                            value={params.onlineAttackDamage}
                                            min={5} max={50} step={1}
                                            onChange={(v) => handleParamChange('onlineAttackDamage', v)}
                                            hint="自分が受けるダメージ（通常攻撃）"
                                        />
                                        <ParamSlider
                                            label="被ダメージ (自分のミス)"
                                            value={params.onlineMistakeDamage}
                                            min={1} max={30} step={1}
                                            onChange={(v) => handleParamChange('onlineMistakeDamage', v)}
                                            hint="不正解時に受けるダメージ"
                                        />
                                        <ParamSlider
                                            label="コンボボーナス"
                                            value={params.comboBonus}
                                            min={0} max={10} step={1}
                                            onChange={(v) => handleParamChange('comboBonus', v)}
                                        />
                                        <ParamSlider
                                            label="クリティカル確率"
                                            value={params.criticalChance}
                                            min={0} max={1} step={0.05}
                                            onChange={(v) => handleParamChange('criticalChance', v)}
                                        />
                                        <ParamSlider
                                            label="クリティカル倍率"
                                            value={params.criticalMultiplier}
                                            min={1} max={3} step={0.1}
                                            onChange={(v) => handleParamChange('criticalMultiplier', v)}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'save' && (
                            <div className="space-y-6">
                                {/* Import/Export/Reset - FIRST */}
                                <div className="bg-gray-800 rounded-lg p-4">
                                    <h3 className="text-lg font-bold text-red-400 mb-4">データ管理</h3>
                                    <div className="flex gap-2 flex-wrap">
                                        <button
                                            onClick={handleExportSaveData}
                                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-white font-bold"
                                        >
                                            📤 セーブデータ エクスポート
                                        </button>
                                        <label className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded text-white font-bold cursor-pointer">
                                            📥 セーブデータ インポート
                                            <input type="file" accept=".json" onChange={handleImportSaveData} className="hidden" />
                                        </label>
                                        <button
                                            onClick={handleResetSaveData}
                                            className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded text-white font-bold"
                                        >
                                            ⚠️ データ初期化
                                        </button>
                                    </div>
                                </div>

                                {/* Current Save Info */}
                                <div className="bg-gray-800 rounded-lg p-4">
                                    <h3 className="text-lg font-bold text-cyan-400 mb-4">現在のセーブデータ</h3>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                        <div className="bg-gray-700 p-3 rounded">
                                            <div className="text-gray-400">プレイヤーレベル</div>
                                            <div className="text-2xl font-bold text-white">{stats.playerLevel}</div>
                                        </div>
                                        <div className="bg-gray-700 p-3 rounded">
                                            <div className="text-gray-400">解放ステージ数</div>
                                            <div className="text-2xl font-bold text-white">{maxUnlockedStage}</div>
                                        </div>
                                        <div className="bg-gray-700 p-3 rounded">
                                            <div className="text-gray-400">解放モンスター数</div>
                                            <div className="text-2xl font-bold text-white">{partners.unlockedSkins.length}</div>
                                        </div>
                                        <div className="bg-gray-700 p-3 rounded">
                                            <div className="text-gray-400">現在のバージョン</div>
                                            <div className="text-2xl font-bold text-white">{profile.currentVersion}</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Level Adjustment - Slider */}
                                <div className="bg-gray-800 rounded-lg p-4">
                                    <h3 className="text-lg font-bold text-yellow-400 mb-4">レベル調整</h3>
                                    <div className="flex items-center gap-4">
                                        <input
                                            type="range"
                                            min={1}
                                            max={99}
                                            value={stats.playerLevel}
                                            onChange={(e) => handleSetPlayerLevel(parseInt(e.target.value))}
                                            className="flex-1 accent-yellow-500"
                                        />
                                        <input
                                            type="number"
                                            min={1}
                                            max={99}
                                            value={stats.playerLevel}
                                            onChange={(e) => handleSetPlayerLevel(Math.max(1, Math.min(99, parseInt(e.target.value) || 1)))}
                                            className="w-16 bg-gray-700 text-white text-center rounded px-2 py-1 font-bold text-lg"
                                        />
                                    </div>
                                </div>

                                {/* Quick Actions */}
                                <div className="bg-gray-800 rounded-lg p-4">
                                    <h3 className="text-lg font-bold text-green-400 mb-4">クイックアクション</h3>
                                    <div className="flex gap-2 flex-wrap">
                                        <button
                                            onClick={handleUnlockAllStages}
                                            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded text-white font-bold"
                                        >
                                            � 全ステージ解放
                                        </button>
                                        <button
                                            onClick={handleUnlockAllMonsters}
                                            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded text-white font-bold"
                                        >
                                            🐉 全モンスター解放
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'csv' && (
                            <CsvEditor />
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

// Slider component for parameters
const ParamSlider: React.FC<{
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    onChange: (value: number) => void;
    hint?: string;
}> = ({ label, value, min, max, step, onChange, hint }) => (
    <div>
        <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-300">{label}</span>
            <span className="text-cyan-400 font-mono">{value}</span>
        </div>
        <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="w-full accent-cyan-500"
        />
        {hint && <div className="text-xs text-gray-500 mt-1">{hint}</div>}
    </div>
);

// Toggle component for boolean parameters
const ParamToggle: React.FC<{
    label: string;
    value: boolean;
    onChange: (value: boolean) => void;
}> = ({ label, value, onChange }) => (
    <div className="flex items-center justify-between">
        <span className="text-gray-300">{label}</span>
        <button
            onClick={() => onChange(!value)}
            className={`px-4 py-1 rounded font-bold transition-colors ${value ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-300'
                }`}
        >
            {value ? 'ON' : 'OFF'}
        </button>
    </div>
);

// CSV Editor Component
import { setCsvOverride, getCsvOverride, hasCsvOverride, clearCsvOverride, type CsvType } from '../lib/csvOverride';
import { refreshMonsterDb } from '../lib/evolutionUtils';
import { refreshEnemyDb } from '../lib/enemyUtils';

const CsvEditor: React.FC = () => {
    const [selectedCsv, setSelectedCsv] = useState<CsvType>('monster_data');
    const [csvData, setCsvData] = useState<string[][]>([]);
    const [headers, setHeaders] = useState<string[]>([]);
    const [monsterImages, setMonsterImages] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [hasOverrideData, setHasOverrideData] = useState(false);
    const [applyMessage, setApplyMessage] = useState<string | null>(null);

    // Get monster images from MONSTER_DB (derived from CSV data, no magic numbers)
    useEffect(() => {
        // All monster IDs are loaded from CSV files via MONSTER_DB
        const allMonsterIds = Object.keys(MONSTER_DB);
        setMonsterImages(allMonsterIds);
    }, []);

    const loadCsv = useCallback(async (type: typeof selectedCsv) => {
        try {
            // First check if we have an override in localStorage
            const override = hasCsvOverride(type);
            let csvContent = '';

            if (override) {
                // Use override data
                const overrideData = getCsvOverride(type);
                if (overrideData) csvContent = overrideData;
            }

            // If no override or empty, load from static file
            if (!csvContent) {
                if (type === 'monster_data') {
                    csvContent = (await import('../data/monster_data.csv?raw')).default;
                } else if (type === 'stage_data') {
                    csvContent = (await import('../data/stage_data.csv?raw')).default;
                } else if (type === 'kanji_master') {
                    csvContent = (await import('../data/kanji_master.csv?raw')).default;
                } else if (type === 'exp_table') {
                    csvContent = (await import('../data/exp_table.csv?raw')).default;
                }
            }

            const lines = csvContent.trim().split('\n');
            const parsedHeaders = lines[0].split(',');
            const parsedData = lines.slice(1).map(line => line.split(','));

            setHeaders(parsedHeaders);
            setCsvData(parsedData);
            setError(null);
            setHasOverrideData(override);
        } catch (e) {
            setError(`CSVの読み込みに失敗: ${e}`);
        }
    }, []);

    useEffect(() => {
        loadCsv(selectedCsv);
    }, [selectedCsv, loadCsv]);

    // Convert current data to CSV string
    const getCsvContent = () => {
        const headerRow = headers.join(',');
        const dataRows = csvData.map(row => row.join(','));
        return [headerRow, ...dataRows].join('\n');
    };

    // Apply changes to game (save to localStorage)
    const handleApplyToGame = () => {
        const content = getCsvContent();
        setCsvOverride(selectedCsv, content);
        setHasOverrideData(true);

        // Refresh the databases
        if (selectedCsv === 'monster_data') {
            refreshMonsterDb();
            // EnemyDB is now just a filtered view of MonsterDB, so refreshing MonsterDB is enough
            // But we call refreshEnemyDb just in case it has its own cache logic (it does)
            refreshEnemyDb();
        } else if (selectedCsv === 'stage_data') {
            // Stage data is read dynamically, no cache to refresh
        }

        setApplyMessage('✅ ゲームに適用しました！');
        setTimeout(() => setApplyMessage(null), 3000);
    };

    // Reset to default (remove override)
    const handleResetToDefault = () => {
        if (confirm('オーバーライドを削除して、元のデータに戻しますか？')) {
            clearCsvOverride(selectedCsv);
            setHasOverrideData(false);
            loadCsv(selectedCsv); // Reload from static

            // Refresh the databases
            refreshMonsterDb();
            refreshEnemyDb();

            setApplyMessage('🔄 元のデータに戻しました');
            setTimeout(() => setApplyMessage(null), 3000);
        }
    };

    const handleCellChange = (rowIndex: number, colIndex: number, value: string) => {
        const newData = [...csvData];
        newData[rowIndex] = [...newData[rowIndex]];
        newData[rowIndex][colIndex] = value;
        setCsvData(newData);
    };

    // Import CSV from file
    const handleImportCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const content = event.target?.result as string;
                const lines = content.trim().split('\n');
                const importedHeaders = lines[0].split(',');
                const importedData = lines.slice(1).map(line => line.split(','));

                setHeaders(importedHeaders);
                setCsvData(importedData);
                setApplyMessage(`📄 CSVをインポートしました（${importedData.length}行）`);
                setTimeout(() => setApplyMessage(null), 3000);
            } catch (err) {
                setError(`CSVインポートに失敗: ${err}`);
            }
        };
        reader.readAsText(file);
        // Reset input so same file can be re-imported
        e.target.value = '';
    };

    const handleDownload = () => {
        const headerRow = headers.join(',');
        const dataRows = csvData.map(row => row.join(','));
        const content = [headerRow, ...dataRows].join('\n');

        const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${selectedCsv}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleAddRow = () => {
        const newRow = headers.map(() => '');
        setCsvData([...csvData, newRow]);
    };

    const handleDeleteRow = (index: number) => {
        if (confirm('この行を削除しますか？')) {
            const newData = csvData.filter((_, i) => i !== index);
            setCsvData(newData);
        }
    };

    // Element types for dropdown (matching new 5-element system)
    const ELEMENT_TYPES = ['FIRE', 'WATER', 'NATURE', 'LIGHT', 'DARK', 'BOSS', 'NONE'];
    const ELEMENT_ICONS: Record<string, string> = {
        'FIRE': '🔥', 'WATER': '💧', 'NATURE': '🌿',
        'LIGHT': '✨', 'DARK': '🌑', 'BOSS': '👿', 'NONE': '⚪'
    };

    // Determine if a column is an ID column (first column) or foreign key
    const isIdColumn = (header: string) => header === 'id' || header === 'enemy_id';
    const isForeignKeyColumn = (header: string) => header.includes('_id') && header !== 'id';
    const isElementColumn = (header: string) => header === 'element' || header === 'weakness';

    return (
        <div className="space-y-4">
            {/* CSV Selector */}
            <div className="flex gap-2 items-center flex-wrap">
                <select
                    value={selectedCsv}
                    onChange={(e) => setSelectedCsv(e.target.value as typeof selectedCsv)}
                    className="bg-gray-800 border border-gray-600 rounded px-4 py-2 text-white"
                >
                    <option value="monster_data">monster_data.csv（モンスター）</option>
                    <option value="stage_data">stage_data.csv（ステージ）</option>
                    {/* <option value="evolution_data">evolution_data.csv（進化・廃止予定）</option> */}
                    <option value="kanji_master">kanji_master.csv（漢字）</option>
                    <option value="exp_table">exp_table.csv（経験値）</option>
                </select>

                {/* Status Badge */}
                {hasOverrideData && (
                    <span className="px-2 py-1 bg-yellow-600 rounded text-xs font-bold text-white">
                        オーバーライド中
                    </span>
                )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 flex-wrap">
                <button
                    onClick={handleApplyToGame}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded text-white font-bold"
                >
                    🎮 ゲームに適用
                </button>
                {hasOverrideData && (
                    <button
                        onClick={handleResetToDefault}
                        className="px-4 py-2 bg-orange-600 hover:bg-orange-500 rounded text-white font-bold"
                    >
                        🔄 デフォルトに戻す
                    </button>
                )}
                <button
                    onClick={handleDownload}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-white font-bold"
                >
                    📤 エクスポート
                </button>
                <label className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded text-white font-bold cursor-pointer">
                    📥 インポート
                    <input type="file" accept=".csv" onChange={handleImportCsv} className="hidden" />
                </label>
                <button
                    onClick={handleAddRow}
                    className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded text-white font-bold"
                >
                    ➕ 行追加
                </button>
            </div>

            {/* Messages */}
            {applyMessage && (
                <div className="bg-green-900/50 border border-green-500 rounded p-3 text-green-300">
                    {applyMessage}
                </div>
            )}

            {error && (
                <div className="bg-red-900/50 border border-red-500 rounded p-3 text-red-300">
                    ⚠️ {error}
                </div>
            )}

            {/* CSV Table */}
            <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                    <thead>
                        <tr className="bg-gray-800">
                            <th className="border border-gray-600 p-2 text-gray-400">操作</th>
                            {headers.map((header, i) => (
                                <th key={i} className="border border-gray-600 p-2 text-cyan-400">
                                    {header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {csvData.map((row, rowIndex) => (
                            <tr key={rowIndex} className="hover:bg-gray-800/50">
                                <td className="border border-gray-600 p-1 text-center">
                                    <button
                                        onClick={() => handleDeleteRow(rowIndex)}
                                        className="text-red-400 hover:text-red-300"
                                    >
                                        🗑️
                                    </button>
                                </td>
                                {row.map((cell, colIndex) => (
                                    <td key={colIndex} className="border border-gray-600 p-1">
                                        {isIdColumn(headers[colIndex]) || isForeignKeyColumn(headers[colIndex]) ? (
                                            <div className="flex items-center gap-1">
                                                {cell && (
                                                    <img
                                                        src={getAssetPath(`/monsters/${cell}.png`)}
                                                        alt={cell}
                                                        className="w-8 h-8 object-contain"
                                                        onError={(e) => (e.currentTarget.style.display = 'none')}
                                                    />
                                                )}
                                                <select
                                                    value={cell}
                                                    onChange={(e) => handleCellChange(rowIndex, colIndex, e.target.value)}
                                                    className="flex-1 bg-gray-700 text-white border-none p-1 rounded text-xs"
                                                >
                                                    <option value="">（空）</option>
                                                    {monsterImages.map(img => (
                                                        <option key={img} value={img}>{img}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        ) : isElementColumn(headers[colIndex]) ? (
                                            <div className="flex items-center gap-1">
                                                <span className="text-lg">{ELEMENT_ICONS[cell] || '❓'}</span>
                                                <select
                                                    value={cell}
                                                    onChange={(e) => handleCellChange(rowIndex, colIndex, e.target.value)}
                                                    className="flex-1 bg-gray-700 text-white border-none p-1 rounded text-xs"
                                                >
                                                    {ELEMENT_TYPES.map(type => (
                                                        <option key={type} value={type}>{ELEMENT_ICONS[type]} {type}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        ) : (
                                            <input
                                                type="text"
                                                value={cell}
                                                onChange={(e) => handleCellChange(rowIndex, colIndex, e.target.value)}
                                                className="w-full bg-gray-700 text-white border-none p-1 rounded text-xs"
                                            />
                                        )}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="text-gray-500 text-xs space-y-1">
                <div>💡 「ゲームに適用」ボタンでLocalStorageに保存され、次回の画面遷移からゲームに反映されます。</div>
                <div>⚠️ デバッグデータはブラウザのキャッシュクリアで削除されます。恒久的な変更はCSVをダウンロードしてソースファイルを置き換えてください。</div>
            </div>
        </div>
    );
};

export default DebugMode;
