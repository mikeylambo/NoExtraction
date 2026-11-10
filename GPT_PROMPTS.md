# GPT prompts — NO EXTRACTION

Copy-paste prompts for image generation. They already contain the art direction from `ASSET_SPEC.md`,
so you don't have to explain anything. Use one chat per batch, and paste the **primer** first.

Output rules for every image: landscape 16:9 for target frames, square 1:1 for everything else,
highest quality setting. Save as `<id>.png` with the ids used below.

---

## 0. Primer (paste once at the start of each chat)

> You are making production art for an original third-person stealth-action game set on a polar
> ice-shelf research colony at night. Late-PS3 / early-PS4 era realism: grounded, military-industrial,
> believable wear, nothing stylised or cartoonish. Lighting is moonlight, aurora, warm tungsten lamps
> and cold-white floodlights. Two factions: **Sable** (occupying military: gunmetal and slate paint over
> steel, chipped edges, frost in seams, hard angles, bolted plates, visor slits; their only bright colour
> is a red visor or sensor glow) and **Halcyon** (the engineering crew: clean off-white composites,
> grey panels, cyan information lights). Amber lights belong only to the pilot Ava's ship, violet-white
> light only to the failing planetary core. Every design must be original: no existing game, film or
> real-world military insignia, logos, characters or gear. No text anywhere unless I ask for it.
> Confirm with "Ready" and wait for my requests.

---

## 1. Chapter target frames (do these first)

One image per chapter. These are the targets I grade the game against, so composition matters more
than detail. Save as `target_ch1.png` … `target_ch6.png`.

**ch1 — The Job (clear night, 72% core stability)**
> Cinematic game screenshot, third-person over-the-shoulder camera 4 m behind a lone operative in a
> sealed off-white Halcyon cold-weather suit with a thin cyan visor, crouched behind a snow-covered
> concrete barrier at night. Ahead, a Sable perimeter compound on a flat ice shelf: corrugated shipping
> containers in olive, teal and rust, a two-storey cast-concrete bunker with lit windows, chain-link
> fence, floodlight towers throwing cold-white cones through light falling snow, warm tungsten lamps
> on posts. One Sable trooper on patrol, red visor slit glowing. Clear sky: stars, a low moon, a soft
> green-violet aurora curtain near the horizon. Long blue moon shadows on wind-rippled snow, height fog
> pooling low. 35 mm lens, filmic contrast, cool shadows, slightly desaturated, subtle film grain.

**ch2 — Left Behind (first quake, sky flicker, 58%)**
> Cinematic game screenshot, wide shot of a military launch pad at night on an ice shelf: a large
> cracked concrete apron with painted landing markings (no text), a raised steel gantry bridge, fuel
> tanks, a Sable motor pool with tracked haulers and snowmobiles under floodlights. In the distance a
> small angular dropship with amber running lights is lifting away without the operative. A fresh
> fissure splits the concrete, snow dust hanging in the air. Sky flickering with an unstable aurora.
> Light snowfall, low fog, cool palette with warm lamp accents. 28 mm lens, filmic, desaturated.

**ch3 — Dead Colony (snowstorm bands, debris streaks, 41%)**
> Cinematic game screenshot, an abandoned research colony street in a heavy snowstorm at night:
> half-buried prefab modules, a collapsed antenna mast across the street, dead streetlamps with one
> still flickering tungsten, drifts piled against walls on the leeward side. Visibility 40 m, thick
> horizontal snow, grey-blue fog swallowing the background. Bright streaks of orbital debris burning
> through the clouds overhead. Operative in off-white suit with cyan visor moving through the drift in
> the foreground. Bleak, cold, quiet. 35 mm lens, filmic, muted.

**ch4 — Under the Ice (darkness, violet core glow, 24%)**
> Cinematic game screenshot, inside an industrial conduit tunnel carved under thick glacial ice: ribbed
> steel tunnel segments, pipe runs, grated catwalk over black water, the ice walls glowing faintly
> violet-white from the failing core deep below. Almost no other light: a single cyan visor light from
> the operative and a red sensor eye of a heavily armoured Sable trooper far down the tunnel. Water
> seeping and starting to flood. Oppressive, very dark, crushed blacks, violet rim light on wet metal.
> 24 mm lens, filmic.

**ch5 — Flamingo (ice shelf breakup, magnetic storm, 11%)**
> Cinematic game screenshot, a 10 m signal-white Halcyon combat mech striding across a breaking ice
> shelf at night, cyan sensor lights, frost on its armour. Huge plates of ice tilting and splitting,
> cryovolcanic plumes venting violet-lit steam on the horizon, a violent magenta-green aurora storm
> overhead. Two gunmetal Sable enemy mechs with red sensor slits approaching through the haze. Scale
> and weight, snow spray from the footfalls. 50 mm lens from low angle, filmic, high contrast.

