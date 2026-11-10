# NO EXTRACTION — Audio Delivery

Everything to record or produce. Generated from `data/story/*.ts` and `data/audio.ts` by `npx tsx tools/audio-delivery.ts` — edit the data, not this file.

**Formats:** mono 48 kHz WAV masters; deliver OGG (q6) at the listed path. A file at a listed path replaces the fallback with no code change (missing VO plays as timed subtitles; missing SFX/music use the synth stand-ins).

**Target length** for VO is the reading-time estimate the game currently uses; matching it within ±30% keeps subtitle timing natural (the game re-times to the real file automatically).

**Totals:** 172 VO lines · 76 SFX · 14 music cues.

## Voice — by speaker, then chapter

### BALLAST (52 lines)

Michael. Dry, professional, then furious, then focused. Helmeted throughout: slight helmet resonance is fine; no radio filter on his own lines.

#### Chapter 1 — The Job

| ID | Line | Context / performance | Target | File |
|---|---|---|---|---|
| `c1.ballast.open1` | Not a minute after. | Dry. An old joke between them. | 2.0 s | `assets/vo/ballast/c1.ballast.open1.ogg` |
| `c1.ballast.hangar1` | Big. | Deadpan. | 1.4 s | `assets/vo/ballast/c1.ballast.hangar1.ogg` |
| `c1.ballast.sabotage` | Sorry, big guy. | Genuinely a little sorry. GDD-mandated line. | 1.8 s | `assets/vo/ballast/c1.ballast.sabotage.ogg` |
| `c1.ballast.tube` | Policy says a lot of things. |  | 2.8 s | `assets/vo/ballast/c1.ballast.tube.ogg` |
| `c1.ballast.window` | You've never waited for anyone in your life. |  | 3.5 s | `assets/vo/ballast/c1.ballast.window.ogg` |

#### Chapter 2 — Left Behind

| ID | Line | Context / performance | Target | File |
|---|---|---|---|---|
| `c2.ballast.alarm` | Copy. Quiet. |  | 1.4 s | `assets/vo/ballast/c2.ballast.alarm.ogg` |
| `c2.ballast.missileRack` | Missile rack. Somebody's going to miss this. |  | 3.3 s | `assets/vo/ballast/c2.ballast.missileRack.ogg` |
| `c2.ballast.bridge` | Bridge. Ninety seconds. Hold it. | Running, breathing hard. | 2.7 s | `assets/vo/ballast/c2.ballast.bridge.ogg` |
| `c2.ballast.wait` | Ava. Ava! I am on the bridge! | Furious. Breathless. | 3.4 s | `assets/vo/ballast/c2.ballast.wait.ogg` |
| `c2.ballast.pad1` | Four minutes. I was four minutes late. | Quiet. Disbelief. | 3.3 s | `assets/vo/ballast/c2.ballast.pad1.ogg` |
| `c2.ballast.pad2` | Acceptable parameters. Sure. | Talking back to the PA. | 1.8 s | `assets/vo/ballast/c2.ballast.pad2.ogg` |
| `c2.ballast.quake` | Oh, come on— | The ground goes out from under him. | 1.8 s | `assets/vo/ballast/c2.ballast.quake.ogg` |
| `c2.ballast.cache1reply` | You left me a voicemail. You left me a voicemail and a flashlight. | To a recording that cannot hear him. | 5.5 s | `assets/vo/ballast/c2.ballast.cache1reply.ogg` |
| `c2.ballast.yard` | Sable's yard. Fine. Fine. | Looking at the horizon. | 2.3 s | `assets/vo/ballast/c2.ballast.yard.ogg` |
| `c2.ballast.bridgeFail` | Not like this. |  | 1.7 s | `assets/vo/ballast/c2.ballast.bridgeFail.ogg` |

#### Chapter 3 — Dead Colony

| ID | Line | Context / performance | Target | File |
|---|---|---|---|---|
| `c3.ballast.open` | Dead colony. Of course it is. |  | 2.9 s | `assets/vo/ballast/c3.ballast.open.ogg` |
| `c3.ballast.shotgun` | Breacher. Doors are a suggestion now. |  | 2.9 s | `assets/vo/ballast/c3.ballast.shotgun.ogg` |
| `c3.ballast.weakDoor` | That door's had a hard week. | Hint: weakened doors open with the breacher. | 2.8 s | `assets/vo/ballast/c3.ballast.weakDoor.ogg` |
| `c3.ballast.collapseTool` | That tower is coming down. Make it count. | Hint: lure them under it. | 3.6 s | `assets/vo/ballast/c3.ballast.collapseTool.ogg` |
| `c3.ballast.cache2reply` | My governor. You sent me back for my own governor. |  | 4.4 s | `assets/vo/ballast/c3.ballast.cache2reply.ogg` |
| `c3.ballast.pc1reply` | Fly instead of hop. Noted. |  | 2.5 s | `assets/vo/ballast/c3.ballast.pc1reply.ogg` |
| `c3.ballast.pc2reply` | …It was three kilometres. |  | 2.2 s | `assets/vo/ballast/c3.ballast.pc2reply.ogg` |
| `c3.ballast.freightLift` | Pumps are failing. Water is coming up the shaft. | Timed Zone start. | 4.0 s | `assets/vo/ballast/c3.ballast.freightLift.ogg` |
| `c3.ballast.governor` | Hello again. | To the governor. | 1.4 s | `assets/vo/ballast/c3.ballast.governor.ogg` |
| `c3.ballast.liftDown` | Going down. |  | 1.4 s | `assets/vo/ballast/c3.ballast.liftDown.ogg` |
| `c3.ballast.liftFlood` | Too slow. Again. |  | 1.8 s | `assets/vo/ballast/c3.ballast.liftFlood.ogg` |

#### Chapter 4 — Under the Ice

