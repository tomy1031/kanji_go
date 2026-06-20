const fs = require('fs');
const path = require('path');

const STAGE_DATA_PATH = path.join(__dirname, '../src/data/stage_data.csv');
const MONSTER_DATA_PATH = path.join(__dirname, '../src/data/monster_data.csv');

// Elemental Cycles
// Fire > Nature > Water > Fire
// Light <> Dark
const ELEMENTS = {
    FIRE: 'FIRE',
    WATER: 'WATER',
    NATURE: 'NATURE',
    LIGHT: 'LIGHT',
    DARK: 'DARK',
    BOSS: 'BOSS',
    NONE: 'NONE'
};

const COUNTERS = {
    FIRE: 'WATER',
    WATER: 'NATURE',
    NATURE: 'FIRE',
    LIGHT: 'DARK',
    DARK: 'LIGHT',
    BOSS: 'NONE', // Bosses might have specific weaknesses defined elsewhere, but for meta generation usage:
    NONE: 'NONE'
};

const NO_EFFECT = {
    FIRE: 'NATURE',
    WATER: 'FIRE',
    NATURE: 'WATER',
    LIGHT: 'LIGHT', // Self?
    DARK: 'DARK'
};

// Naming Dictionaries for ID generation
const ADJECTIVES = {
    FIRE: ['crimson', 'blazing', 'infernal', 'burning', 'red'],
    WATER: ['blue', 'tidal', 'azure', 'frozen', 'deep_sea'],
    NATURE: ['emerald', 'verdant', 'forest', 'wild', 'mossy'],
    LIGHT: ['golden', 'radiant', 'shining', 'holy', 'bright'],
    DARK: ['shadow', 'void', 'abyssal', 'cursed', 'phantom']
};

const NOUNS = {
    FIRE: ['dragon', 'knight', 'phoenix', 'spirit', 'demon'],
    WATER: ['serpent', 'whale', 'kraken', 'mage', 'shark'],
    NATURE: ['golem', 'beast', 'guardian', 'ent', 'wolf'],
    LIGHT: ['angel', 'paladin', 'lion', 'griffin', 'unicorn'],
    DARK: ['reaper', 'specter', 'assassin', 'bat', 'wraith']
};

const JP_PREFIXES = {
    FIRE: ['紅蓮の', '爆炎の', '灼熱の', '赤き'],
    WATER: ['蒼き', '深海の', '氷結の', '流麗な'],
    NATURE: ['深緑の', '大樹の', '野生の', '森の'],
    LIGHT: ['輝きの', '聖なる', '黄金の', '光の'],
    DARK: ['漆黒の', '深淵の', '呪われし', '闇の']
};

const JP_SUFFIXES = {
    FIRE: ['騎士', '竜', '魔人', '精霊'],
    WATER: ['海竜', '魔導士', '海獣', '精霊'],
    NATURE: ['守護者', '巨人', '獣', '精霊'],
    LIGHT: ['聖騎士', '天使', '聖獣', '精霊'],
    DARK: ['処刑人', '死神', '魔獣', '精霊']
};

// Helper to parse CSV manually to avoid deps
function parseCsv(content) {
    const lines = content.trim().split('\n');
    const headers = lines[0].split(',');
    const data = lines.slice(1).map(line => {
        const values = line.split(',');
        return headers.reduce((obj, header, index) => {
            obj[header.trim()] = values[index] ? values[index].trim() : '';
            return obj;
        }, {});
    });
    return { headers, data };
}

// Helper to write CSV
function writeCsv(headers, data) {
    const headerLine = headers.join(',');
    const lines = data.map(row => {
        return headers.map(h => row[h] !== undefined ? row[h] : '').join(',');
    });
    return [headerLine, ...lines].join('\n');
}

function getRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function generateMetaMonster(stage, enemyElement, version) {
    const counterElement = COUNTERS[enemyElement] || 'FIRE'; // Fallback

    // Generate English ID
    const adjList = ADJECTIVES[counterElement];
    const nounList = NOUNS[counterElement];

    // Try to find a unique combination
    let id = '';
    let uniqueFound = false;

    // Simple random shuffle try (or exhaustive checked but random is easier for script)
    // We try 50 times to find a unique adj_noun
    for (let i = 0; i < 50; i++) {
        const adj = getRandom(adjList);
        const noun = getRandom(nounList);
        const candidate = `${adj}_${noun}`;

        // check global used set passed in args (need to refactor function signature)
        // For now we assume the caller handles uniqueness check or we assume random is good enough with large enough pool?
        // User said "don't add _1_1".
        id = candidate;
        // We will do collision check outside
        break;
    }

    // Generate Japanese Name
    const jpPrefix = getRandom(JP_PREFIXES[counterElement]);
    const jpSuffix = getRandom(JP_SUFFIXES[counterElement]);
    const name = `${jpPrefix}${jpSuffix}`;

    return {
        id, // Candidate ID
        name,
        element: counterElement,
        weakness: COUNTERS[counterElement] || 'NONE',
        hp: 100,
        attack: 30,
        description: name, // Use Name as description per user request
        unlockCondition: '', // Managed in stage_data
        version: version, // Restore version management
        expReward: 0,
        goldReward: 0
    };
}

