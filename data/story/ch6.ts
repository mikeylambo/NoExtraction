import { L, P } from './lines';

/** Chapter 6 — Ascent (2% → 0%). */
export const LINES = [
  L('c6.halcyon.core2', 'halcyon', 'Core Stability: two percent. Halcyon Resource Group thanks you for your service.', P.broadcast),
  L('c6.aegis.launch', 'aegis', 'Booster ignition.', P.aegis),
  L('c6.ballast.launch', 'ballast', 'Come on. Come on—', P.reply, 'Under 4G.'),
  L('c6.aegis.damage', 'aegis', 'Hull damage. Mass too high for orbit.', P.aegis),
  L('c6.aegis.jettisonWeapon', 'aegis', 'Jettison: weapons.', P.aegis),
  L('c6.aegis.jettisonShoulder', 'aegis', 'Jettison: shoulder assembly.', P.aegis),
  L('c6.aegis.jettisonArmor', 'aegis', 'Jettison: armor.', P.aegis),
  L('c6.aegis.jettisonBooster', 'aegis', 'Booster stage separation.', P.aegis),
  L('c6.ballast.jettison1', 'ballast', 'Take it. Take all of it.', P.reply),
  L('c6.ballast.jettison3', 'ballast', 'Dump the weight. That is what I am for.', P.reply, 'Almost a laugh. He finally owns the name.'),
  L('c6.aegis.atmo', 'aegis', 'Atmosphere: exited.', P.aegis, 'The last thing before silence.'),
  L('c6.ballast.drift', 'ballast', '…Huh.', P.reply, 'In the silence. Barely breath.'),
  L('c6.wren.return', 'wren', "—allast. Ballast, come in. I've got your beacon. I turned around.", P.critical, 'Live again. Through static. She came back.'),
  L('c6.ballast.final', 'ballast', '…You’re late.', P.critical, 'Final line. Dry. Exhausted. One take.', {
    alt: [{ file: 'assets/vo/ballast/c6.ballast.final.warm.ogg', when: 'allPersonalCaches', text: '…You’re late.' }],
  }),
];