| ID | Line | Context / performance | Target | File |
|---|---|---|---|---|
| `c4.ballast.dark` | Can't see a thing. Visor it is. |  | 3.3 s | `assets/vo/ballast/c4.ballast.dark.ogg` |
| `c4.ballast.heavy` | Heavy. Don't trade with that. Get behind it. |  | 3.8 s | `assets/vo/ballast/c4.ballast.heavy.ogg` |
| `c4.ballast.hounds` | Hounds. They hunt by sound. Walk. | Whispered. | 3.0 s | `assets/vo/ballast/c4.ballast.hounds.ogg` |
| `c4.ballast.water` | Water's rising. |  | 1.4 s | `assets/vo/ballast/c4.ballast.water.ogg` |
| `c4.ballast.cache3reply` | Don't think. Run. Your best advice in eleven years. |  | 4.1 s | `assets/vo/ballast/c4.ballast.cache3reply.ogg` |
| `c4.ballast.pc3reply` | Little late for that. |  | 2.0 s | `assets/vo/ballast/c4.ballast.pc3reply.ogg` |
| `c4.ballast.pc4reply` | …Nobody's called me that in a long time. |  | 3.6 s | `assets/vo/ballast/c4.ballast.pc4reply.ogg` |
| `c4.ballast.arcBlade` | Arc blade. Sorry, Sable. |  | 2.3 s | `assets/vo/ballast/c4.ballast.arcBlade.ogg` |
| `c4.ballast.conduit` | Here it comes. | Conduit Flood start. | 1.7 s | `assets/vo/ballast/c4.ballast.conduit.ogg` |
| `c4.ballast.depot` | Forward depot. And— no way. | He sees AEGIS-07. | 2.7 s | `assets/vo/ballast/c4.ballast.depot.ogg` |

#### Chapter 5 — Aegis

| ID | Line | Context / performance | Target | File |
|---|---|---|---|---|
| `c5.ballast.aegis` | They couldn't fly you out. Because of me. | Hand on the frame. | 3.6 s | `assets/vo/ballast/c5.ballast.aegis.ogg` |
| `c5.ballast.cache4reply` | I know. I know. |  | 2.2 s | `assets/vo/ballast/c5.ballast.cache4reply.ogg` |
| `c5.ballast.install` | Undoing my own work. Great. | Reinstalling the flight governor. | 2.5 s | `assets/vo/ballast/c5.ballast.install.ogg` |
| `c5.ballast.bypass` | Yeah. I figured. | Ripping a panel. Manual bypass. | 1.8 s | `assets/vo/ballast/c5.ballast.bypass.ogg` |
| `c5.ballast.firstKill` | Okay. Okay. I get it now. | First enemy dies within four seconds of control. | 3.0 s | `assets/vo/ballast/c5.ballast.firstKill.ogg` |
| `c5.ballast.wardens` | Wardens. I've been hiding from you for two days. | Predator now. | 4.0 s | `assets/vo/ballast/c5.ballast.wardens.ogg` |
| `c5.ballast.shelf` | Boost. Boost! |  | 1.4 s | `assets/vo/ballast/c5.ballast.shelf.ogg` |
| `c5.ballast.shelfFail` | Too slow. |  | 1.4 s | `assets/vo/ballast/c5.ballast.shelfFail.ogg` |
| `c5.ballast.arm` | That was my good arm. |  | 2.4 s | `assets/vo/ballast/c5.ballast.arm.ogg` |
| `c5.ballast.marshal1` | Your people left you here too. |  | 2.8 s | `assets/vo/ballast/c5.ballast.marshal1.ogg` |
| `c5.ballast.marshalDead` | …Thanks. |  | 1.4 s | `assets/vo/ballast/c5.ballast.marshalDead.ogg` |

#### Chapter 6 — Ascent

| ID | Line | Context / performance | Target | File |
|---|---|---|---|---|
| `c6.ballast.launch` | Come on. Come on— | Under 4G. | 2.2 s | `assets/vo/ballast/c6.ballast.launch.ogg` |
| `c6.ballast.jettison1` | Take it. Take all of it. |  | 2.9 s | `assets/vo/ballast/c6.ballast.jettison1.ogg` |
| `c6.ballast.jettison3` | Dump the weight. That is what I am for. | Almost a laugh. He finally owns the name. | 4.0 s | `assets/vo/ballast/c6.ballast.jettison3.ogg` |
| `c6.ballast.drift` | …Huh. | In the silence. Barely breath. | 1.4 s | `assets/vo/ballast/c6.ballast.drift.ogg` |
| `c6.ballast.final` | …You’re late. | Final line. Dry. Exhausted. One take. | 1.4 s | `assets/vo/ballast/c6.ballast.final.ogg` |
| `c6.ballast.final` (alt) | …You’re late. | Alternate warmer take, used when allPersonalCaches | 1.4 s | `assets/vo/ballast/c6.ballast.final.warm.ogg` |

### AVA (42 lines)

Live radio in Chapter 1 only (band-limited radio). Every cache line is a recording made before she lifted off — steady, rehearsed, fragile underneath. Last line of the game is live again.

#### Chapter 1 — The Job

