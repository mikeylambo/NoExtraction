# NO EXTRACTION — The Slice

*Four minutes late. Left on schedule.*

The complete ~60-minute Slice: six chapters from the job to the ending, built on the SLU Web Shell
with three new shared packages. Spec: the GDD; build log: `DECISIONS.md`, `TUNING_LOG.md`;
recording script: `AUDIO_DELIVERY.md`.

```bash
npm install
npm run dev        # http://localhost:5190
```

| Script | |
|---|---|
| `npm run build` / `preview` | Type-check + production bundle / serve it |
| `npm run check` | typecheck + lint + unit tests + build + headless bot run of every chapter's critical path |
| `npm run check:fast` | typecheck + lint + unit tests |
| `npm run bot -- ch3 [--loud] [--components=flightGovernor,missileRack,arcBlade]` | Bot run of chosen chapters (`artifacts/bot-*.json`) |
| `npm run shots -- artifacts/shots ch1,ch5` | Screenshot tour |
| `npm run audio-delivery` | Regenerate `AUDIO_DELIVERY.md` |
| `npm run script:check` / `script:import` / `script:export` | Dialogue script sync (see below) |
| Production plan | `PRODUCTION_PLAN.md`: milestones, workstreams, owners, status |
| Benchmark (real hardware) | `npm run dev`, open `http://localhost:5190/?bench` (or `?bench=ch1,ch5`, `&q=low`), click Start: ~2 min, then Copy/Download the report |
| `npm run lookdev-shots` | Render the lookdev stills (`artifacts/lookdev`) |
| `python3 tools/pack_surface.py --id <slot>` | Pack a Megascans/PBR download into `public/surfaces/` (ORM, WebP); see ASSET_SPEC §9 |
| `python3 tools/pack_decal.py --id <decal>` | Pack a decal (Megascans set or transparent PNG/sheet) into `public/decals/`; placement rules in `data/decals.ts`; see ASSET_SPEC §10 |

**Lookdev:** `npm run dev` then open `/lookdev.html`: one night courtyard pushed toward the MGS4-era
target (keys 1–4 shots, 0 auto, O free cam, P post on/off). Asset contract: `ASSET_SPEC.md`.

## Writing dialogue

The dialogue is written in `script/NoExtraction.fountain`, a [Fountain](https://fountain.io) screenplay.
Open it in Highland, Beat, Slugline, or VS Code with a Fountain extension. Every spoken block ends with
its line id as a note, `[[c1.wren.open1]]`. The cue is the speaker label from `data/story/lines.ts`
(BALLAST, AVA, FLAMINGO-07, THE MARSHAL, HALCYON SYSTEMS, SABLE), and the parenthetical is the line's
performance note. Scene headings and action are free text for the writer and never reach the game.

- `npm run script:import` writes script text and parentheticals into `data/story/*.ts` and refreshes
  `AUDIO_DELIVERY.md`. A block with a new id is appended to its chapter's data file; it plays once a
  chapter script in `src/story` says it.
- `npm run script:check` fails if the script and the game data disagree (part of `check` and `check:fast`).
- `npm run script:export` appends game lines the script doesn't place yet to the end of the script.

The parser is game-agnostic (`parseFountain`, `fountainDialogue` in `@slu/narrative`), so other SLU games
can reuse it.

## Layout

```
packages/narrative     @slu/narrative   story graph, sequences, dialogue, VO, cinematic camera, subtitles, checkpoints, world state, triggers
packages/mech-frame    @slu/mech-frame  AlphaMech movement/lock/camera/vitals/rig, extracted
packages/perception    @slu/perception  sight, hearing, memory, radio propagation, spatial hash
src/game               App (shell, saves, menus, loop), Session (chapter runtime), World, Input
src/player             Ballast: controller, camera, weapons, visor
src/mech               Flamingo-07, Ascent mode
src/ai                 Sable archetypes, alert ladder, Warden frames, The Marshal
src/world              collision, level DSL, gates, hazards, collapse events, timed zones, atmosphere, FX, levels/ch1..ch6
src/story              chapter scripts (beats, sequences, triggers)
src/ui                 HUD, mech HUD, options, title, credits
src/audio              WebAudio engine (shell AudioSystem), synth SFX, adaptive score
src/dev                dev panel (`), overlay (F3), bot, window.__nx hooks
data/                  every GDD number, typed; data/story = all VO + subtitles
assets/manifest.ts     hero assets: drop a GLB at the path to replace the stand-in
```

## Controls (defaults, remappable in Options → Controls)

On foot: WASD move · mouse look · Shift sprint · C/Ctrl crouch (slide while sprinting) · Space vault/mantle · E interact · F takedown · RMB aim · LMB fire · R reload · 1–3/wheel swap · G throw · T cycle throwable · Q visor · H stim · V shoulder · Tab objective.
Flamingo: WASD · Shift tap quick boost / hold assault boost · Space jets/flight · C descend · Z/MMB hard lock · LMB rifle · RMB blade/shove · Q missiles · E cannon.
Gamepad per GDD §3/§7. Esc/Start pause. Hold Space/Enter/A to skip cinematics. Backtick: dev panel. F3: overlay.

## Dev hooks (`window.__nx`)

`teleport(x,y,z)`, `triggerBeat(id)`, `setAlert('unaware'|'suspicious'|'hunted'|'lockdown')`, `setCore(pct)`, `giveComponent(id)`, `completeTimedZone()`, `godMode(on)`, `loadChapter(id)`, `skip()`, `state()`, `bot.start(chapter, mode)`.
