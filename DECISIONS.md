# DECISIONS

Design and engineering decisions taken during the Slice build, with the reason for each. Tuning
changes (old → new) live in `TUNING_LOG.md`.

## 0. Repository

- **Repo.** The brief names `mikeylambo/no-extraction`; this session's repository is
  `mikeylambo/noextraction` (empty at start). Built there, on branch `claude/new-session-vmmwli`.
  Nothing was built inside the shell repo.
- **Shell version.** `@slu/web-shell` is pinned to commit `7003ec7` of
  `mikeylambo/Web-Game-Shell-v1.02` (package version 1.3.0). The repo had no fetchable tags, so the
  dependency uses the commit hash; `dist/` is committed upstream so installs never build.
- **Packages** live in `packages/*` as npm workspaces consumed as TypeScript source (Vite alias +
  tsconfig paths). They are game-agnostic; `tools/lint.mjs` fails the build if a package imports game
  code or names game content.

## 1. Source audit (read before reuse)

### SLU Web Shell (read: `src/Shell.ts`, `bootstrap/createGameApp.ts`, `ui-shell/*`, `input/*`, `platform/browser/*`, `persistence/*`, `audio/*`, `modules/checkpoints`, `modules/results`, `release/Credits`, `presentation/*`, `sequencing/Timeline`, `narrative/NarrativeDirector`, `feel/*`, `look/three/PostStack`)

| Provides | Used for |
|---|---|
| `SLUWebShell` (session phases, pause/resume/quit, `loadLevel` via a `RendererAdapter`, telemetry, dev registry) | App lifecycle: chapters load through `shell.loadLevel`; pause/resume/quit go through the shell |
| `InputManager` + `BrowserInputSource` (keyboard/mouse/gamepad semantic actions), `PointerLook`, `BrowserInputFamilyDetector` | All game input (`src/game/Input.ts`); rebinding rebuilds the binding table |
| `BrowserPlatform` (fullscreen, pointer lock, visibility, resize) | All platform access (lint-enforced) |
| `BrowserStorage`, `SettingsStore`, `SaveManager` (schema version, migrations, staging/backup/integrity recovery) | Settings (CoreSettings + game options), 3 save slots + profile |
| `DOMGameUI` (focusable screen models, KBM + pad navigation) | Every menu: title, slots, difficulty, chapter select, options pages, controls/rebind, pause, results |
| `AudioSystem` contract, `AudioMixer`, `AudioLifecycleCoordinator` | `AudioEngine` implements `AudioSystem`; lifecycle pauses audio on tab hide / pause |
| `CheckpointManager`, `ResultsManager`, `CreditsRegistry`, `DifficultyManager` | Checkpoint history, chapter results, credits document, difficulty profiles |
| `TimeControl` (hitstop/slow-mo over a fixed step), `TraumaShake` (accessibility-scaled shake) | Hitstop 70/50/25/90 ms, death slow-mo, all screen shake |
| `look/three` `PostStack` (bloom, grade, vignette, flashes with an accessibility cap, distortion) + `createPalette`, `tunables` | Post-processing; flash/blur accessibility settings drive it |
| `presentation/Subtitles` (timed-track scheduler), `VoiceManifest`, `NarrativeDirector`, `sequencing/Timeline` | **Not** used for the story layer: they are linear players without priorities, ducking, cooldowns, world state or cinematic handoff. The brief asks for `@slu/narrative` as the reusable system, so it was built as a new package. |

### AlphaMech (BLINKFALL) — read `frame/Player.ts`, `Lock.ts`, `CameraRig.ts`, `Vitals.ts`, `Types.ts`, `Context.ts`, `Ordnance.ts`, `core/Tuning.ts`, `core/Input.ts`, `entities/*`, `fx/Thruster.ts`
- **Extracted into `@slu/mech-frame`:** the movement/energy core of `Player.update` (boost skate, quick
  boost, assault boost, vertical thrust, descent, the held-altitude "ASHFALL profile", energy regen),
  `LockSystem`, `CameraRig` (as `ChaseCamera`, writing a pose instead of owning the renderer camera),
  `Vitals`, and the procedural rig (`MechRig`, `MechModels`, `RigDriver`, `Materials`, `Thruster`)
  copied verbatim.