| ID | Line | Context / performance | Target | File |
|---|---|---|---|---|
| `c1.wren.open1` | That's the broadcast. Seventy-two and falling. I'm holding the pad until oh-four-forty. | Live radio. Brisk, warm under the professionalism. | 5.3 s | `assets/vo/wren/c1.wren.open1.ogg` |
| `c1.wren.open2` | Not a second after. Policy. Patrol below the ridge — keep your head down. |  | 6.1 s | `assets/vo/wren/c1.wren.open2.ogg` |
| `c1.wren.firstPatrol` | One trooper on the path. Get behind him. | Quiet, focused. | 3.6 s | `assets/vo/wren/c1.wren.firstPatrol.ogg` |
| `c1.wren.clean` | Clean. Like always. | Approving. A little proud. GDD-mandated line. | 1.8 s | `assets/vo/wren/c1.wren.clean.ogg` |
| `c1.wren.pair` | Two of them, close together. Drop the first and keep moving — you'll have a second before the other one knows. |  | 8.7 s | `assets/vo/wren/c1.wren.pair.ogg` |
| `c1.wren.chainDone` | Two for two. Show-off. | Smiling. | 2.2 s | `assets/vo/wren/c1.wren.chainDone.ogg` |
| `c1.wren.visor` | Courtyard ahead. Pulse your visor — their sightlines paint on the ground. |  | 5.3 s | `assets/vo/wren/c1.wren.visor.ogg` |
| `c1.wren.fastGate` | Cyan gate's the fast way in. It stays open as long as nobody knows you're there. |  | 6.6 s | `assets/vo/wren/c1.wren.fastGate.ogg` |
| `c1.wren.longRoute` | Or go around through the service yard. Slower. Safer. Your call. |  | 5.0 s | `assets/vo/wren/c1.wren.longRoute.ogg` |
| `c1.wren.spotter` | Spotter on the tower. Forty metres of eyes. Break his line, or take him off it. |  | 6.8 s | `assets/vo/wren/c1.wren.spotter.ogg` |
| `c1.wren.seen` | They've got you. Break contact. | Sharp. Worried, not panicked. | 2.5 s | `assets/vo/wren/c1.wren.seen.ogg` |
| `c1.wren.lockdown` | Lockdown. Fast gate's sealed — hack the console or take the long way. |  | 5.6 s | `assets/vo/wren/c1.wren.lockdown.ogg` |
| `c1.wren.hangar1` | There she is. AEGIS-07. | A little awed. | 2.2 s | `assets/vo/wren/c1.wren.hangar1.ogg` |
| `c1.wren.hangar2` | Sable's planetary defense prototype. Pull the flight governor and it's the most expensive statue on Ilvane. |  | 6.6 s | `assets/vo/wren/c1.wren.hangar2.ogg` |
| `c1.wren.tube` | Governor goes in the cargo tube. Policy: the part rides separate from the operative. |  | 6.0 s | `assets/vo/wren/c1.wren.tube.ogg` |
| `c1.wren.window` | Extraction window's open. Eight minutes. Pad's on the cliff. Don't make me wait. | The clock appears on this line. | 5.7 s | `assets/vo/wren/c1.wren.window.ogg` |
| `c1.wren.window2` | And I'm not starting tonight. Go. |  | 2.9 s | `assets/vo/wren/c1.wren.window2.ogg` |
| `c1.wren.exit` | Through the outer gate and you are out of their house. Keep going. |  | 5.5 s | `assets/vo/wren/c1.wren.exit.ogg` |

#### Chapter 2 — Left Behind

| ID | Line | Context / performance | Target | File |
|---|---|---|---|---|
| `c2.wren.alarm` | They found the governor gone. The whole complex is waking up. Stay off their panels — if one of them reaches an alarm, every fast gate in the sector seals. | Urgent, still in control. | 12.2 s | `assets/vo/wren/c2.wren.alarm.ogg` |
| `c2.wren.carbine` | Weapons rack by the motor pool. Sable carbine. Loud — anyone who hears it comes for you. |  | 7.2 s | `assets/vo/wren/c2.wren.carbine.ogg` |
| `c2.wren.armory` | Armory's off the east road. Not on the way. If you're feeling greedy. | Knowing him. | 5.6 s | `assets/vo/wren/c2.wren.armory.ogg` |
| `c2.wren.window` | Ballast, the window's closing. Where are you? | First crack of real worry. | 3.4 s | `assets/vo/wren/c2.wren.window.ogg` |
| `c2.wren.climbing` | I can't. The window's closed. I'm lifting. Ballast, I'm— policy. I'm sorry. | She hates every word. | 5.7 s | `assets/vo/wren/c2.wren.climbing.ogg` |
| `c2.wren.cache1a` | If you're hearing this, I left. On schedule. You know the policy, and you know I follow it. | Recorded before lift-off. Steady, rehearsed, fragile underneath. | 7.7 s | `assets/vo/wren/c2.wren.cache1a.ogg` |
| `c2.wren.cache1b` | Sable has one launch cradle left, at their yard. Past the dead colony, under the ice. I flew the route twice. I left you things along it. |  | 11.2 s | `assets/vo/wren/c2.wren.cache1b.ogg` |
| `c2.wren.cache1c` | Amber light. You'll know. Don't make me regret this. |  | 4.1 s | `assets/vo/wren/c2.wren.cache1c.ogg` |

#### Chapter 3 — Dead Colony

| ID | Line | Context / performance | Target | File |
|---|---|---|---|---|
| `c3.wren.cache2a` | The colony has been empty six days. Sable pulled out and left their own people at the mast. I bounced this off it. |  | 9.3 s | `assets/vo/wren/c3.wren.cache2a.ogg` |
| `c3.wren.cache2b` | The freight lift goes down to the core conduits — the only way under the ridge. And the cargo never shipped, Ballast. Everything we sent down the tube is stuck in that shaft. Including your souvenir. |  | 14.5 s | `assets/vo/wren/c3.wren.cache2b.ogg` |
| `c3.wren.pc1a` | This one's not on the route. You always check the corners. I thought you'd find it. | Personal. Softer. | 6.7 s | `assets/vo/wren/c3.wren.pc1a.ogg` |
| `c3.wren.pc1b` | Cargo bay in the lift shaft. If you want that frame to fly instead of hop, the governor's in there. The shaft floods when the pumps go. Be fast. |  | 11.8 s | `assets/vo/wren/c3.wren.pc1b.ogg` |
| `c3.wren.pc2a` | Remember Kessel Station? You carried me two kilometres because I said my ankle was fine. | Remembering. Almost laughing. | 6.2 s | `assets/vo/wren/c3.wren.pc2a.ogg` |
| `c3.wren.pc2b` | It wasn't fine. You knew. You didn't say anything. You never say anything. |  | 5.7 s | `assets/vo/wren/c3.wren.pc2b.ogg` |

#### Chapter 4 — Under the Ice