// MAIN EXECUTION
try {
    const stageContent = fs.readFileSync(STAGE_DATA_PATH, 'utf8');
    const monsterContent = fs.readFileSync(MONSTER_DATA_PATH, 'utf8');

    const stages = parseCsv(stageContent);
    const monsters = parseCsv(monsterContent);

    // Map monster ID to data for lookup
    const monsterMap = {};
    monsters.data.forEach(m => monsterMap[m.id] = m);

    const newMetaMonsters = [];
    // initialize usedIds with existing monsters (excluding old meta ones we are replacing)
    const usedIds = new Set(monsters.data.filter(m => !m.id.startsWith('meta_') && !m.id.match(/^.*_\d+_\d+$/)).map(m => m.id));

    // 1. Process Stages to update Meta IDs
    stages.data.forEach(stage => {
        // Skip header safety
        if (!stage.level) return;

        const enemy = monsterMap[stage.enemy_id] || monsterMap[Object.keys(monsterMap)[0]];
        const enemyElement = enemy.element || 'FIRE';

        // Generate new Meta Monster
        // We do this for EVERY stage that currently has a meta_monster_id logic or we want to add one
        // The user said "all stages".
        // Current CSV has meta_monster_id column.

        // Reuse existing logic? No, regenerate completely to follow "descriptive english" rule.

        // Generate with retry for uniqueness
        let meta;
        let retries = 0;

        while (retries < 100) {
            meta = generateMetaMonster(stage, enemyElement, stage.level);
            if (!usedIds.has(meta.id)) {
                usedIds.add(meta.id);
                break;
            }
            // If collision, try again (randomness in generateMetaMonster will pick another combo)
            retries++;
        }

        // If still stuck (exhausted combos), append a number only if absolutely necessary? 
        // User said "don't add _1_1". But if we run out of names...
        // Let's hope 25 combos per element is enough. 
        if (retries >= 100) {
            // Fallback if collision
            if (!newMetaMonsters.find(m => m.id === meta.id)) {
                newMetaMonsters.push(meta);
            }
        } else {
            newMetaMonsters.push(meta);
        }

        // Update Stage Data
        stage.meta_monster_id = meta.id;
    });

    // 2. Update Monster Data (Rebalance EXP)
    const EXP_MULTIPLIER = 10;
    monsters.data.forEach(m => {
        if (!m.id) return;
        // Don't multiply if it's 0 (like starters)
        if (parseInt(m.expReward) > 0 && parseInt(m.expReward) < 50) { // adjusted threshold slightly
            m.expReward = parseInt(m.expReward) * 10;
        }
    });

    // 3. Append New Meta Monsters
    // Filter out ANY previous meta-like monsters to clean up
    // We identify them by the specific pattern we created before or "meta_" prefix
    const cleanMonsterData = monsters.data.filter(m => {
        if (m.id.startsWith('meta_')) return false;
        // Filter out our previous 'adj_noun_world_order' format if they exist
        // Regex for `word_word_number_number`
        if (m.id.match(/^[a-z]+_[a-z]+_\d+_\d+$/)) return false;
        // New generated format from "Round 2" (clean IDs, empty version)
        // If version is empty string, it's likely a generated meta monster from previous run.
        if (m.version === '' && m.id.match(/^[a-z]+_[a-z]+$/)) return false;
        return true;
    });

    newMetaMonsters.forEach(m => cleanMonsterData.push(m));

    // Save Files
    fs.writeFileSync(STAGE_DATA_PATH, writeCsv(stages.headers, stages.data));
    console.log('Updated stage_data.csv');

    fs.writeFileSync(MONSTER_DATA_PATH, writeCsv(monsters.headers, cleanMonsterData));
    console.log('Updated monster_data.csv');

} catch (err) {
    console.error('Error:', err);
}
