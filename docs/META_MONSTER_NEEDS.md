# Meta Monster Needs Analysis

This document lists the required "Meta Monsters" for each stage.
A Meta Monster is designed to be the perfect counter to the stage enemy:
1. **Attack Element**: Matches the Enemy's Weakness (2.0x Damage).
2. **Weakness**: Resists the Enemy's Attack (0.5x Damage), or at least is not weak to it.

For **Fire/Water/Nature** cycle: The element that hits for weakness automatically resists the enemy.
For **Light/Dark**: We assign a custom weakness (e.g., Fire/Water/Nature) to avoid mutual destruction.

| Stage | Enemy (ID) | Enemy Element | Enemy Weakness | Needed Meta Element | Needed Meta Weakness | Meta ID | Image Filename |
|---|---|---|---|---|---|---|---|
| N5-1-1 | ファイヤースライム (slime_fire) | FIRE | WATER | **WATER** | NATURE | `meta_n5_1_1` | `meta_n5_1_1.png` |
| N5-1-2 | アクアスライム (slime_water) | WATER | NATURE | **NATURE** | FIRE | `meta_n5_1_2` | `meta_n5_1_2.png` |
| N5-1-3 | モススライム (slime_nature) | NATURE | FIRE | **FIRE** | WATER | `meta_n5_1_3` | `meta_n5_1_3.png` |
| N5-1-4 | トレント (boss_nature) | NATURE | FIRE | **FIRE** | WATER | `meta_n5_1_4` | `meta_n5_1_4.png` |
| N5-2-1 | ミツバチ (yellow_honey_bee_a) | NATURE | FIRE | **FIRE** | WATER | `meta_n5_2_1` | `meta_n5_2_1.png` |
| N5-2-2 | ハニービー (yellow_honey_bee_b) | NATURE | FIRE | **FIRE** | WATER | `meta_n5_2_2` | `meta_n5_2_2.png` |
| N5-2-3 | 丸フクロウ (cute_round_owl) | NATURE | FIRE | **FIRE** | WATER | `meta_n5_2_3` | `meta_n5_2_3.png` |
| N5-2-4 | トレント (boss_nature) | NATURE | FIRE | **FIRE** | WATER | `meta_n5_2_4` | `meta_n5_2_4.png` |
| N5-3-1 | 森フクロウ (brown_forest_owl_a) | NATURE | FIRE | **FIRE** | WATER | `meta_n5_3_1` | `meta_n5_3_1.png` |
| N5-3-2 | フクロウ (brown_forest_owl_b) | NATURE | FIRE | **FIRE** | WATER | `meta_n5_3_2` | `meta_n5_3_2.png` |
| N5-3-3 | しずくゴースト (blue_droplet_ghost) | WATER | NATURE | **NATURE** | FIRE | `meta_n5_3_3` | `meta_n5_3_3.png` |
| N5-3-4 | トレント (boss_nature) | NATURE | FIRE | **FIRE** | WATER | `meta_n5_3_4` | `meta_n5_3_4.png` |
| N5-4-1 | ゴースト (blue_friendly_ghost_a) | DARK | LIGHT | **LIGHT** | FIRE | `meta_n5_4_1` | `meta_n5_4_1.png` |
| N5-4-2 | ファイヤースライム (slime_fire) | FIRE | WATER | **WATER** | NATURE | `meta_n5_4_2` | `meta_n5_4_2.png` |
| N5-4-3 | アクアスライム (slime_water) | WATER | NATURE | **NATURE** | FIRE | `meta_n5_4_3` | `meta_n5_4_3.png` |
| N5-4-4 | トレント (boss_nature) | NATURE | FIRE | **FIRE** | WATER | `meta_n5_4_4` | `meta_n5_4_4.png` |
| N5-5-1 | モススライム (slime_nature) | NATURE | FIRE | **FIRE** | WATER | `meta_n5_5_1` | `meta_n5_5_1.png` |
| N5-5-2 | つるモンスター (green_flower_vine_monster_a) | NATURE | FIRE | **FIRE** | WATER | `meta_n5_5_2` | `meta_n5_5_2.png` |
| N5-5-3 | 蔦モンスター (green_flower_vine_monster_b) | NATURE | FIRE | **FIRE** | WATER | `meta_n5_5_3` | `meta_n5_5_3.png` |
| N5-5-4 | トレント (boss_nature) | NATURE | FIRE | **FIRE** | WATER | `meta_n5_5_4` | `meta_n5_5_4.png` |
| N4-1-1 | フレイムウルフ (wolf_fire) | FIRE | WATER | **WATER** | NATURE | `meta_n4_1_1` | `meta_n4_1_1.png` |
| N4-1-2 | タイドウルフ (wolf_water) | WATER | NATURE | **NATURE** | FIRE | `meta_n4_1_2` | `meta_n4_1_2.png` |
| N4-1-3 | フォレストウルフ (wolf_nature) | NATURE | FIRE | **FIRE** | WATER | `meta_n4_1_3` | `meta_n4_1_3.png` |
| N4-1-4 | イフリート (boss_fire) | FIRE | WATER | **WATER** | NATURE | `meta_n4_1_4` | `meta_n4_1_4.png` |
| N4-2-1 | グリズリーベア (brown_bear) | NATURE | FIRE | **FIRE** | WATER | `meta_n4_2_1` | `meta_n4_2_1.png` |
| N4-2-2 | フォレストビースト (green_furry_forest_beast) | NATURE | FIRE | **FIRE** | WATER | `meta_n4_2_2` | `meta_n4_2_2.png` |
| N4-2-3 | ワーウルフ (brown_werewolf) | NATURE | FIRE | **FIRE** | WATER | `meta_n4_2_3` | `meta_n4_2_3.png` |
| N4-2-4 | イフリート (boss_fire) | FIRE | WATER | **WATER** | NATURE | `meta_n4_2_4` | `meta_n4_2_4.png` |
| N4-3-1 | ストーンゴーレム (gray_stone_golem) | NATURE | FIRE | **FIRE** | WATER | `meta_n4_3_1` | `meta_n4_3_1.png` |
| N4-3-2 | アーマーゴーレム (turquoise_armor_golem) | LIGHT | DARK | **DARK** | WATER | `meta_n4_3_2` | `meta_n4_3_2.png` |
| N4-3-3 | ギアゴーレム (golden_gear_golem) | LIGHT | DARK | **DARK** | WATER | `meta_n4_3_3` | `meta_n4_3_3.png` |
| N4-3-4 | イフリート (boss_fire) | FIRE | WATER | **WATER** | NATURE | `meta_n4_3_4` | `meta_n4_3_4.png` |
| N4-4-1 | ユニコーン (golden_unicorn) | LIGHT | DARK | **DARK** | WATER | `meta_n4_4_1` | `meta_n4_4_1.png` |
| N4-4-2 | フレイムウルフ (wolf_fire) | FIRE | WATER | **WATER** | NATURE | `meta_n4_4_2` | `meta_n4_4_2.png` |
| N4-4-3 | タイドウルフ (wolf_water) | WATER | NATURE | **NATURE** | FIRE | `meta_n4_4_3` | `meta_n4_4_3.png` |
| N4-4-4 | イフリート (boss_fire) | FIRE | WATER | **WATER** | NATURE | `meta_n4_4_4` | `meta_n4_4_4.png` |
| N4-5-1 | フォレストウルフ (wolf_nature) | NATURE | FIRE | **FIRE** | WATER | `meta_n4_5_1` | `meta_n4_5_1.png` |
| N4-5-2 | バインモンスター (green_flower_vine_monster_d) | NATURE | FIRE | **FIRE** | WATER | `meta_n4_5_2` | `meta_n4_5_2.png` |
| N4-5-3 | おばけ (blue_friendly_ghost_b) | DARK | LIGHT | **LIGHT** | FIRE | `meta_n4_5_3` | `meta_n4_5_3.png` |
| N4-5-4 | イフリート (boss_fire) | FIRE | WATER | **WATER** | NATURE | `meta_n4_5_4` | `meta_n4_5_4.png` |
| N3-1-1 | インフェルノドラゴン (red_fire_dragon) | FIRE | WATER | **WATER** | NATURE | `meta_n3_1_1` | `meta_n3_1_1.png` |
| N3-1-2 | 双頭炎ドラゴン (red_two_headed_dragon) | FIRE | WATER | **WATER** | NATURE | `meta_n3_1_2` | `meta_n3_1_2.png` |
| N3-1-3 | 翼竜 (red_winged_dragon) | FIRE | WATER | **WATER** | NATURE | `meta_n3_1_3` | `meta_n3_1_3.png` |
| N3-1-4 | エルダードラゴン (dragon_fire) | FIRE | WATER | **WATER** | NATURE | `meta_n3_1_4` | `meta_n3_1_4.png` |
| N3-2-1 | シードラゴン (blue_sea_dragon) | WATER | NATURE | **NATURE** | FIRE | `meta_n3_2_1` | `meta_n3_2_1.png` |
| N3-2-2 | スカイドラゴン (blue_sky_dragon) | NATURE | FIRE | **FIRE** | WATER | `meta_n3_2_2` | `meta_n3_2_2.png` |
| N3-2-3 | 双頭アクアドラゴン (blue_two_headed_dragon) | WATER | NATURE | **NATURE** | FIRE | `meta_n3_2_3` | `meta_n3_2_3.png` |
| N3-2-4 | エルダードラゴン (dragon_fire) | FIRE | WATER | **WATER** | NATURE | `meta_n3_2_4` | `meta_n3_2_4.png` |
| N3-3-1 | 勇者ドラゴン (blue_valiant_dragon) | WATER | NATURE | **NATURE** | FIRE | `meta_n3_3_1` | `meta_n3_3_1.png` |
| N3-3-2 | ヴォイドドラゴン (purple_dragon) | DARK | LIGHT | **LIGHT** | FIRE | `meta_n3_3_2` | `meta_n3_3_2.png` |
| N3-3-3 | ヒュドラドラゴン (purple_five_headed_dragon) | DARK | LIGHT | **LIGHT** | FIRE | `meta_n3_3_3` | `meta_n3_3_3.png` |
| N3-3-4 | エルダードラゴン (dragon_fire) | FIRE | WATER | **WATER** | NATURE | `meta_n3_3_4` | `meta_n3_3_4.png` |
| N3-4-1 | インフェルノドラゴン (red_fire_dragon) | FIRE | WATER | **WATER** | NATURE | `meta_n3_4_1` | `meta_n3_4_1.png` |
| N3-4-2 | シードラゴン (blue_sea_dragon) | WATER | NATURE | **NATURE** | FIRE | `meta_n3_4_2` | `meta_n3_4_2.png` |
| N3-4-3 | ヴォイドドラゴン (purple_dragon) | DARK | LIGHT | **LIGHT** | FIRE | `meta_n3_4_3` | `meta_n3_4_3.png` |
| N3-4-4 | エルダードラゴン (dragon_fire) | FIRE | WATER | **WATER** | NATURE | `meta_n3_4_4` | `meta_n3_4_4.png` |
| N3-5-1 | 氷雪イエティ (blue_ice_yeti) | WATER | NATURE | **NATURE** | FIRE | `meta_n3_5_1` | `meta_n3_5_1.png` |
| N3-5-2 | ワーウルフ (brown_werewolf) | NATURE | FIRE | **FIRE** | WATER | `meta_n3_5_2` | `meta_n3_5_2.png` |
| N3-5-3 | ギアゴーレム (golden_gear_golem) | LIGHT | DARK | **DARK** | WATER | `meta_n3_5_3` | `meta_n3_5_3.png` |
| N3-5-4 | エルダードラゴン (dragon_fire) | FIRE | WATER | **WATER** | NATURE | `meta_n3_5_4` | `meta_n3_5_4.png` |