| ID | Line | Context / performance | Target | File |
|---|---|---|---|---|
| `c4.wren.cache3a` | Under the ice is Sable's conduit network. It runs to their forward depot, right under the yard. |  | 7.1 s | `assets/vo/wren/c4.wren.cache3a.ogg` |
| `c4.wren.cache3b` | The core is bleeding into the water down there. If it starts rising, don't think. Run. |  | 6.8 s | `assets/vo/wren/c4.wren.cache3b.ogg` |
| `c4.wren.pc3a` | Maintenance bay, past the pump hall. Sable keeps frame tools there. |  | 4.9 s | `assets/vo/wren/c4.wren.pc3a.ogg` |
| `c4.wren.pc3b` | There's an arc blade on the rack. You always liked getting close. Don't get too close. |  | 6.7 s | `assets/vo/wren/c4.wren.pc3b.ogg` |
| `c4.wren.pc4a` | Last one. I nearly didn’t leave it. | Very quiet. This is the one she was afraid to record. | 3.3 s | `assets/vo/wren/c4.wren.pc4a.ogg` |
| `c4.wren.pc4b` | They named you Ballast because you're the weight they drop so the ship can rise. I never called you that. Not once. |  | 8.9 s | `assets/vo/wren/c4.wren.pc4b.ogg` |
| `c4.wren.pc4c` | Come home, Teo. | Ballast’s real name, said once. | 1.8 s | `assets/vo/wren/c4.wren.pc4c.ogg` |

#### Chapter 5 — Aegis

| ID | Line | Context / performance | Target | File |
|---|---|---|---|---|
| `c5.wren.cache4a` | If you made it this far, you found it. They left it behind because it can't fly. Because of you. |  | 8.3 s | `assets/vo/wren/c5.wren.cache4a.ogg` |
| `c5.wren.cache4b` | The yard has one cradle left. Sable's ace is guarding it — they call him the Marshal. You're going to need the frame. |  | 9.4 s | `assets/vo/wren/c5.wren.cache4b.ogg` |

#### Chapter 6 — Ascent

| ID | Line | Context / performance | Target | File |
|---|---|---|---|---|
| `c6.wren.return` | —allast. Ballast, come in. I've got your beacon. I turned around. | Live again. Through static. She came back. | 5.2 s | `assets/vo/wren/c6.wren.return.ogg` |

### AEGIS-07 (24 lines)

#### Chapter 5 — Aegis

| ID | Line | Context / performance | Target | File |
|---|---|---|---|---|
| `c5.aegis.boot1` | AEGIS-07. Cold start. | System voice: precise, unhurried, not human, not cold. | 1.8 s | `assets/vo/aegis/c5.aegis.boot1.ogg` |
| `c5.aegis.boot2` | Reactor nominal. Hydraulics nominal. |  | 2.2 s | `assets/vo/aegis/c5.aegis.boot2.ogg` |
| `c5.aegis.boot3` | Pilot authorization… rejected. |  | 1.8 s | `assets/vo/aegis/c5.aegis.boot3.ogg` |
| `c5.aegis.boot4` | …Manual. |  | 1.4 s | `assets/vo/aegis/c5.aegis.boot4.ogg` |
| `c5.aegis.boot5` | AEGIS-07 online. | Control returns mid-line. | 1.4 s | `assets/vo/aegis/c5.aegis.boot5.ogg` |
| `c5.aegis.governorOk` | Flight governor installed. Sustained flight available. |  | 2.9 s | `assets/vo/aegis/c5.aegis.governorOk.ogg` |
| `c5.aegis.governorMissing` | Flight governor absent. Jump jets only. |  | 2.9 s | `assets/vo/aegis/c5.aegis.governorMissing.ogg` |
| `c5.aegis.missileOk` | Shoulder rack armed. |  | 1.7 s | `assets/vo/aegis/c5.aegis.missileOk.ogg` |
| `c5.aegis.bladeOk` | Arc blade armed. |  | 1.7 s | `assets/vo/aegis/c5.aegis.bladeOk.ogg` |
| `c5.aegis.noBlade` | Melee: manipulator shove. |  | 1.8 s | `assets/vo/aegis/c5.aegis.noBlade.ogg` |
| `c5.aegis.repair` | Repair station: armor restored. |  | 2.2 s | `assets/vo/aegis/c5.aegis.repair.ogg` |
| `c5.aegis.shelf` | Ice integrity failing. Recommend: speed. | Shelf Run start. | 2.7 s | `assets/vo/aegis/c5.aegis.shelf.ogg` |
| `c5.aegis.storm` | Magnetic storm. Targeting offline. Manual aim. |  | 3.0 s | `assets/vo/aegis/c5.aegis.storm.ogg` |
| `c5.aegis.stormEnd` | Targeting restored. |  | 1.4 s | `assets/vo/aegis/c5.aegis.stormEnd.ogg` |
| `c5.aegis.armLost` | Left arm lost. Rifle transferred to right mount. |  | 3.6 s | `assets/vo/aegis/c5.aegis.armLost.ogg` |
| `c5.aegis.cannonLost` | Shoulder cannon lost. |  | 1.7 s | `assets/vo/aegis/c5.aegis.cannonLost.ogg` |
| `c5.aegis.cradle` | Launch cradle locked. Booster armed. |  | 2.5 s | `assets/vo/aegis/c5.aegis.cradle.ogg` |

#### Chapter 6 — Ascent

| ID | Line | Context / performance | Target | File |
|---|---|---|---|---|
| `c6.aegis.launch` | Booster ignition. |  | 1.4 s | `assets/vo/aegis/c6.aegis.launch.ogg` |
| `c6.aegis.damage` | Hull damage. Mass too high for orbit. |  | 3.3 s | `assets/vo/aegis/c6.aegis.damage.ogg` |
| `c6.aegis.jettisonWeapon` | Jettison: weapons. |  | 1.4 s | `assets/vo/aegis/c6.aegis.jettisonWeapon.ogg` |
| `c6.aegis.jettisonShoulder` | Jettison: shoulder assembly. |  | 1.8 s | `assets/vo/aegis/c6.aegis.jettisonShoulder.ogg` |
| `c6.aegis.jettisonArmor` | Jettison: armor. |  | 1.4 s | `assets/vo/aegis/c6.aegis.jettisonArmor.ogg` |
| `c6.aegis.jettisonBooster` | Booster stage separation. |  | 1.7 s | `assets/vo/aegis/c6.aegis.jettisonBooster.ogg` |
| `c6.aegis.atmo` | Atmosphere: exited. | The last thing before silence. | 1.4 s | `assets/vo/aegis/c6.aegis.atmo.ogg` |

