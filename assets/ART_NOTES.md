# Current scenery — 2026-10-15

The shipped background is now a code-drawn Canvas illustration in
`game.js`: cached sunset, rounded layered cloud banks, and translucent
moving mist. Terrain shares its warm peach highlights and violet shadows.
This replaces the image below to match the chunky cartoon tanks. No image
is loaded at runtime. Gameplay, collision terrain and tank art are unchanged.

## Archived painted sunset asset

The following documents the earlier, unused artwork retained in this folder.
The runtime and fallback descriptions below refer to that earlier release.

# Painted sunset scenery — 2026-10-15

- Runtime asset: `game/assets/scorched-sunset-v1.webp` (1672×941, 108,244 bytes).
- Created with the built-in image-generation tool; PNG converted to WebP for delivery. No external runtime service or asset host.
- Intended as distant scenery only. The foreground terrain mask, physics, controls, damage, AI, camera, tank renderer and all gameplay tuning remain unchanged.
- Fine soil texture, terrain lighting/shadows, and drifting translucent mist are cached Canvas layers. Scenery consumes no gameplay RNG. The previous procedural sky remains the synchronous loading/error fallback.
- Run by opening `game/index.html` with `game.js` and `assets/` beside it, or visit the published Pages game.

## Generation prompt

Use case: stylized-concept. Asset type: production background plate for a bright, polished 2D cartoon artillery browser game named Scorched Sky. Create an absolutely beautiful hand-painted cinematic fantasy SUNSET SKY above an endless sea of clouds. Wide 16:9 panoramic landscape, intended 2048x1152. No text, no interface, no weapons, no tanks, no people, no buildings, no land, no islands, no mountains. The ONLY objects are sky, sunlight, atmospheric clouds. Composition: top 70 percent mainly spacious open sky, luminous apricot and golden peach near the horizon, soft rose and muted lavender blue at the very top. Delicate sweeping feathery cirrus along the outer upper corners only. A warm sun at approximately 74 percent across and 26 percent down, softened by luminous atmospheric haze with subtle elegant rays. Most high-detail billowing CLOUD BANKS live in the BOTTOM 22 percent of the image: exquisite sculptural rounded cloud forms, warm ivory and gold-lit edges, peach interiors, smoky violet/lilac shadows, receding layers conveying huge depth and altitude. Bottom clouds should feel like a magnificent ocean far below a floating battlefield. Keep the entire broad central area x10–90%, y20–78% softly graduated and low contrast, ready for a foreground island and highly readable small projectile arcs. Top-left and top-right 15 percent should be quiet light pastel sky for dark HUD typography. Style: premium animated-film environment concept painting, carefully composed, rich nuanced color, tactile painterly cloud edges, clear clean silhouettes, magical golden-hour glow, sophisticated lighting and depth. Not photorealistic, not flat vector art, not pixel art, not a generic gradient; lavishly beautiful while restrained where gameplay happens. Full bleed, no border, no lettering, no watermark.