**ch6 — Ascent (the planet breaks, 2%)**
> Cinematic game screenshot, looking down from high altitude as a small amber-lit dropship and a white
> mech climb toward space: below, an icy planet cracking open along glowing violet-white fault lines,
> continental ice sheets shattering, debris streaks rising, the aurora torn into ribbons. Thin
> atmosphere fading to black with stars above. Awe and loss. 35 mm lens, filmic, deep blacks.

Follow-up prompt if a frame looks too clean or too modern:
> Same shot, but make it look like a real-time game render from around 2010: slightly softer textures,
> visible bloom on lights, darker overall, less fine detail in the distance, no lens dirt.

---

## 2. Characters (turnarounds for Meshy)

Save as `turnaround_<id>.png`. If GPT puts a weapon in the hands, reply "remove the weapon, hands empty".

**sable_trooper**
> Orthographic character turnaround sheet, front, side and back views side by side, same scale,
> neutral A-pose with arms 45° down, plain mid-grey background, flat even studio lighting with no cast
> shadows, full body from head to boots. Original design: a Sable occupation infantry trooper in
> layered cold-weather fatigues in gunmetal and slate grey, a hard helmet with a single horizontal red
> visor slit, a balaclava under the helmet, a chest rig with pouches, knee pads, insulated boots,
> frost in the seams, chipped paint on the hard armour. Realistic proportions, 1.8 m adult, worn and
> used. No text, no logos, no weapons in hands.

**ballast** (the player, seen from behind most of the time)
> Orthographic character turnaround sheet, front, side and back views side by side, same scale,
> neutral A-pose with arms 45° down, plain mid-grey background, flat even studio lighting with no cast
> shadows, full body. Original design: a Halcyon operative in a sealed insulated suit of off-white
> composite panels over a dark grey under-layer, a smooth sealed helmet with a thin horizontal cyan
> visor, a compact back unit with a small cyan status light, a thigh holster, utility belt, gloves.
> The back silhouette must be distinctive and readable from 20 m. Realistic proportions, 1.8 m adult,
> lightly scuffed. No text, no logos, no weapons in hands.

**sable_spotter**
> Same turnaround setup as the Sable trooper (front, side, back, A-pose, mid-grey background, flat
> lighting). Original design: a Sable recon trooper, lighter armour than the infantry trooper, a hood
> over the helmet, a tall folding antenna pack on the back, a monocular sensor with a small red glow
> over the visor slit, a long coat in slate grey. 1.8 m, worn. No text, no logos, no weapons in hands.

**sable_heavy**
> Same turnaround setup (front, side, back, A-pose, mid-grey background, flat lighting). Original
> design: a Sable heavy trooper, 2.05 m tall and broad, a thick armoured front plate and shoulder
> guards bolted over the fatigues, a full helmet with a red visor slit and breathing unit, heavy boots,
> an ammunition pack on the back. Gunmetal paint with heavy chipping and frost. No text, no logos, no
> weapons in hands.

**rifle_sable** (separate prop)
> A single original-design military rifle, side view, centred, plain mid-grey background, flat even
> lighting, no shadow. Compact bullpup-like layout, gunmetal and slate finish with worn edges, a small
> red indicator light on the optic. Realistic, plausible mechanics. No text, no logos.

---

## 3. Mechs and ship

Generate the full design first, then each part on its own for Meshy (ASSET_SPEC §6).

**aegis07 — full design**
> Orthographic turnaround sheet, front, side and back, plain mid-grey background, flat lighting. An
> original 10 m bipedal Halcyon engineering-combat mech: signal-white armour panels over dark grey
> mechanical joints, a low armoured cockpit torso, digitigrade legs, broad feet for ice, cyan sensor
> strip, a shoulder-mounted rack, frost and scuffs on the white paint. Grounded industrial design,
> believable hydraulics. No text, no logos.

**aegis07 — one part** (repeat with each part name: torso, upper arm, forearm, thigh, shin, foot, weapon)
> From the mech design above, show only the **[part]** on its own, three-quarter view, centred, plain
> mid-grey background, flat lighting, no shadow, with the joint socket clearly visible where it
> attaches. Same materials and wear.

**warden_frame**
> Orthographic turnaround sheet, front, side and back, mid-grey background, flat lighting. An original
> 8 m Sable patrol mech: gunmetal and slate armour, angular plated torso, a single red sensor slit,
> reverse-jointed legs, a heavy cannon arm, frost in the plate seams, chipped paint. Brutal, utilitarian.
> No text, no logos.

**sovereign**
> Same setup. An original 14 m Sable command mech, the boss: tall, layered heavy armour, a crown-like
> sensor array with several red slits, four legs, twin heavy weapon arms, banners of frost and ice
> hanging from the plates. Imposing silhouette readable at 100 m. No text, no logos.