### THE MARSHAL (12 lines)

#### Chapter 5 — Aegis

| ID | Line | Context / performance | Target | File |
|---|---|---|---|---|
| `c5.marshal.intro1` | Halcyon. You stole the one thing on this rock I was told to protect. | Open channel. Professional, tired, respectful. | 5.9 s | `assets/vo/marshal/c5.marshal.intro1.ogg` |
| `c5.marshal.intro2` | My people are on that cradle. It lifts on my word. You're not getting on it. |  | 6.7 s | `assets/vo/marshal/c5.marshal.intro2.ogg` |
| `c5.marshal.intro3` | I know. That's the job. |  | 2.5 s | `assets/vo/marshal/c5.marshal.intro3.ogg` |
| `c5.marshal.p1` | Good. You fly like you mean it. |  | 3.3 s | `assets/vo/marshal/c5.marshal.p1.ogg` |
| `c5.marshal.p2` | Platform's breaking. Neither of us has long. |  | 3.3 s | `assets/vo/marshal/c5.marshal.p2.ogg` |
| `c5.marshal.p2support` | Wardens, on me. Last time, I promise. |  | 3.5 s | `assets/vo/marshal/c5.marshal.p2support.ogg` |
| `c5.marshal.p3` | Give me that cannon. | The grapple. | 2.0 s | `assets/vo/marshal/c5.marshal.p3.ogg` |
| `c5.marshal.p3b` | Now we're even. |  | 1.7 s | `assets/vo/marshal/c5.marshal.p3b.ogg` |
| `c5.marshal.beam` | Hold still. | Overcharge beam. | 1.4 s | `assets/vo/marshal/c5.marshal.beam.ogg` |
| `c5.marshal.hit` | There it is. |  | 1.7 s | `assets/vo/marshal/c5.marshal.hit.ogg` |
| `c5.marshal.death1` | Cradle's yours, Halcyon. | Dying, calm. | 1.8 s | `assets/vo/marshal/c5.marshal.death1.ogg` |
| `c5.marshal.death2` | One of us should get out. Go on. Get out. | His last line. Acknowledges Ballast as the one who got out. | 4.5 s | `assets/vo/marshal/c5.marshal.death2.ogg` |

### HALCYON SYSTEMS (8 lines)

Automated evacuation broadcast. Calm, polite, corporate. Bleakly funny because it is played straight.

#### Chapter 1 — The Job

| ID | Line | Context / performance | Target | File |
|---|---|---|---|---|
| `c1.halcyon.core72` | Halcyon Resource Group. Core Stability: seventy-two percent. All personnel proceed to assigned extraction points. Thank you for your service. | Calm, polite, corporate. Slight PA reverb. | 8.1 s | `assets/vo/halcyon/c1.halcyon.core72.ogg` |
| `c1.halcyon.tremor` | Seismic advisory. Personnel are reminded that extraction schedules are final. |  | 4.4 s | `assets/vo/halcyon/c1.halcyon.tremor.ogg` |

#### Chapter 2 — Left Behind

| ID | Line | Context / performance | Target | File |
|---|---|---|---|---|
| `c2.halcyon.core58` | Core Stability: fifty-eight percent. Extraction schedules are final. Halcyon thanks you for your patience. |  | 6.1 s | `assets/vo/halcyon/c2.halcyon.core58.ogg` |
| `c2.halcyon.revoke` | Operative designation Ballast: credentials revoked. Evacuation complete. Personnel losses are within acceptable parameters. Thank you for your service. | Bleakly funny. Do not play it funny. | 7.7 s | `assets/vo/halcyon/c2.halcyon.revoke.ogg` |

#### Chapter 3 — Dead Colony

| ID | Line | Context / performance | Target | File |
|---|---|---|---|---|
| `c3.halcyon.core41` | Core Stability: forty-one percent. Halcyon facilities on Ilvane are now unstaffed. Please do not contact Halcyon. |  | 6.8 s | `assets/vo/halcyon/c3.halcyon.core41.ogg` |

#### Chapter 4 — Under the Ice

| ID | Line | Context / performance | Target | File |
|---|---|---|---|---|
| `c4.halcyon.core24` | Core Stability: twenty-four percent. This is an automated message. There is no one left to receive your call. | Barely audible, through ice. | 7.6 s | `assets/vo/halcyon/c4.halcyon.core24.ogg` |

#### Chapter 5 — Aegis

| ID | Line | Context / performance | Target | File |
|---|---|---|---|---|
| `c5.halcyon.core11` | Core Stability: eleven percent. | Nothing else. The script has run out of comfort. | 2.2 s | `assets/vo/halcyon/c5.halcyon.core11.ogg` |

#### Chapter 6 — Ascent

| ID | Line | Context / performance | Target | File |
|---|---|---|---|---|
| `c6.halcyon.core2` | Core Stability: two percent. Halcyon Resource Group thanks you for your service. |  | 5.3 s | `assets/vo/halcyon/c6.halcyon.core2.ogg` |

### SABLE (34 lines)

Designed voices. Barks are about their own evacuation — never comic, occasionally human. 2–3 performers; any line may be used by any trooper.

#### Sable barks (all chapters)

