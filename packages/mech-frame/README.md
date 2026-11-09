# @slu/mech-frame

The mech frame from AlphaMech (BLINKFALL), extracted so any SLU game can drive it inside the shell.
AlphaMech/BLINKFALL is intended to become its second consumer. Requires `three`.

## What it is

| Module | API |
|---|---|
| `MECH_BASELINE`, `cloneBaseline()`, `MechTuning` | AlphaMech's tuned movement/energy/camera/vitals values, verbatim. Copy and override; never edit the baseline. |
| `MechFrame` | `new MechFrame(env, tuning?, events?)`; `update(dt, {moveX, moveZ, rise, descend})`; `quickBoost(dir)`; `setAssault(on)`; `addEnergy`; `reset`; `caps = {sustainedFlight, hopHeight, airBoost}`; state: `pos, vel, yaw, pitch, energy, grounded, state, assault, locked, staggered`. `env = { groundAt(x,z), confine(pos, margin) }`. |
| `LockSystem<T extends {pos, alive}>` | Soft assist + hard lock: `best`, `acquire`, `toggleHard`, `cycle`, `release`, `range`, `capacity`. Lock orients, never positions. |
| `ChaseCamera` | AlphaMech's chase rig as a pose (`position`, `target`, `fov`, `roll`): hard lock frames both fighters at constant apparent size; `distanceScale`, `shoulder`, `shakeScale`, `shakeCap`, `baseFov`; `update(dt, input)`, `apply(camera)`. |
| `Vitals` | Structure / impact / stagger / exposed with tuning injected. |
| Rig: `MechRig`, `RigDriver`, `buildPlayerMech`, `buildStandardMech`, `buildHeavyMech`, `buildDrone`, `makeMechMats`, palettes, `thrusterMaterial`, `updateThrusterTime` | AlphaMech's procedural rig, pose driver and thruster shader, unchanged. |

## What was removed

Its renderer, menus, input, settings globals, run/upgrade/FORGE layers, the vanish and rally systems,
director and scoring. Globals became parameters; `Math.random` camera shake became deterministic noise.

## Behaviour notes (also in the game's TUNING_LOG)

- Holding altitude when not thrusting is the ASHFALL profile (sustained flight). Without
  `sustainedFlight` the jets hop up to `hopHeight` and gravity returns the frame.
- The altitude ceiling is ground-relative; when `groundAt` returns ≤ −1000 (a bottomless void)
  there is no ceiling, so the frame can fall.

Tests: `tests/mechframe.test.ts`.