- **Stripped:** its renderer, menus, input manager, settings globals, run/upgrade/FORGE layers, vanish
  and rally systems, director, scoring. Globals (`T`, `settings`) became constructor parameters.
- **Baseline:** `MECH_BASELINE` is a verbatim copy of the movement/camera/vitals values in
  AlphaMech `core/Tuning.ts` at commit `25d615e` (recorded in `TUNING_LOG.md`).

### astra-vs-fable (ASHFALL / IRONVEIL)
- Read `Fable 5.1/src/core/Tuning.ts` and the player controller structure. AlphaMech already carries
  ASHFALL's donor values (it marks them `donor: ASHFALL`), so per the brief nothing was taken from
  astra-vs-fable directly.

## 2. Architecture

- **Fixed step.** Simulation runs at 60 Hz (`World.step`) inside the shell `TimeControl`; rendering
  uses the presentation dt. Hitstop freezes simulation while presentation continues.
- **Determinism.** Simulation uses `World.rng` (mulberry32); `Math.random` is banned in simulation
  directories by lint. Cosmetic effects (snow, debris streaks, particles) may use it.
- **Collision is authoritative and box-based.** Every collidable is an AABB in a grid hash
  (`CollisionWorld`); rays use a DDA walk. Render meshes are merged per material (draw-call budget)
  and never consulted for gameplay.
- **One World, reused.** `Session` tears down and rebuilds a chapter from its `LevelDef` + story
  script; checkpoints are restored by rebuilding and re-applying `WorldState` (collapses, gates,
  flags) and skipping killed enemies. Death → fade 0.25 s → rebuild → fade in: "fast and invisible".
- **Narrative layer.** `@slu/narrative` holds no game content. Chapter scripts (`src/story/chN.ts`)
  register beats, sequences (typed `StoryAction`s) and triggers.

## 3. GDD interpretations (no player-visible contradiction, so decided and logged)

1. **Flight Governor vs Freight Lift.** The Freight Lift is a mandatory set piece, but the governor is
   an optional component (8 combinations must exist). Decision: the lift/bay is the critical path; the
   governor sits in a Halcyon cargo pod off the path behind a weakened door (breacher) or a crawl
   round the back. Taking it costs Timed Zone seconds.
2. **Why the governor is in the shaft.** In Ch1 Ava tells Ballast to drop the pulled governor in the
   Halcyon cargo tube; in Ch3 her cache says the cargo never shipped — it is stuck in the colony lift
   shaft. ("Undoing his own sabotage" stays literal.)
3. **Why Flamingo is at the forward depot.** Sable could not fly it out without the governor, so they left
   it at their forward depot at the end of the conduits. Ava's Ch5 cache says so.
4. **"The clock appears for the first time" (Ch1).** Implemented as a non-failing narrative
   "Extraction window" clock (8:00) that continues into Ch2; The Pad is the first real Timed Zone.
5. **The Pad is a lost cause by design.** Reaching the pad completes the zone; Ava's ship is already
   climbing in every outcome. Failing the clock restarts at the bridge.
6. **Mech numbers.** GDD §7 says starting values are targets and AlphaMech's tuned feel wins:
   movement, energy and camera use the AlphaMech baseline (quick boost 20 energy, assault drain 6/s,
   etc.). Combat economy uses the GDD (armor 2,400; rifle 48 dmg / 0.12 s / 40 rounds / 2.0 s reload;
   cannon 420 ×2, 6 s, 0.4 s wind-up; missiles 8 × 90, 14 s; blade 160/160/260, 25 m lunge).
