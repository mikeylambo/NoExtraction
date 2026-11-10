# Asset Spec — NO EXTRACTION

Target: **late-PS3 / early-PS4 fidelity** (MGS4-era) in the browser, judged against `lookdev.html`.
This is the contract for anything made with GPT (concept/texture images), Meshy (3D), Blender
(cleanup) and iPhone mocap. If an asset meets this sheet it drops in without code changes.

---

## 1. Pipeline

```
GPT image  ──►  Meshy (image → 3D, PBR)  ──►  Blender cleanup  ──►  GLB  ──►  assets/models/<id>.glb
 concept          mesh + textures              scale, pivot,          one file      game picks it up
 turnaround                                    rig, LOD, compress                   at boot (manifest)
```

- Characters add one step: **rig** (Mixamo auto-rig or AccuRIG) before export, then mocap clips are
  retargeted onto that skeleton.
- Static props skip rigging entirely.
- Slots and paths live in `assets/manifest.ts`. New props get added there as they arrive.

## 2. Global technical rules (every asset)

| Rule | Value |
|---|---|
| File | **GLB** (glTF 2.0 binary), one asset per file, textures embedded |
| Units | **1 unit = 1 metre**. A door is 2.1 m, a trooper 1.8 m, a container 6.06 × 2.59 × 2.44 m |
| Up axis | +Y |
| Facing | Model's front toward Blender's **Front** view (exports as glTF +Z). The game handles the turn. |
| Pivot | Characters and props: **bottom centre, at the feet/base**. Doors: on the hinge line |
| Transforms | Applied (scale 1, rotation 0) before export |
| Materials | **Metallic-roughness PBR only.** Max 2 materials per prop, 3 per character, 4 per mech |
| Texture maps | Base Color (sRGB), Normal (OpenGL / +Y), **ORM** packed (R = AO, G = Roughness, B = Metal) |
| Texture sizes | Power of two. See budgets below. Never larger than 2048 |
| Lighting | **No baked lighting or shadows in Base Color.** Flat, evenly lit albedo |
| Emissive | Separate emissive map only where light is meant to come from (visors, lamps, screens) |
| Compression | Run through `gltf-transform` (Draco or Meshopt geometry, KTX2/WebP textures) before commit |
| Naming | `snake_case`, the manifest id: `sable_trooper.glb`, `container_20ft.glb` |

### Poly and texture budgets