| ID | Line | Context / performance | Target | File |
|---|---|---|---|---|
| `sable.idle.seats` | Still no seat number. Third night running. |  | 3.3 s | `assets/vo/sable/sable.idle.seats.ogg` |
| `sable.idle.manifest` | If your name's not on the manifest, you're on the shelf. That's what they said. |  | 6.4 s | `assets/vo/sable/sable.idle.manifest.ogg` |
| `sable.idle.sister` | My sister made the second lift. I think. Comms were down. |  | 4.9 s | `assets/vo/sable/sable.idle.sister.ogg` |
| `sable.idle.lastship` | Last ship goes when the Marshal says. Not before. |  | 4.0 s | `assets/vo/sable/sable.idle.lastship.ogg` |
| `sable.idle.rumor` | Heard Halcyon left half their people. Heard we're doing the same. |  | 4.8 s | `assets/vo/sable/sable.idle.rumor.ogg` |
| `sable.idle.cold` | Can't feel my hands. Can't feel the ground stop shaking either. |  | 4.8 s | `assets/vo/sable/sable.idle.cold.ogg` |
| `sable.idle.count` | They keep doing headcount. Like the number is going to go up. |  | 5.1 s | `assets/vo/sable/sable.idle.count.ogg` |
| `sable.idle.yard` | You can see the yard from here. Doesn't look any closer. |  | 4.8 s | `assets/vo/sable/sable.idle.yard.ogg` |
| `sable.idle.shuttle` | They said the next shuttle. That was four days ago. |  | 4.4 s | `assets/vo/sable/sable.idle.shuttle.ogg` |
| `sable.sus.what` | What was that? |  | 1.7 s | `assets/vo/sable/sable.sus.what.ogg` |
| `sable.sus.movement` | Movement. Hold on. |  | 1.8 s | `assets/vo/sable/sable.sus.movement.ogg` |
| `sable.sus.checking` | Checking it. Stay on comms. |  | 2.5 s | `assets/vo/sable/sable.sus.checking.ogg` |
| `sable.sus.wind` | …Could be the wind. Could be. |  | 3.0 s | `assets/vo/sable/sable.sus.wind.ogg` |
| `sable.hunt.contact` | Contact! Contact! |  | 1.4 s | `assets/vo/sable/sable.hunt.contact.ogg` |
| `sable.hunt.halcyon` | Halcyon operative! He's real! |  | 2.2 s | `assets/vo/sable/sable.hunt.halcyon.ogg` |
| `sable.hunt.flank` | Flank him! Don't let him reach the gate! |  | 3.6 s | `assets/vo/sable/sable.hunt.flank.ogg` |
| `sable.hunt.there` | There! On the ice! |  | 2.2 s | `assets/vo/sable/sable.hunt.there.ogg` |
| `sable.lost.gone` | Lost him. He's a ghost. |  | 2.5 s | `assets/vo/sable/sable.lost.gone.ogg` |
| `sable.lost.spread` | Spread out. He's still here. |  | 2.5 s | `assets/vo/sable/sable.lost.spread.ogg` |
| `sable.lost.notime` | We don't have time for this. |  | 2.8 s | `assets/vo/sable/sable.lost.notime.ogg` |
| `sable.body.down` | Man down! Someone's in the wire! |  | 2.9 s | `assets/vo/sable/sable.body.down.ogg` |
| `sable.body.name` | That's Okafor. That's— somebody is here. |  | 3.0 s | `assets/vo/sable/sable.body.name.ogg` |
| `sable.alarm.panel` | Get to the panel! |  | 2.0 s | `assets/vo/sable/sable.alarm.panel.ogg` |
| `sable.alarm.hitting` | Hitting the alarm! |  | 1.7 s | `assets/vo/sable/sable.alarm.hitting.ogg` |
| `sable.lock.sealed` | Sector sealed. Nobody leaves. |  | 2.2 s | `assets/vo/sable/sable.lock.sealed.ogg` |
| `sable.lock.nobody` | Lockdown's live. Nobody leaves. Including us. |  | 3.0 s | `assets/vo/sable/sable.lock.nobody.ogg` |
| `sable.calm.nothing` | Nothing. Back to post. |  | 2.2 s | `assets/vo/sable/sable.calm.nothing.ogg` |
| `sable.calm.ghosts` | Planet is making ghosts now. Great. |  | 2.9 s | `assets/vo/sable/sable.calm.ghosts.ogg` |
| `sable.hurt.hit` | I'm hit! |  | 1.4 s | `assets/vo/sable/sable.hurt.hit.ogg` |
| `sable.hurt.medic` | Medic— we don't have a medic. |  | 2.9 s | `assets/vo/sable/sable.hurt.medic.ogg` |
| `sable.reinf.inbound` | Reinforcements inbound. Last squad we've got. |  | 2.9 s | `assets/vo/sable/sable.reinf.inbound.ogg` |
| `sable.warden.contact` | Warden two, contact. Large frame. |  | 2.7 s | `assets/vo/sable/sable.warden.contact.ogg` |
| `sable.warden.aegis` | That's AEGIS. Who is flying AEGIS? |  | 2.9 s | `assets/vo/sable/sable.warden.aegis.ogg` |
| `sable.warden.hold` | Hold the line. The cradle lifts on schedule. |  | 3.6 s | `assets/vo/sable/sable.warden.hold.ogg` |

## SFX