7. **Mech scale.** With AlphaMech speeds (62 m/s skate, 200 m/s boosts) Chapter 5 areas are built at
   mech scale (yard 900 m, shelf 4.8 km, platform radius 360 m). The camera relation holds: on-foot
   distance/height ≈ 1.9; AlphaMech camDist 30 on a 10 m frame ≈ 1.6 × that ratio — "the same body
   made bigger" — so no camera change was needed.
8. **Assault boost input.** GDD: Shift hold ≥ 0.3 s = assault boost (while held); tap = quick boost.
   (AlphaMech used a toggle; the GDD control table wins for this game.)
9. **Air boosting.** Without the governor, quick/assault boost is ground-only and jets hop ≤ 12 m;
   with it, sustained flight and air boosts (GDD §6).
10. **First enemy dies within 4 s of boot-up.** A Warden "in service" (docked, inactive, 220 armor)
    stands in front of the depot door; the soft lock acquires it immediately (measured: 0.6 s).
11. **Systems loss.** Storm: `hardLock` offline 60 s, manual aim, assist halved. Ambush: left arm
    (rifle to right mount, half fire rate). Marshal phase 3: shoulder cannon via a scripted grapple
    (the hit lands regardless). Ascent jettisons weapons → shoulders → armor → booster.
12. **Marshal arena shrink.** Phase 2 telegraphs (3 s shelf crack) and drops the outer ring of the
    platform; bounds shrink to two thirds. Twin Wardens join once.
13. **Ballast's real name** is "Teo", said once by Ava in the last personal cache (pc4). The final
    line has an alternate warmer take when all four personal caches were found (VoiceTrack alt take,
    condition `allPersonalCaches`).
14. **Readability law in AI visuals.** Enemy muzzle glints, vision cones, drone beams, alarm lamps,
    tracers and lockdown UI are red; Ava's caches, ship lights and subtitle label are amber (with a
    diamond marker); Ballast's HUD, prompts, takedown prompt and visor are cyan; the core is violet.
    Warm fire-barrel light and white gate trim avoid the three meaning colours. Lint enforces that the
    three hex values only appear in `data/palette.ts`.
15. **Colourblind modes** remap the three CSS meaning colours (protan/deutan/tritan); shapes carry
    meaning too (eye icon = threat, diamond = Ava, circle/chevron = Ballast info).
16. **Story difficulty** lowers enemy damage/accuracy, lengthens telegraphs and detection fill, raises
    the health regen cap to 100 and boss armor to 60%. Hard shortens telegraphs and fill times
    (constitution §19: information and execution first, damage last).
17. **Checkpoint restore grace.** Resuming from a checkpoint never starts below 50% armor (75% at
    Marshal phase checkpoints) or 60 health (on foot), so a checkpoint saved mid-fight cannot become a death loop.
18. **Hard lock auto-release.** If the hard-locked target dies, the lock drops to soft lock.
19. **Bot.** The bot drives the real input path (scripted `InputFrame`s). It aims precisely
    (it is a test harness, not a player model), sidesteps telegraphs with quick boosts, hacks sealed
    gates, and rewinds its script on death to the step of the checkpoint it respawned at.

## 4. Options audit (GDD §15) — every option changes something visible

Difficulty · Timed Zone assist (+50%) · aim assist (pad magnetism / mech assist cone) · sprint/aim/
crouch hold-or-toggle · mouse & stick sensitivity · invert Y · subtitles on/off · size · background
opacity · speaker colours · caption descriptions · colourblind mode · screen shake (scales all shake)
· reduce blur (cannon radial blur & post distortion) · reduce flashes (flash charge whiteout, flare,
post flashes) · master/music/SFX/voice volume · FOV · fullscreen · remappable controls (keyboard,
mouse, pad) · reset.

## 5. Deploy

- `vercel.json` is included (build `npm run build`, output `dist`, install command that rewrites
  GitHub URLs with `GITHUB_TOKEN` per the shell's `docs/PRIVATE-REPO-INSTALLS.md`). **No deploy was
  made from this session**: there are no Vercel credentials here. Connect the repo in Vercel, add
  `GITHUB_TOKEN` (Contents: read on the shell repo), and every push gets a preview deploy.