**wren_ship**
> Orthographic sheet, top, side, front and back views, mid-grey background, flat lighting. An original
> small two-pilot dropship, 18 m long: angular, worn grey hull with patched panels, two tilting engine
> pods, a cargo bay under the belly sized to carry a 10 m mech, amber running lights. Practical,
> lived-in, not sleek. No text, no logos.

---

## 4. Environment kit (props for Meshy)

Template, then the list. Save as `prop_<id>.png`.

> Single **[description]**, three-quarter view from slightly above, centred, plain mid-grey background,
> flat even lighting, no cast shadow, no ground plane. Realistic industrial design, weathered, chipped
> paint, light frost in crevices. Original design, no text or logos.

| id | description to paste |
|---|---|
| `container_20ft` | 20-foot corrugated steel shipping container, olive paint, rust streaks, closed doors with locking bars |
| `jersey_barrier` | concrete jersey barrier, 3 m long, chipped edges, faded paint stripe, snow packed against the base |
| `lamp_post` | 6 m steel lamp post with a single enclosed tungsten lamp head and a small junction box |
| `flood_tower` | 10 m lattice floodlight tower with four rectangular floodlights and a ladder |
| `fence_panel_4m` | 4 m chain-link fence panel with a steel frame, coiled razor wire on top |
| `fuel_drum` | 200-litre steel fuel drum, dented, faded paint |
| `supply_crate` | military supply crate, ribbed steel corners, latches, slate grey |
| `sandbag_row` | short curved row of stacked canvas sandbags, frozen and dusted with snow |
| `bunker_module` | 4 m wide cast-concrete bunker wall section with formwork seams and a small vent |
| `quonset_shed` | small half-cylinder corrugated metal shed with a door at one end |
| `antenna_mast` | 12 m guyed radio antenna mast with dish and whip antennas |
| `hvac_unit` | rooftop industrial HVAC unit with fan grilles and pipes |
| `pipe_run_4m` | 4 m section of insulated industrial pipe on steel supports |
| `cable_spool` | large wooden cable spool with heavy black cable |
| `snowmobile` | military snowmobile, slate grey, cargo rack |
| `tracked_hauler` | tracked arctic cargo hauler vehicle, boxy cab, gunmetal |

Rocks and ice come from Megascans, not GPT (see §6).

---

## 5. Insignia and decals (original branding)

Square, transparent background if offered (otherwise pure black). Save as `decal_<id>.png`.

**Sable emblem**
> An original military faction emblem for "Sable", an occupying force: a simple, angular, stencil-able
> mark built from a stylised predator's head or a downward chevron and a bar. Flat single colour white
> on a transparent background, no text, no gradients, readable when 20 cm wide on a container.

**Halcyon emblem**
> An original logo for "Halcyon", a polar engineering company: a clean geometric mark suggesting a bird
> in flight over a horizon line. Flat single colour white on a transparent background, no text.

**Stencil sheet**
> A sheet of original industrial stencil markings in a 4×4 grid on a transparent background, flat
> white, sprayed-stencil edges: hazard chevrons, arrows, a lifting-point symbol, a no-step symbol, an
> electrical warning symbol, a fragile symbol, a grid reference box, numbers 0–9 in a blocky stencil
> style. No words.

**Grime and wear atlas** (only if Megascans decals don't cover it)
> A 4×4 atlas of seamless-edged decal patches on a transparent background, top-down, flat lighting:
> rust streaks running down, oil stains, scorch marks, frost creeping from a corner, footprints in
> snow, tyre tracks in snow. Photographic, no text.

---

## 6. Megascans / Fab shopping list (for reference)

Download at **2K**, all maps (Albedo, Normal, Roughness, AO). Unzip each surface into
`assets/surfaces/<id>/` and run `python3 tools/pack_surface.py --id <id>`: it packs the ORM, converts a
DirectX normal, and writes `public/surfaces/`, which the game loads at boot. Slots and tile sizes are in
`assets/manifest.ts` (`SURFACES`).

| Surface id | What to search for |
|---|---|
| `snow` | wind-blown / rippled snow, plus a fresh powder snow |
| `packedSnow` | trampled or dirty snow (paths) |
| `ice` | blue glacier ice with cracks, and a frost overlay |
| `concrete` | cast concrete with formwork seams; a cracked, stained concrete floor |
| `paint` | chipped painted steel in a neutral grey (I tint it per faction in code) |
| `corrugated` | corrugated sheet metal (containers, sheds) |
| `grate` | steel tread plate or floor grating (Ch5 catwalks) |
| `rust` | rusted steel (dark machinery, high cover) |
| `rock` | dark basalt or granite rock face, and gravel / scree |

3D scans: 3–4 large rocks or cliff chunks, 2–3 ice blocks or shards, a small rubble / debris set.
Decals: rust leaks, cracks, oil stains, snow drift edges. Take GLB/glTF if offered, otherwise FBX, with 2K textures.