| ID | Category | Description | Length | Bus | File |
|---|---|---|---|---|---|
| `foot.snow` | ballast | Boot into packed snow, crunchy, 4 variations | 0.25 s | sfx | `assets/sfx/foot_snow.ogg` |
| `foot.ice` | ballast | Boot on clear ice, hard tick with slight skid | 0.2 s | sfx | `assets/sfx/foot_ice.ogg` |
| `foot.metal` | ballast | Boot on grated steel deck | 0.2 s | sfx | `assets/sfx/foot_metal.ogg` |
| `foot.water` | ballast | Boot splash in ankle-deep water | 0.35 s | sfx | `assets/sfx/foot_water.ogg` |
| `breath.calm` | ballast | Helmeted breath, slow, filtered | 3 s | sfx | `assets/sfx/breath_calm.ogg` |
| `breath.exert` | ballast | Helmeted breath after sprint | 2.5 s | sfx | `assets/sfx/breath_exert.ogg` |
| `breath.hurt` | ballast | Ragged breath below 30 HP | 2.5 s | sfx | `assets/sfx/breath_hurt.ogg` |
| `takedown.hit` | ballast | Muffled body impact + armour crunch, silent to enemies | 0.5 s | sfx | `assets/sfx/takedown_hit.ogg` |
| `takedown.chain` | ballast | Shorter, sharper impact for chain | 0.4 s | sfx | `assets/sfx/takedown_chain.ogg` |
| `slide` | ballast | Body sliding on snow/ice | 0.6 s | sfx | `assets/sfx/slide.ogg` |
| `mantle` | ballast | Hands on ledge, gear rattle, push-up grunt | 0.45 s | sfx | `assets/sfx/mantle.ogg` |
| `gear.rattle` | ballast | Webbing and mag pouches settling | 0.3 s | sfx | `assets/sfx/gear_rattle.ogg` |
| `land` | ballast | Drop landing thump | 0.3 s | sfx | `assets/sfx/land.ogg` |
| `sidearm.fire` | weapons | Suppressed pistol: thock + slide | 0.35 s | sfx | `assets/sfx/sidearm_fire.ogg` |
| `carbine.fire` | weapons | Sable carbine: loud crack, mid tail | 0.5 s | sfx | `assets/sfx/carbine_fire.ogg` |
| `shotgun.fire` | weapons | Breacher: big boom, long tail | 0.9 s | sfx | `assets/sfx/shotgun_fire.ogg` |
| `reload` | weapons | Mag out / mag in / charge | 1.4 s | sfx | `assets/sfx/reload.ogg` |
| `empty` | weapons | Dry fire click | 0.15 s | sfx | `assets/sfx/empty.ogg` |
| `shell.ice` | weapons | Brass bouncing on ice | 0.4 s | sfx | `assets/sfx/shell_ice.ogg` |
| `hit.flesh` | weapons | Round hitting armoured body | 0.2 s | sfx | `assets/sfx/hit_flesh.ogg` |
| `hit.world` | weapons | Round into ice/steel | 0.2 s | sfx | `assets/sfx/hit_world.ogg` |
| `throw` | weapons | Throw whoosh | 0.3 s | sfx | `assets/sfx/throw.ogg` |
| `flash.bang` | weapons | Flash charge detonation, bright crack | 0.9 s | sfx | `assets/sfx/flash_bang.ogg` |
| `decoy.ping` | weapons | Decoy emitting footstep/voice noise | 1.2 s | sfx | `assets/sfx/decoy_ping.ogg` |
| `sting.suspicious` | stealth | Soft rising tension sting | 1.2 s | sfx | `assets/sfx/sting_suspicious.ogg` |
| `sting.hunted` | stealth | Hard hit sting, alarm brass | 1.4 s | sfx | `assets/sfx/sting_hunted.ogg` |
| `siren.lockdown` | stealth | Sable lockdown siren, two-tone | 3 s | sfx | `assets/sfx/siren_lockdown.ogg` |
| `gate.slam` | stealth | Heavy gate slamming shut | 1.2 s | sfx | `assets/sfx/gate_slam.ogg` |
| `alarm.pulse` | stealth | Alarm panel arming pulse (red) | 0.8 s | sfx | `assets/sfx/alarm_pulse.ogg` |
| `hack.tick` | stealth | Gate console hacking ticks (loud) | 0.3 s | sfx | `assets/sfx/hack_tick.ogg` |
| `visor.pulse` | stealth | Recon visor sonar pulse | 1.2 s | sfx | `assets/sfx/visor_pulse.ogg` |
| `rumble.bed` | collapse | Deep planetary rumble bed, loopable | 8 s | ambience | `assets/sfx/rumble_bed.ogg` |
| `ice.crack.near` | collapse | Close ice crack | 1.5 s | sfx | `assets/sfx/ice_crack_near.ogg` |
| `ice.crack.far` | collapse | Distant ice crack | 2.5 s | sfx | `assets/sfx/ice_crack_far.ogg` |
| `structure.groan` | collapse | Metal structure groan | 2.5 s | sfx | `assets/sfx/structure_groan.ogg` |
| `debris.whistle` | collapse | Incoming debris whistle | 1.5 s | sfx | `assets/sfx/debris_whistle.ogg` |
| `debris.impact` | collapse | Debris impact explosion | 1.8 s | sfx | `assets/sfx/debris_impact.ogg` |
| `shelf.tilt` | collapse | Deep shelf tilt groan | 3 s | sfx | `assets/sfx/shelf_tilt.ogg` |
| `steam.vent` | collapse | Steam vent hiss | 3 s | sfx | `assets/sfx/steam_vent.ogg` |
| `aurora.flare` | collapse | Static wash, sky brighten | 1.5 s | sfx | `assets/sfx/aurora_flare.ogg` |
| `cache.chime` | cache | Amber cache chime (Ava) | 1 s | sfx | `assets/sfx/cache_chime.ogg` |
| `cache.click` | cache | Recording click-in | 0.3 s | sfx | `assets/sfx/cache_click.ogg` |
| `cache.hiss` | cache | Tape hiss bed under recordings | 4 s | sfx | `assets/sfx/cache_hiss.ogg` |
| `mech.servo` | aegis | Servo whine | 0.6 s | sfx | `assets/sfx/mech_servo.ogg` |
| `mech.step` | aegis | Heavy footfall crushing ice | 0.8 s | sfx | `assets/sfx/mech_step.ogg` |
| `mech.boost` | aegis | Quick boost ignition | 0.6 s | sfx | `assets/sfx/mech_boost.ogg` |
| `mech.assault` | aegis | Assault boost roar (loop) | 3 s | sfx | `assets/sfx/mech_assault.ogg` |
| `mech.lock` | aegis | Lock tone | 0.3 s | ui | `assets/sfx/mech_lock.ogg` |
| `mech.rifle` | aegis | Frame rifle shot | 0.4 s | sfx | `assets/sfx/mech_rifle.ogg` |
| `mech.cannon` | aegis | Shoulder cannon boom | 1.6 s | sfx | `assets/sfx/mech_cannon.ogg` |
| `mech.missile` | aegis | Missile launch | 0.8 s | sfx | `assets/sfx/mech_missile.ogg` |
| `mech.blade` | aegis | Arc blade ignite + swing | 0.6 s | sfx | `assets/sfx/mech_blade.ogg` |
| `mech.shove` | aegis | Mech shove impact | 0.5 s | sfx | `assets/sfx/mech_shove.ogg` |
| `mech.alarm` | aegis | Cockpit damage alarm | 1 s | ui | `assets/sfx/mech_alarm.ogg` |
| `mech.systemloss` | aegis | System loss tone | 1 s | ui | `assets/sfx/mech_systemloss.ogg` |
| `mech.explosion` | aegis | Mech-scale explosion | 2.4 s | sfx | `assets/sfx/mech_explosion.ogg` |
| `ascent.roar` | ascent | Booster roar (loop) | 4 s | sfx | `assets/sfx/ascent_roar.ogg` |
| `ascent.buffet` | ascent | Atmospheric buffet | 2 s | sfx | `assets/sfx/ascent_buffet.ogg` |
| `ascent.jettison` | ascent | Jettison clunk + separation | 1.2 s | sfx | `assets/sfx/ascent_jettison.ogg` |
| `ascent.debris` | ascent | Debris impact on hull | 0.6 s | sfx | `assets/sfx/ascent_debris.ogg` |
| `cockpit.breath` | ascent | Cockpit breathing (near-silent ending) | 6 s | sfx | `assets/sfx/cockpit_breath.ogg` |
| `reactor.tick` | ascent | Dying reactor tick | 1 s | sfx | `assets/sfx/reactor_tick.ogg` |
| `ui.tick` | ui | Menu move tick | 0.08 s | ui | `assets/sfx/ui_tick.ogg` |
| `ui.confirm` | ui | Menu confirm | 0.25 s | ui | `assets/sfx/ui_confirm.ogg` |
| `ui.back` | ui | Menu back | 0.2 s | ui | `assets/sfx/ui_back.ogg` |
| `ui.title` | ui | Chapter title hit | 2.5 s | ui | `assets/sfx/ui_title.ogg` |
| `ui.ping` | ui | Objective ping | 0.6 s | ui | `assets/sfx/ui_ping.ogg` |
| `ui.checkpoint` | ui | Checkpoint saved | 0.5 s | ui | `assets/sfx/ui_checkpoint.ogg` |
| `enemy.shot` | enemy | Sable rifle shot (distinct from carbine) | 0.4 s | sfx | `assets/sfx/enemy_shot.ogg` |
| `enemy.glint` | enemy | Muzzle glint telegraph tick | 0.3 s | sfx | `assets/sfx/enemy_glint.ogg` |
| `enemy.lmg` | enemy | Heavy LMG burst | 0.9 s | sfx | `assets/sfx/enemy_lmg.ogg` |
| `enemy.drone` | enemy | Drone hum (loop) | 2 s | sfx | `assets/sfx/enemy_drone.ogg` |
| `enemy.hound` | enemy | Hound servo snarl | 0.8 s | sfx | `assets/sfx/enemy_hound.ogg` |
| `enemy.death` | enemy | Body drop on snow | 0.6 s | sfx | `assets/sfx/enemy_death.ogg` |
| `enemy.flare` | enemy | Spotter flare launch | 1.2 s | sfx | `assets/sfx/enemy_flare.ogg` |
| `enemy.rocket` | enemy | Warden rocket launch | 1 s | sfx | `assets/sfx/enemy_rocket.ogg` |

