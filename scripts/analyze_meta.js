import fs from 'fs';
import path from 'path';

const STAGE_CSV = `src/data/stage_data.csv`;
const ENEMY_CSV = `src/data/enemy_data.csv`;
const OUTPUT_FILE = `docs/META_MONSTER_NEEDS.md`;

const main = () => {
    const stageRaw = fs.readFileSync(STAGE_CSV, 'utf-8');
    const enemyRaw = fs.readFileSync(ENEMY_CSV, 'utf-8');

    const enemyMap = {};
    enemyRaw.trim().split('\n').slice(1).forEach(line => {
        const parts = line.split(',');
        enemyMap[parts[0]] = {
            id: parts[0],
            name: parts[1],
            element: parts[2],
            weakness: parts[3]
        };
    });

    const stages = stageRaw.trim().split('\n').slice(1).map(line => {
        const parts = line.split(',');
        return {
            level: parts[0],
            world: parts[1],
            order: parts[2],
            enemyId: parts[4]
        };
    });

    let md = `# Meta Monster Needs Analysis

This document lists the required "Meta Monsters" for each stage.
A Meta Monster is designed to be the perfect counter to the stage enemy:
1. **Attack Element**: Matches the Enemy's Weakness (2.0x Damage).
2. **Weakness**: Resists the Enemy's Attack (0.5x Damage), or at least is not weak to it.

For **Fire/Water/Nature** cycle: The element that hits for weakness automatically resists the enemy.
For **Light/Dark**: We assign a custom weakness (e.g., Fire/Water/Nature) to avoid mutual destruction.

| Stage | Enemy (ID) | Enemy Element | Enemy Weakness | Needed Meta Element | Needed Meta Weakness | Meta ID | Image Filename |
|---|---|---|---|---|---|---|---|
`;

    stages.forEach(stage => {
        const enemy = enemyMap[stage.enemyId];
        if (!enemy) return;

        const stageId = `${stage.level}-${stage.world}-${stage.order}`;
        const metaId = `meta_${stage.level.toLowerCase()}_${stage.world}_${stage.order}`;

        // Determine Meta Element (Counter Attack)
        const metaElement = enemy.weakness;

        // Determine Meta Weakness (Counter Defense)
        let metaWeakness;

        // Standard Cycle
        if (enemy.element === 'FIRE') metaWeakness = 'NATURE'; // I am Water, weak to Nature
        else if (enemy.element === 'WATER') metaWeakness = 'FIRE'; // I am Nature, weak to Fire
        else if (enemy.element === 'NATURE') metaWeakness = 'WATER'; // I am Fire, weak to Water

        // Special Case: Light/Dark
        // If Enemy is LIGHT (Weak: DARK). Meta is DARK.
        // DARK is normally weak to LIGHT. We want to avoid that.
        // Assign a random safe weakness.
        else if (enemy.element === 'LIGHT') metaWeakness = 'WATER'; // Arbitrary safe weakness
        else if (enemy.element === 'DARK') metaWeakness = 'fire'; // Arbitrary safe weakness (Note: Element types usually CAPS)

        // Fix caps
        if (metaWeakness === 'fire') metaWeakness = 'FIRE';

        const imageFilename = `${metaId}.png`;

        md += `| ${stageId} | ${enemy.name} (${enemy.id}) | ${enemy.element} | ${enemy.weakness} | **${metaElement}** | ${metaWeakness} | \`${metaId}\` | \`${imageFilename}\` |\n`;
    });

    fs.writeFileSync(OUTPUT_FILE, md);
    console.log(`Generated ${OUTPUT_FILE}`);
};

main();
