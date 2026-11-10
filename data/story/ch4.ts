import { L, P } from './lines';

/** Chapter 4 — Under the Ice (24%). */
export const LINES = [
  L('c4.halcyon.core24', 'halcyon', 'Core Stability: twenty-four percent. This is an automated message. There is no one left to receive your call.', P.broadcast, 'Barely audible, through ice.'),
  L('c4.ballast.dark', 'ballast', "Can't see a thing. Visor it is.", P.reply),
  L('c4.ballast.heavy', 'ballast', "Heavy. Don't trade with that. Get behind it.", P.reply),
  L('c4.ballast.hounds', 'ballast', 'Hounds. They hunt by sound. Walk.', P.reply, 'Whispered.'),
  L('c4.ballast.water', 'ballast', "Water's rising.", P.critical),
  L('c4.wren.cache3a', 'wren', "Under the ice is Sable's conduit network. It runs to their forward depot, right under the yard.", P.recording),
  L('c4.wren.cache3b', 'wren', "The core is bleeding into the water down there. If it starts rising, don't think. Run.", P.recording),
  L('c4.ballast.cache3reply', 'ballast', "Don't think. Run. Your best advice in eleven years.", P.reply),
  L('c4.wren.pc3a', 'wren', 'Maintenance bay, past the pump hall. Sable keeps frame tools there.', P.recording),
  L('c4.wren.pc3b', 'wren', "There's an arc blade on the rack. You always liked getting close. Don't get too close.", P.recording),
  L('c4.ballast.pc3reply', 'ballast', 'Little late for that.', P.reply),
  L('c4.wren.pc4a', 'wren', 'Last one. I nearly didn’t leave it.', P.recording, 'Very quiet. This is the one she was afraid to record.'),
  L('c4.wren.pc4b', 'wren', "They named you Ballast because you're the weight they drop so the ship can rise. I never called you that. Not once.", P.recording),
  L('c4.wren.pc4c', 'wren', 'Come home, Teo.', P.recording, 'Ballast’s real name, said once.'),
  L('c4.ballast.pc4reply', 'ballast', "…Nobody's called me that in a long time.", P.reply),
  L('c4.ballast.arcBlade', 'ballast', 'Arc blade. Sorry, Sable.', P.reply),
  L('c4.ballast.conduit', 'ballast', 'Here it comes.', P.critical, 'Conduit Flood start.'),
  L('c4.ballast.depot', 'ballast', 'Forward depot. And— no way.', P.reply, 'He sees FLAMINGO-07.'),
];
