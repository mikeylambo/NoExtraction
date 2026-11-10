# TUNING LOG

Every tuning change: old → new, and why. Starting numbers are the GDD's (data/*.ts) and, for the mech,
the AlphaMech baseline.

## Baseline — `@slu/mech-frame` (`MECH_BASELINE`, verbatim from AlphaMech `core/Tuning.ts` @ 25d615e)

| Key | Value | | Key | Value |
|---|---|---|---|---|
| speed | 62 | | camDist | 30 |
| accel | 16 | | camHeight | 6.4 |
| thrust | 92 | | camLag | 13 |
| gravity | 50 | | camFov | 62 |
| quickSpeed | 200 | | camFovBoost | 76 |
| quickDur | 0.22 | | mouseSens | 0.0023 |
| quickCost | 20 | | padLookSens | 2.9 |
| quickCooldown | 0.34 | | padDeadzone | 0.16 |
| assaultSpeed | 200 | | pitchMin / pitchMax | −0.85 / 1.0 |
| assaultDrain | 6 | | impactDecay | 150 |
| assaultAccel | 12 | | staggerDmgMult | 1.9 |
| energyMax | 100 | | impactHoldAfterHit | 1.8 |
| hoverCost | 14 | | exposedMult | 2.4 |
| regenGround / regenAir | 43 / 16 | | focusHeight (FOCUS_H) | 7 |
| regenDelay | 0.5 | | descentSpeed / ceiling | 130 / 240 |

Unchanged in Flamingo. The only edits to extracted behaviour are bug fixes (below), not tuning.

## Mech-frame behaviour fixes (not tuning)

| Change | Why |
|---|---|
| Altitude ceiling ignored when ground ≤ −1000 | AlphaMech's ceiling is ground-relative; over a bottomless void (Shelf Run crevasses) it yanked the frame down 300 m. Found by the bot, covered by a unit test. |
| Jump-jet hop: vertical velocity clamped to ≤ 6 m/s when the 12 m cap is hit | Without the clamp, thrust momentum coasted the hop to ~66 m (unit test), defeating "hops up to 12 m". |
| Shake uses deterministic noise instead of `Math.random` | Same amplitudes; keeps the simulation package free of `Math.random`. |

## Game tuning changes

| Date | Value | Old → New | Why |
|---|---|---|---|
| build | Warden rifle damage | 26 → 12 | Three Wardens killed Flamingo in ~30 s in bot runs; GDD calls them "now prey". |
| build | Warden rifle accuracy | 0.45 → 0.35 | Same. |
| build | Warden burst gap | 1.6 → 2.0 s | Same. |
| build | Warden rockets | 70 dmg / 7 s → 45 dmg / 9 s | Same; rockets stay telegraphed (lock tone 1.0 s). |
| build | Warden evasion (miss chance while boost-strafing) | 0.65 → 0.40 | Non-boss frames should be erasable; the Marshal keeps 0.65. |
| build | Marshal rifle burst damage | 24 → 14 | Arriving with the left arm lost (half fire rate), the bot died every ~15 s; target is a 4–6 min duel, not attrition. |
| build | Marshal blade lunge | 210 → 160 | Same. |
| build | Marshal missile salvo | 55 × 6 → 35 × 6 | Same. |
| build | Marshal gantry crush | 320 → 240 | Same. |
| build | Marshal overcharge beam | 520 → 400 | Same; it remains the biggest hit and is fully dodgeable with a quick boost. |
| build | Sovereign plating (share of damage that gets through) | — → rifle 0.3 / missiles 0.5 / blade 0.6 / cannon 1.0 | Without plating, rifle DPS (~400) killed 9,000 armor in < 30 s; plating targets the GDD 4–6 min TTK. Measured TTK in `artifacts/` (see report). |
| build | Marshal evasion (miss chance while boosting) | 0.65 → 0.50 | Bot runs alternated between a death loop and a 15-minute stalemate; the duel should reward aim, not be a coin flip. |
| build | Sovereign rifle plating | 0.30 → 0.36 | Same. |
| build | Restore grace at Marshal phase checkpoints | 50% → 75% armor | Phase checkpoints are saved mid-duel; retries should start fightable. |
| build | Shelf crevasse width | 45 → 30 m | Must be clearable in every component configuration (jump-jet hop without the governor). |
| build | Ascent base climb | 1,400 → 520 m/s | Chapter 6 lasted ~2 min against a GDD 7 min target. |
| build | Ascent jettison burst | 900 → 380 m/s | Proportional to the slower climb. |
| build | First Warden ("in service") armor | 1,400 → 220 (docked) | GDD §13: first enemy dies within 4 s of boot-up. |
| visual | Ballast armor / under colours | 0x4a5560/0x1b2026 → 0x8d99a6/0x3c4650 | Read as a silhouette-only black shape at night. |
| visual | Tone mapping exposure | 1.05 → 1.25 | Night scenes were crushed; HUD readability unchanged. |
| visual | Hemisphere fill | ambient×0.9 → ambient×1.3 + 0.15 | Same. |
| visual | Flamingo glow emissive | 3.2 → 1.4 (parked 1.2) | Signal white bloomed into a flare in the dark hangar. |
