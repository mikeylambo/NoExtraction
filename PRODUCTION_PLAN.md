# NO EXTRACTION — Production Plan

*From vertical slice to a Steam release. Living document: update the status columns as work lands.*
*Shared, editable copy with a status-dropdown tracker: [No Extraction — Production Plan](https://claude.ai/artifact/KqiRzocfZgSvzMfFuY9bek). Keep the two in step.*

Status key: **Done** · **Doing** · **Next** · **Later** · **Blocked** (says on what).
Owners are roles until people are named: **Director** (creative + business decisions),
**Eng** (engineering, incl. Claude sessions), **Env Art**, **Char Art**, **Anim**, **VFX**, **UI**,
**Audio**, **QA**, **Producer**, **Legal**, **Marketing**.

---

## 1. Product decisions

| Decision | State | Notes |
|---|---|---|
| Platform | **Decided: Steam (Windows, macOS, Linux), Steam Deck Verified as a target** | The game is TypeScript + WebGL. It ships to Steam inside a desktop wrapper (Electron: one bundled Chromium, so rendering is identical on every PC). |
| Consoles | **Decided: not now** | Consoles do not run web games. Shipping there means porting the renderer, audio and platform layer to a native engine or runtime, so it stays out of scope until the PC launch has proven the game. |
| Price band | **Proposed: $19–29, depends on length** | See the length decision. |
| Length | **Open (Director)** | The repo holds the GDD's *Slice column* only: 6 chapters, ~60 min first playthrough (`data/chapters.ts`). Replay (grades, Fast/Long routes, components, caches) adds some. **Steam refunds any purchase played under 2 hours within 14 days**, so a 60-minute game at $19+ will see refunds. Either ship the GDD's fuller scope (target 4–6 h first playthrough for $19–24), or price the Slice at $9.99–14.99. Action: add the GDD to the repo (`docs/GDD.md`) so this plan can lock to its full column. |
| Demo | **Proposed: Chapters 1–2 as a Steam demo for a Next Fest** | Doubles as the M2 quality bar and the main wishlist driver. |
| Engine | **Decided: stay on the current web stack** | The systems, bot tests and tools are built; no port. |

## 2. Milestones and exit criteria

| # | Milestone | Exit criteria (all must be true) |
|---|---|---|
| M0 | **Pre-production lock** | Length/price decided · GDD in repo · min-spec and recommended spec measured on real hardware (§3.6) · budgets in `ASSET_SPEC.md` confirmed or revised from those numbers · team roles staffed or contracted |
| M1 | **Look target (Vertical Slice 2.0)** | Chapter 1 fully dressed: modular environment meshes over the collision boxes, scans, decals, lighting pass · final Ballast and Sable trooper in · mocap locomotion set in · Ch1 VO recorded · runs at target fps on min-spec · captured as a 60 s trailer-quality sequence |
| M2 | **Steam page + demo** | Store page live (capsules, trailer, screenshots, description) · Chapters 1–2 demo at M1 quality · desktop build with Steamworks (overlay, achievements stub) · crash reporting · first external playtest done |
| M3 | **Alpha: content complete** | Every chapter playable start to end with final layouts · all characters, mechs and the ship modelled (some placeholder materials allowed) · all VO recorded · all music written · all systems feature-complete |
| M4 | **Beta: final assets** | No placeholder art, audio or text · performance at target on min-spec in every chapter · localization in · accessibility audit passed · no new features after this point |
| M5 | **Release candidate** | Zero known crash or progression bugs · Steam build review passed · Steam Deck review submitted · age-rating questionnaire done · legal checklist complete (§3.12) · store page "coming soon" for at least 2 weeks |
| M6 | **Launch + support** | Day-one patch path tested · telemetry dashboards watched · first patch within 2 weeks |

## 3. Workstreams

### 3.1 Environment art (Env Art) — biggest visual gap
| Task | Owner | Status | Depends on |
|---|---|---|---|
| Tiling surface pipeline (scans → `public/surfaces`, `tools/pack_surface.py`) | Eng | **Done** | |
| Decal system + first set (cracks, leaks, rust, frost, tracks, stencils, emblems) | Eng | **Done** | |
| Surface picks: snow, concrete, ice, grate | Director | **Done** (review in game) | |
| Rock and packed-snow surfaces | Env Art | Next | |
| **Modular kit spec + kit-over-box tech**: `KIT_PIECES` (12 pieces) + `data/kit.ts` rules; instanced meshes over the collision boxes; code-built stand-ins (`npm run kit-templates`) dress Chapter 1 today (≈1,000 boxes, +9 draw calls) | Eng | **Done** | |
| Kit modelling to replace the stand-ins, own concepts in Blender/Meshy (Fab listings only as general study; free Megascans rocks/cliffs where they fit) | Env Art | **Next (M1)** | |
| Props: containers, barriers, lamps, flood towers, fuel drums, crates, sandbags, cable spools, snowmobile, tracked hauler | Env Art | Next (M1 for Ch1 set) | |
| 3D scans from the ArtPass release (rubble, sandbags): FBX → GLB + prop slots | Eng | Next (M1) | |
| Chapter 1 dressing + lighting pass | Env Art | M1 | kit, props |
| Chapters 2–6 dressing + lighting | Env Art | M3–M4 | M1 approved |

### 3.2 Characters, mechs, ship (Char Art)
| Task | Owner | Status | Depends on |
|---|---|---|---|
| Sable trooper (rigged GLB in game) | Char Art | **Done** (first pass) | |
| Ballast (back silhouette first) | Char Art | Next (M1) | |
| Sable spotter, Sable heavy | Char Art | M2 / M3 | |
| Ava, the Marshal (cutscene faces, blendshapes) | Char Art | M3 | facial pipeline |
| FLAMINGO-07 (per-part pieces for the procedural rig) | Char Art | M3 | |
| Warden, Sovereign, Ava's ship | Char Art | M3 | |

### 3.3 Animation (Anim)
| Task | Owner | Status | Depends on |
|---|---|---|---|
| First mocap session (45 takes, `ASSET_SPEC.md` §8) | Anim | Next (M1) | |
| Locomotion + stealth + weapon sets retargeted and blended | Anim + Eng | M1 | mocap |
| Takedowns (attacker + victim), hit reactions, deaths | Anim | M2 | |
| Cutscene performance + facial capture, lip sync | Anim | M3 | Ava/Marshal heads |
| Mech animation polish (boot-up, stagger, blade) | Anim | M3 | FLAMINGO-07 |

### 3.4 VFX and UI (VFX, UI)
| Task | Owner | Status | Depends on |
|---|---|---|---|
| Muzzle flash, impacts, sparks, blowing snow, explosions, thrusters, core effects | VFX | M1 (Ch1 set) → M3 | |
| HUD and menu art pass, final fonts | UI | M2 | |
| Logo, key art, capsule images (6 concept keyframes are the starting point) | UI + Marketing | M2 | |

### 3.5 Audio (Audio)
| Task | Owner | Status | Depends on |
|---|---|---|---|
| Recording script (`AUDIO_DELIVERY.md`: 172 VO lines, 76 SFX, 14 cues) | Eng | **Done** | |
| Casting + VO recording | Audio + Director | Ch1 for M1, rest M3 | casting |
| Composer: adaptive stems (infiltration/suspicion/hunted/lockdown), themes | Audio | M2 → M3 | |
| SFX library replacing the synth stand-ins | Audio | M1 (Ch1) → M3 | |
| Ambience beds, final mix, loudness targets | Audio | M4 | |

### 3.6 Engineering: performance (Eng) — milestone gate for M0
| Task | Owner | Status | Depends on |
|---|---|---|---|
| Perf tooling (bot runs, `artifacts/perf.json`) | Eng | **Done** (CPU renderer only) | |
| **Benchmark mode runnable on any machine**: `?bench` plays each chapter's heaviest spot with a camera sweep, reports fps, frame-time percentiles, draw calls, triangles, GPU; Copy/Download | Eng | **Built**: first real run pending | |
| Measure on real hardware: 2019 MacBook Pro (UHD 630 / Radeon Pro), a Steam Deck, a mid-range Windows GPU. Run `?bench` (default tier) and `?bench&q=low` on each | Director + QA | **Next (M0)** | benchmark mode |
| Set min/recommended spec and per-chapter budgets (draw calls, triangles, texture memory) | Eng | M0 | measurements |

### 3.7 Engineering: shipping (Eng)
| Task | Owner | Status | Depends on |
|---|---|---|---|
| Asset delivery at scale: KTX2 GPU textures, mesh compression, per-chapter loading, progress UI | Eng | M2 | |
| Desktop wrapper (Electron) + Steamworks (overlay, achievements, cloud saves, rich presence) | Eng | M2 | |
| Crash reporting + opt-in telemetry (chapter times, deaths, quits, fps) | Eng | M2 | privacy policy |
| Save versioning and migration across patches | Eng | M3 | |
| CI that installs the private web-shell dependency and runs `npm run check` on every push | Eng | Next | repo access |
| Gamepad coverage (Xbox, PlayStation, Deck), glyph switching | Eng | M2 | |

### 3.8 Design and content (Director + Design)
| Task | Owner | Status | Depends on |
|---|---|---|---|
| 6-chapter Slice playable end to end with grading, routes, caches, components | Eng | **Done** | |
| Scope expansion to the GDD's full column (if chosen) | Director | Blocked (length decision) | §1 |
| Onboarding pass: first 10 minutes teach everything without text walls | Design | M2 | playtests |
| External playtests (5–8 players per round, recorded), tuning passes after each | Producer | M2, M3, M4 | |

### 3.9 QA
| Task | Owner | Status | Depends on |
|---|---|---|---|
| Automated: unit tests, lint, bot critical path for every chapter, proofs | Eng | **Done** | |
| Test plan per chapter, bug tracker, severity rules | QA | M2 | |
| Compatibility matrix (GPUs, OS, Deck, controllers) | QA | M3 | |
| Release-candidate full passes | QA | M5 | |

### 3.10 Accessibility
| Task | Owner | Status | Depends on |
|---|---|---|---|
| Options suite (remapping, hold/toggle, subtitles, captions, colourblind, shake/blur/flash, timed-zone assist) | Eng | **Done** | |
| Audit against the Xbox Accessibility Guidelines and Game Accessibility Guidelines; fix gaps | QA + Eng | M4 | |

### 3.11 Localization
| Task | Owner | Status | Depends on |
|---|---|---|---|
| Move all player-facing text into string tables with ids (VO lines already have ids) | Eng | M3 | |
| Fonts covering target languages; UI that survives longer strings | UI + Eng | M3 | |
| Translation of text + subtitles: French, Italian, German, Spanish first; then Brazilian Portuguese, Simplified Chinese, Japanese, Korean, Russian, Polish | Producer | M4 | string tables |

### 3.12 Legal and business
| Task | Owner | Status | Depends on |
|---|---|---|---|
| Asset licence register (every Fab/Megascans asset, generated asset, font, sound): source, licence, commercial use confirmed | Producer + Legal | Next (start now, keep current) | |
| Generated-content review: rights to GPT/Meshy outputs; Steam AI-content disclosure text | Legal | M2 | |
| Trademark search: "No Extraction", "Halcyon", "Sable", "FLAMINGO-07" | Legal | M0 | |
| Company/Steamworks account, app fee, tax and bank details | Director | M2 | |
| Age-rating questionnaire, EULA, privacy policy (needed once telemetry exists) | Legal | M5 | |
| Credits complete and accurate | Producer | M5 | |

### 3.13 Marketing
| Task | Owner | Status | Depends on |
|---|---|---|---|
| Trailer (from the M1 Chapter 1 capture), screenshots, GIFs | Marketing | M2 | M1 |
| Store page copy, tags, capsules | Marketing | M2 | key art |
| Next Fest demo plan; press and creator list | Marketing | M2 | demo |
| Community (Discord, devlog cadence) | Marketing | M2 → launch | |

## 4. Now / Next

1. **Director:** decide length → price (§1). Add the GDD to the repo.
2. **Eng:** benchmark mode, so real hardware can be measured (§3.6).
3. **Director/QA:** run it on the MacBook, a Deck if available, and one Windows PC; send back the reports.
4. **Eng + Env Art:** modular kit spec and kit-over-box tech (§3.1), then Chapter 1 as the M1 look target.
5. **Producer:** start the asset licence register with the ArtPass release contents.

## 5. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Short length vs price (Steam 2-hour refunds) | Refunds, reviews | Decide length first; price to it |
| Box-built levels cap the look | Reviews, trailer | Kit-over-box meshes (M1 proves it on Ch1) |
| Browser perf on integrated GPUs | Min-spec excludes many laptops | Measure at M0; quality tiers; budgets enforced per chapter |
| Download size grows to GBs | Load times | KTX2, per-chapter loading, desktop build bundles assets locally |
| Generated art rights or disclosure | Store rejection, legal | Register + review before M2 |
| Single private dependency (web-shell) | CI and builds break | Vendored snapshot or CI access token |
