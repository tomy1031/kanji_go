const fs = require('fs');
const path = require('path');

const MONSTER_DATA_PATH = path.join(__dirname, '../src/data/monster_data.csv');
const MONSTER_DIR = path.join(__dirname, '../public/monsters');

// Better Placeholders for missing assets
const FALLBACKS = {
    LIGHT: 'golden_unicorn.png',
    DARK: 'purple_dragon.png'
};

try {
    const content = fs.readFileSync(MONSTER_DATA_PATH, 'utf8');
    const lines = content.trim().split('\n');

    const data = lines.slice(1).map(line => {
        const vals = line.split(',');
        return {
            id: vals[0],
            element: vals[2]
        };
    });

    data.forEach(monster => {
        const targetPath = path.join(MONSTER_DIR, `${monster.id}.png`);

        // If file doesn't exist, try to copy from fallback
        if (!fs.existsSync(targetPath)) {
            let sourceImage = null;
            if (monster.element === 'LIGHT') sourceImage = FALLBACKS.LIGHT;
            if (monster.element === 'DARK') sourceImage = FALLBACKS.DARK;

            if (sourceImage) {
                const sourcePath = path.join(MONSTER_DIR, sourceImage);
                if (fs.existsSync(sourcePath)) {
                    fs.copyFileSync(sourcePath, targetPath);
                    console.log(`Fixed placeholder for ${monster.id} (${monster.element}) using ${sourceImage}`);
                } else {
                    console.warn(`Fallback image not found: ${sourceImage}`);
                }
            }
        }
    });

    console.log('Fix script complete.');

} catch (err) {
    console.error('Error:', err);
}
