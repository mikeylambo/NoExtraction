import { L, P } from './lines';

/** Chapter 2 — Left Behind (58%). */
export const LINES = [
  L('c2.halcyon.core58', 'halcyon', 'Core Stability: fifty-eight percent. Extraction schedules are final. Halcyon thanks you for your patience.', P.broadcast),
  L('c2.wren.alarm', 'wren', "They found the governor gone. The whole complex is waking up. Stay off their panels — if one of them reaches an alarm, every fast gate in the sector seals.", P.story, 'Urgent, still in control.'),
  L('c2.ballast.alarm', 'ballast', 'Copy. Quiet.', P.reply),
  L('c2.wren.carbine', 'wren', "Weapons rack by the motor pool. Sable carbine. Loud — anyone who hears it comes for you.", P.story),
  L('c2.wren.armory', 'wren', "Armory's off the east road. Not on the way. If you're feeling greedy.", P.story, 'Knowing him.'),
  L('c2.ballast.missileRack', 'ballast', "Missile rack. Somebody's going to miss this.", P.reply),
  L('c2.wren.window', 'wren', "Ballast, the window's closing. Where are you?", P.critical, 'First crack of real worry.'),
  L('c2.ballast.bridge', 'ballast', 'Bridge. Ninety seconds. Hold it.', P.reply, 'Running, breathing hard.'),
  L('c2.wren.climbing', 'wren', "I can't. The window's closed. I'm lifting. Ballast, I'm— policy. I'm sorry.", P.critical, 'She hates every word.'),
  L('c2.ballast.wait', 'ballast', 'Wren. Wren! I am on the bridge!', P.critical, 'Furious. Breathless.'),
  L('c2.halcyon.revoke', 'halcyon', 'Operative designation Ballast: credentials revoked. Evacuation complete. Personnel losses are within acceptable parameters. Thank you for your service.', P.broadcast, 'Bleakly funny. Do not play it funny.'),
  L('c2.ballast.pad1', 'ballast', 'Four minutes. I was four minutes late.', P.reply, 'Quiet. Disbelief.'),
  L('c2.ballast.pad2', 'ballast', 'Acceptable parameters. Sure.', P.reply, 'Talking back to the PA.'),
  L('c2.ballast.quake', 'ballast', 'Oh, come on—', P.critical, 'The ground goes out from under him.'),
  L('c2.wren.cache1a', 'wren', "If you're hearing this, I left. On schedule. You know the policy, and you know I follow it.", P.recording, 'Recorded before lift-off. Steady, rehearsed, fragile underneath.'),
  L('c2.wren.cache1b', 'wren', 'Sable has one launch cradle left, at their yard. Past the dead colony, under the ice. I flew the route twice. I left you things along it.', P.recording),
  L('c2.wren.cache1c', 'wren', "Amber light. You'll know. Don't make me regret this.", P.recording),
  L('c2.ballast.cache1reply', 'ballast', 'You left me a voicemail. You left me a voicemail and a flashlight.', P.reply, 'To a recording that cannot hear him.'),
  L('c2.ballast.yard', 'ballast', "Sable's yard. Fine. Fine.", P.reply, 'Looking at the horizon.'),
  L('c2.ballast.bridgeFail', 'ballast', 'Not like this.', P.reply),
];