## Music cues

| ID | Use | Length | Loop | File |
|---|---|---|---|---|
| `infiltration` | Unseen exploration (low pulse) | 64 s | yes | `assets/music/infiltration.ogg` |
| `suspicion` | Adds tension stem | 64 s | yes | `assets/music/suspicion.ogg` |
| `hunted` | Full percussion stem | 64 s | yes | `assets/music/hunted.ogg` |
| `lockdown` | Siren-synced rhythm | 32 s | yes | `assets/music/lockdown.ogg` |
| `collapse` | One-shot, ducks the bed | 4 s | no | `assets/music/collapse.ogg` |
| `timedZone` | Driving tempo, accelerates at 30 s and 10 s | 48 s | yes | `assets/music/timedZone.ogg` |
| `wren` | Solo instrument; under recordings and the final scene | 90 s | yes | `assets/music/wren.ogg` |
| `aegis` | Full theme, first played at boot-up | 96 s | yes | `assets/music/aegis.ogg` |
| `marshal1` | Boss theme stage 1 | 64 s | yes | `assets/music/marshal1.ogg` |
| `marshal2` | Boss theme stage 2 | 64 s | yes | `assets/music/marshal2.ogg` |
| `marshal3` | Boss theme stage 3 | 64 s | yes | `assets/music/marshal3.ogg` |
| `ascent` | Builds, then cuts to silence at the atmosphere break | 120 s | no | `assets/music/ascent.ogg` |
| `credits` | Ava theme, full arrangement | 150 s | no | `assets/music/credits.ogg` |
| `title` | Title: planet cracking, sparse | 120 s | yes | `assets/music/title.ogg` |

### Adaptive stems

The infiltration bed carries three additive stems driven by the alert ladder: **suspicion** (tension), **hunted** (full percussion), **lockdown** (siren-synced rhythm). Deliver `infiltration`, `suspicion`, `hunted` and `lockdown` as separate loops of identical length and tempo (paths above); the engine starts them on the same clock and fades the stems with the alert level. The Timed Zone cue accelerates at 30 s and 10 s (the engine raises playback tempo; deliver at 128 BPM). The Marshal theme has three intensity stages (`marshal1..3`). The Ascent cue must be cut to silence at the atmosphere break (the mix drops to −60 dB over 0.4 s; only `cockpit.breath` and `reactor.tick` remain).
