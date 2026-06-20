const fs = require('fs');
const path = require('path');

const MONSTER_DATA_PATH = path.join(__dirname, '../src/data/monster_data.csv');
const MONSTER_DIR = path.join(__dirname, '../public/monsters');

// Placeholder map
const PLACEHOLDERS = {
    FIRE: 'starter_fire.png',
    WATER: 'starter_water.png',
    NATURE: 'starter_nature.png',
    LIGHT: 'starter_light.png',
    DARK: 'starter_dark.png',
    BOSS: 'starter_fire.png', // Fallback
    NONE: 'starter_fire.png'
};

try {
    const content = fs.readFileSync(MONSTER_DATA_PATH, 'utf8');
    const lines = content.trim().split('\n');
    const headers = lines[0].split(',');

    // Parse simplified
    const data = lines.slice(1).map(line => {
        const vals = line.split(',');
        return {
            id: vals[0],
            element: vals[2]
        };
    });

    data.forEach(monster => {
        // Only process if ID looks like our generated ones (contains underscore and numbers or just check if file exists)
        // Actually, just check if file exists.
        const targetPath = path.join(MONSTER_DIR, `${monster.id}.png`);

        if (!fs.existsSync(targetPath)) {
            const sourceImage = PLACEHOLDERS[monster.element] || PLACEHOLDERS.FIRE;
            const sourcePath = path.join(MONSTER_DIR, sourceImage);

            if (fs.existsSync(sourcePath)) {
                fs.copyFileSync(sourcePath, targetPath);
                console.log(`Copied placeholder for ${monster.id} (${monster.element})`);
            } else {
                console.warn(`Source image not found: ${sourceImage}`);
            }
        }
    });

    console.log('Placeholder generation complete.');

} catch (err) {
    console.error('Error:', err);
}
