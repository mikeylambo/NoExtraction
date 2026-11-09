# @slu/narrative

Reusable story layer for SLU narrative games. No game content, no renderer, no audio engine —
the game executes typed actions and plays files; this package keeps story time.

| Module | API | Responsibility |
|---|---|---|
| `WorldState` | `set/get/has/num/add`, `apply(changeId)`, `applied()`, `coreStability`, `collapsePhase`, `snapshot/hydrate`, `events` | Flags, permanent world changes, a global stability value |
| `Conditions` | `evaluate(cond, world)` — `'flag'`, `{flag, eq/gte/lte}`, `{change}`, `{all}`, `{any}`, `{not}` | Requirements for beats, triggers, alt takes |
| `StoryGraph` | `register(chapters)`, `startChapter`, `advance(beat?)`, `goto(beat, force)`, `completeChapter`, `snapshot/hydrate`, `events: beat:enter/exit, chapter:enter/complete` | Chapters → beats, `requires`, `sets`, checkpoint markers |
| `TriggerSystem` | `add({id, shape: box/sphere, when?, once?, onEnter, onExit})`, `update(pos)`, `force(id)`, `snapshot/hydrate` | Volumes + conditions that fire sequences |
| `VoiceTrack` | `addSpeakers`, `add(lines)`, `resolve(id)` (alt take by condition, measured or estimated duration), `setMeasured`, `validate`; `estimateDurationMs(text)` | VO registry: id, speaker, text, priority, file, notes, alt takes |
| `DialogueDirector` | `say(id, {channel: story/recording/bark, interruptible, cooldownKey, onEnd})`, `sayAll`, `tick(dt)`, `pause/resume`, `stopAll`, `setDuration`; events `start/stop/duck/dropped` | Priority interrupts, recordings never interrupted by recordings (queue, finish first), barks ducked −12 dB under recordings/VO and never over them, 90 s bark cooldowns |
| `SequenceDirector<A>` | `register(defs)`, `play(id, {replay})`, `skip()` (runs only `essential` steps), `pause/resume`, `update(dt)`, `onAction(handler)` | Timelines of game-typed actions (VO, camera, collapse, flags, spawns) |
| `SkipGate` | `update(held, dt)` → true once at `holdS` | "Hold 1 s to skip" |
| `CinematicCamera` | `play(shots, {blendOut, onHandoff})`, `update(dt, gameplayPose)` → pose or null, `controlLocked`, `letterbox`, `stop()` | Authored shots, dollies, blends, shake, letterbox; **control returns on the same update the blend into the live gameplay pose completes** |
| `SubtitleView` | `new SubtitleView(root, settings)`, `show/hide/clear`, `apply(settings)` | Speaker labels in speaker colour, size options, background opacity, caption descriptions |
| `StoryCheckpoint<Inv, Extra>` | `capture(id, inventory, extra)`, `restore(payload)` | Checkpoint + inventory + flags + WorldState + fired triggers in one serialisable payload |

```ts
const world = new WorldState(); const graph = new StoryGraph(world); const triggers = new TriggerSystem(world);
const voice = new VoiceTrack(world); voice.addSpeakers(SPEAKERS); voice.add(LINES);
const dialogue = new DialogueDirector(voice);
const seq = new SequenceDirector<MyAction>(); seq.register(SEQUENCES); seq.onAction((a, ctx) => run(a, ctx.skipping));
const cam = new CinematicCamera();
// per step: seq.update(dt); dialogue.tick(dt); triggers.update(playerPos);
// per frame: const pose = cam.update(dt, gameplayPose) ?? gameplayPose;
```

Tests: `tests/narrative.test.ts` (StoryGraph, conditions, DialogueDirector priority/queue/ducking/cooldown, skip, camera handoff, checkpoint round trip).
