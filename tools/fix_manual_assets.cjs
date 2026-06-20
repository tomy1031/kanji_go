const fs = require('fs');
const path = require('path');

const MONSTER_DIR = path.join(__dirname, '../public/monsters');

const TASKS = [
    { target: 'light_rabbit.png', source: 'golden_unicorn.png' }, // Light-ish
    { target: 'night_cat.png', source: 'purple_dragon.png' }, // Dark-ish
];
⁄
try {
    TASKS.forEach(task => {
        const targetPath = path.join(MONSTER_DIR, task.target);
        const sourcePath = path.join(MONSTER_DIR, task.source);

        if (!fs.existsSync(targetPath)) {
            if (fs.existsSync(sourcePath)) {
                fs.copyFileSync(sourcePath, targetPath);
                console.log(`Created placeholder: ${task.target} (from ${task.source})`);
            } else {
                console.warn(`Source not found: ${task.source}`);
            }
        } else {
            console.log(`Target already exists: ${task.target}`);
        }
    });

} catch (err) {
    console.error(err);
}
