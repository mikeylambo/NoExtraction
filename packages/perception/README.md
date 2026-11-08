# @slu/perception

Shared enemy perception for SLU games: sight cones that fill over time, hearing radii,
last-known-position memory and alert propagation by radio. Game-agnostic and renderer-neutral —
it never moves anyone. AI reads awareness and decides what to do.

## API

```ts
import { PerceptionSystem, createPerceiver, SpatialHash } from '@slu/perception';

const perception = new PerceptionSystem({ occluded: (a, b) => world.rayBlocked(a, b), visionBlocked: (a, b) => smoke.blocks(a, b) }, { radioDelay: 0.8 });
const p = perception.add(createPerceiver('courtyard', config, { x: 0, y: 0, z: 0 }, yaw));
perception.setTarget({ id: 'player', pos, points: [1.6, 1.0], visibility: 1 });
perception.emit({ kind: 'noise', pos, radius: 12 });   // quiet → suspicious
perception.emit({ kind: 'loud', pos, radius: 40 });    // loud → hunted
perception.addVisual('body-7', pos, 'hunted');          // something that must not be seen
perception.update(dt);
perception.onAwareness(e => ...);  perception.onRadio(e => ...);
```

### Model

| Piece | Behaviour |
|---|---|
| `Awareness` | `unaware → suspicious → hunted` |
| Sight | Two stages fill while the target is in cone + range + line of sight: stage one raises suspicion, stage two hunts. Fill time lerps `fillClose → fillFar` with distance and is divided by target `visibility`. |
| Cones | Horizontal FOV with vertical tolerance, or a true 3D cone via `pitchDeg` (scanning beams). `maxAwareness` caps what sight alone can do. |
| Hearing | `noise` raises to suspicious (or `quietMax`), `loud` always hunts. Radius scaled by `hearing.multiplier`. |
| Memory | `lastKnown` is set on every contact. Suspicious perceivers investigate for `investigateTime`; hunted perceivers drop to suspicious after `huntMemory` seconds without contact. `huntedFor` counts continuous hunted time. |
| Radio | A perceiver that goes hunted on its own calls it in after `radioDelay`: same `group`, within `radioRange`. `radioEnabled = false` cuts propagation. |
| Visual stimuli | Persistent things (bodies, flares) that escalate whoever first sees them. |
| `SpatialHash` | XZ uniform grid used for hearing queries; exported for reuse (projectiles, AI). |
| `snapshot()` | Plain data for debug overlays: cones, meters, memory. |
