# Field Command scene art — 2026-10-17

Created with the built-in image-generation tool. Runtime assets:
- `game/assets/tactics-ground-v2.webp`: flat traversable ground, 648×864.
- `game/assets/tactics-cover-v2.webp`: transparent overhead cover atlas, 512×768, six equal 256×256 cells; resized for runtime after visual inspection.
- Existing `game/assets/tactics-units-v1.webp`: retained realistic tank and infantry sprites; cached brightness adjustment and team rings improve small-screen visibility.

Ground and props use dry olive grass, weathered materials and warm natural lighting. Every cover object stays on its existing collision tile. Ruins, craters and wrecks use the same palette. No decorative blocking objects are baked into the traversable ground. Original procedural art remains the asset-loading/error fallback. Unit art, atlas layout and original prompt are documented in TACTICS_ART_NOTES.md.

## Ground generation prompt
Use case: stylized-concept. Asset type: production terrain texture for a realistic overhead military tactics game, portrait 3:4. Create ONLY a continuous flat ground surface viewed exactly vertically from above, orthographic, no horizon. Natural dry olive meadow with muted sage grass, exposed dusty umber soil, scattered tiny gravel, subtle flattened grass and fine tire impressions. A narrow worn dirt track snakes vertically down the central 10 percent of image, from center top to center bottom. Rich believable microtexture, softly irregular ground color, cinematic late-afternoon warm light from upper left, restrained contrast for tiny military units to remain visible. Match realistic weathered olive military equipment. NO objects, buildings, trees, rocks larger than gravel, craters, soldiers, vehicles, water, text, grid, interface, borders or dramatic elevation. Entire image traversable flat ground. Crisp material detail, no blur, no illustration outlines.

## Cover generation prompt
Use case: stylized-concept. Asset type: realistic overhead terrain prop sprite atlas for a military tactics game. True vertical orthographic view, matching detailed weathered olive tank and infantry assets, warm sunlight from upper left, subtle short shadow toward lower right. Transparent background. Exactly SIX isolated objects in a regular 2-column by 3-row grid, each fully inside own cell with generous transparent margins, no overlap. Top left: one small abandoned rectangular farm shed with weathered rust and gray corrugated pitched roof, roof seen directly above, tiny chimney. Top right: compact cluster of realistic rough gray limestone boulders. Middle left: one dense rounded olive-green deciduous tree canopy with detailed sunlit leaves and darker interior. Middle right: short horizontal staggered double row of dusty khaki sandbags, no soldiers. Bottom left: compact scattered pile of collapsed masonry, broken roof timber and rubble. Bottom right: one shallow blast crater with dark soil center and irregular earthy raised rim, true overhead. High-quality grounded realistic game textures, coherent scale, no cartoon outlines, no isometric perspective, no text, no labels, no grid lines, no extra props or people. All backgrounds genuinely transparent.

## Cover spacing revision prompt

