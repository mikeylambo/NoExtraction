import { L, P } from './lines';

/** Chapter 3 — Dead Colony (41%). */
export const LINES = [
  L('c3.halcyon.core41', 'halcyon', 'Core Stability: forty-one percent. Halcyon facilities on Ilvane are now unstaffed. Please do not contact Halcyon.', P.broadcast),
  L('c3.ballast.open', 'ballast', 'Dead colony. Of course it is.', P.reply),
  L('c3.ballast.shotgun', 'ballast', 'Breacher. Doors are a suggestion now.', P.reply),
  L('c3.ballast.weakDoor', 'ballast', "That door's had a hard week.", P.reply, 'Hint: weakened doors open with the breacher.'),
  L('c3.ballast.collapseTool', 'ballast', 'That tower is coming down. Make it count.', P.reply, 'Hint: lure them under it.'),
  L('c3.wren.cache2a', 'wren', 'The colony has been empty six days. Sable pulled out and left their own people at the mast. I bounced this off it.', P.recording),
  L('c3.wren.cache2b', 'wren', 'The freight lift goes down to the core conduits — the only way under the ridge. And the cargo never shipped, Ballast. Everything we sent down the tube is stuck in that shaft. Including your souvenir.', P.recording),
  L('c3.ballast.cache2reply', 'ballast', 'My governor. You sent me back for my own governor.', P.reply),
  L('c3.wren.pc1a', 'wren', "This one's not on the route. You always check the corners. I thought you'd find it.", P.recording, 'Personal. Softer.'),
  L('c3.wren.pc1b', 'wren', "Cargo bay in the lift shaft. If you want that frame to fly instead of hop, the governor's in there. The shaft floods when the pumps go. Be fast.", P.recording),
  L('c3.ballast.pc1reply', 'ballast', 'Fly instead of hop. Noted.', P.reply),
  L('c3.wren.pc2a', 'wren', 'Remember Kessel Station? You carried me two kilometres because I said my ankle was fine.', P.recording, 'Remembering. Almost laughing.'),
  L('c3.wren.pc2b', 'wren', "It wasn't fine. You knew. You didn't say anything. You never say anything.", P.recording),
  L('c3.ballast.pc2reply', 'ballast', '…It was three kilometres.', P.reply),
  L('c3.ballast.freightLift', 'ballast', 'Pumps are failing. Water is coming up the shaft.', P.critical, 'Timed Zone start.'),
  L('c3.ballast.governor', 'ballast', 'Hello again.', P.reply, 'To the governor.'),
  L('c3.ballast.liftDown', 'ballast', 'Going down.', P.reply),
  L('c3.ballast.liftFlood', 'ballast', "Too slow. Again.", P.reply),
];