| Class | Triangles (LOD0) | LODs | Textures |
|---|---|---|---|
| Hero character (Ballast) | 25–40k | LOD1 50% | 2048 body + 1024 head + 1024 gear |
| Enemy character (trooper/spotter/heavy) | 15–25k | LOD1 50%, LOD2 20% | 2048 body + 1024 gear |
| Player mech (FLAMINGO-07) | 40–60k | LOD1 50% | 2 × 2048 |
| Enemy mech (Warden, Sovereign) | 30–50k | LOD1 50%, LOD2 25% | 2 × 2048 |
| Ship (Ava's) | 30–50k | LOD1 40% | 2 × 2048 |
| Building module (bunker, shed) | 2–8k | none | 1024 unique + tiling materials |
| Medium prop (container, barrier, lamp) | 500–3k | LOD1 50% if > 1.5k | 1024 |
| Small prop (drum, crate, sandbag) | 150–1k | none | 512 |

Meshy outputs are often 100k+ triangles. **Always set the target polycount in Meshy** (or decimate
in Blender). Over-budget meshes are the main thing that would sink browser performance.

## 3. Art direction (original, not borrowed)

The world is an ice-shelf research colony at night, lit by aurora, moon and practical lamps. Two
material languages carry the story:

- **Sable (the occupiers):** worn, utilitarian, militarised. Gunmetal and slate paint over steel,
  chipped at edges, frost in the seams. Hard angles, bolted plates, visor slits. Sable's *only* bright
  colour is a **red visor/sensor glow**. Red always means Sable threat. Never use it on anything else.
- **Halcyon (the crew Ballast works for):** cleaner engineering, off-white composites with grey
  panelling, cyan information lights. Cyan only for Ballast's information (HUD, visor, scan).
- **Ava:** amber running lights. Amber only for Ava.
- **The Core:** violet-white. Only the failing core.
- **Colony infrastructure:** neutral. Cast concrete, corrugated olive/teal/rust containers, tungsten
  (warm white) lamps, cold-white floodlights.

The palette law is enforced in code (`data/palette.ts`). Keep emissive colours on assets inside it.

**Reference the qualities, not the games:** grounded military-industrial design, believable wear,
readable silhouettes at 20 m. Don't copy any existing franchise's characters, logos, gear shapes or
insignia. Ask GPT for "original design" and avoid naming other games in prompts.

## 4. Priority list

**A. Characters (do first; they carry the look)**
1. `sable_trooper`: the most-seen enemy. Helmet with a horizontal red visor slit, cold-weather layered
   fatigues, chest rig, rifle on a sling (separate GLB: `rifle_sable.glb`).
2. `ballast`: the player operative. Halcyon sealed helmet with cyan visor, insulated suit, sidearm
   holster. Seen from behind in third person, so the **back silhouette matters most**.
3. `sable_spotter`: trooper variant with a scoped rifle and antenna pack.
4. `sable_heavy`: ~2.05 m, armoured front plate, LMG.

**B. Mechs and ship**
5. `aegis07`: ~10 m, signal-white Halcyon frame. Separate parts per limb (see §6).
6. `warden_frame` · 7. `sovereign` · 8. `wren_ship`

**C. Environment kit (reused everywhere)**
`bunker_module` (wall 4 m, corner, door bay, roof edge) · `container_20ft` · `quonset_shed` ·
`lamp_post` · `flood_tower` · `jersey_barrier` · `sandbag_row` · `fuel_drum` · `supply_crate` ·
`fence_panel_4m` + `fence_post` · `antenna_mast` · `rock_large_a/b/c` · `ice_shard_a/b` · `pipe_run_4m` ·
`hvac_unit` · `cable_spool` · `snowmobile` · `tracked_hauler`.

## 5. GPT prompt templates

Ready-to-paste, filled-in prompts for every asset (plus chapter target frames, insignia and the
Megascans shopping list) are in **`GPT_PROMPTS.md`**. The templates below are the pattern behind them.

Feed the GPT image into Meshy's image-to-3D. Clean input means clean geometry.

**Character turnaround (one image per character):**
> Orthographic character turnaround sheet, front / side / back views, same scale, neutral A-pose
> (arms 45° down), plain mid-grey background, flat even studio lighting with no cast shadows, full body
> visible head to boots. Original design: **[description]**. Realistic proportions, 1.8 m adult,
> grounded military cold-weather gear, worn and used. Physically plausible materials. No text, no
> logos, no weapons in hands.

**Prop (one view, three-quarter):**
> Single **[prop]**, three-quarter view from slightly above, centred, plain mid-grey background, flat
> even lighting, no cast shadow, no ground plane. Realistic industrial design, weathered, chipped
> paint, light frost in crevices. Original design, no text or logos.

**Tiling texture (when Meshy textures are too blurry):**
> Seamless tileable texture, top-down orthographic, flat even lighting, no shadows or perspective:
> **[cast concrete with formwork seams / chipped olive paint on steel / wind-packed snow]**,
> 2 m × 2 m real-world area.

Then derive normal and roughness in Materialize or Substance Sampler (or ask me to bake them).

## 6. Meshy settings

- **Image to 3D**, PBR textures **on**, *Remesh* **on** with **Quad** topology for characters
  (Triangle is fine for props), and the target polycount from §2.
- Characters: **A-pose**, symmetry **on**. Let Meshy texture it, but expect to fix the face and hands.
- Mechs and anything with moving parts: generate **each part separately** (torso, upper arm, forearm,
  thigh, shin, foot, weapon) so the game can pivot them. Name the parts `torso`, `arm_l_upper`, ...
  The mech rig is procedural and only needs clean, pivot-ready pieces.
- Export **GLB**, then open it in Blender to check scale (use a 1.8 m reference cube), pivot and
  facing before it goes in the repo.

### Known Meshy weak spots (check these every time)
- Lighting baked into the albedo (dark undersides). Fix: regenerate with flatter input, or paint
  out in the texture.
- Melted hands, fingers fused. Fine for gloved troopers at distance; the hero needs a manual pass.
- Over-dense, uneven triangles. Fix: Blender *Decimate* (collapse) to budget.
- Soft, smeared detail. Fix: tile a detail normal on top, or use the GPT tiling textures.

## 7. Rigging (characters)

- Rig with **Mixamo auto-rig** (free, outputs the `mixamorig:` skeleton) or **AccuRIG**. Both map onto
  the shell's `SLU_Humanoid_v1` contract (Hips, Spine, Chest, Neck, Head, arms, legs, feet, toes).
- The skeleton must include: hips, 3 spine bones, neck, head, clavicles, upper/lower arms, hands with
  fingers, upper/lower legs, feet, toes.
- Weapon attaches to a `weapon_r` socket on the right hand. The game adds it, so don't merge the gun.
- Export **with skin**, rest pose = A-pose, no animations in the character file (clips come separately).

## 8. Mocap with the iPhone 16e

**Body (single-camera video → animation):** record on the iPhone, then process in a markerless
service: *Move.ai One*, *Rokoko Video*, *QuickMagic* or *DeepMotion*. Export **FBX on a Mixamo-compatible
skeleton**. Try a couple on the same take; quality varies by motion type.

**Face (cutscenes):** the 16e has a TrueDepth (Face ID) camera, so ARKit face apps work (*Live Link
Face*, *Face Cap*, *Rokoko Face Capture*). They export 52 ARKit blendshape curves. Heads need matching
blendshapes (Meshy won't make these, so this is a later step for hero faces only).

### Recording setup
- Phone on a tripod at hip height, landscape, 3–5 m away, **whole body in frame for the whole take**.
- Fitted clothes that contrast with the background. Even lighting, no backlight.
- Start and end every take in **A-pose for 2 s**, then a **clap** (sync point).
- Mark the floor with tape: start spot, turn spot, stop spot.
- 60 fps if the app allows. Keep takes short: one move per take, 3 variations each.
- Act with a weight prop (a broom works as a rifle). Weapon handling reads in the shoulders.

### Shot list (first session, ~45 takes)
| Set | Clips |
|---|---|
| Locomotion | idle, walk, jog, sprint, walk/jog **start** and **stop**, turn-in-place 90° L/R and 180° |
| Stealth | crouch idle, crouch walk, crouch-to-stand, prone down/up, lean left/right |
| Weapon | aim idle, aim walk forward/back/strafe, fire recoil, reload, holster/draw |
| Traversal | vault (1 m wall), mantle (1.6 m), climb ladder loop, drop down |
| Takedown | attacker grab + takedown, **victim reaction** (record both roles, same timing; count out loud) |
| Sable | patrol idle variants (check watch, stretch, cold shiver), alert look-around, radio call |
| Reactions | hit front/back/left/right, death forward/back, stagger, flinch from flashbang |

Name files `<set>_<clip>_<take>.fbx` (e.g. `loco_walk_start_02.fbx`). Clean-up (foot locking, loop
points, root motion) happens in the motion pipeline from the web-shell (`docs/MOTION-IMPACT-PIPELINE.md`).

## 9. Tiling surfaces (Megascans / Fab)

Level geometry is procedural boxes; its detail comes from the surface library (`src/render/surfaces.ts`),
which generates every surface in code until a scan replaces it. Slots: `assets/manifest.ts` `SURFACES`
(snow, packedSnow, concrete, paint, corrugated, rust, rock, ice, grate).

1. Download the surface at **2K** and unzip it into `assets/surfaces/<id>/` (git-ignored).
2. `python3 tools/pack_surface.py --id <id> [--size 1024|2048]` (needs `pip install pillow`). It finds
   base colour, normal, AO, roughness/gloss and metalness by filename, packs **ORM**, converts DirectX
   normals to OpenGL and writes WebP files to `public/surfaces/` (committed; they ship with the build).
3. Set the slot's `tile` to the scan's real-world size (the Fab listing gives it, usually 2 m).
4. Boot the game: the console lists `surface scans`. The low quality tier loads them at half size.

The scan's albedo is applied as detail around each material's own colour, so pick neutral scans and
let the material colour do the faction tint. Snow cover, the visor scan and core glow still layer on top.

## 10. Delivery checklist

- [ ] GLB, metres, +Y up, front = Blender Front view, pivot at the base, transforms applied
- [ ] Within the triangle budget; LODs where listed
- [ ] Base Color / Normal / ORM, no baked light, ≤ 2048
- [ ] Emissive colours follow the palette law (red = Sable, cyan = Ballast info, amber = Ava)
- [ ] Characters: rigged, A-pose, skinned, no clips embedded
- [ ] Compressed (`gltf-transform optimize in.glb out.glb --texture-compress webp`)
- [ ] Dropped at `assets/models/<id>.glb`, listed in `assets/manifest.ts`
- [ ] Checked in `lookdev.html` next to the procedural set before it goes into a chapter
