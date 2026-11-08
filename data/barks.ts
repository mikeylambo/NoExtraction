/** Sable barks — they talk about their own evacuation. Never comic, occasionally human. */
export type BarkSituation = 'idle' | 'suspicious' | 'hunted' | 'lostTarget' | 'bodyFound' | 'alarm' | 'lockdown' | 'calm' | 'hurt' | 'reinforce' | 'warden';
export const BARKS: Record<BarkSituation, string[]> = {
  idle: ['sable.idle.seats', 'sable.idle.manifest', 'sable.idle.sister', 'sable.idle.lastship', 'sable.idle.rumor', 'sable.idle.cold', 'sable.idle.count', 'sable.idle.yard', 'sable.idle.shuttle'],
  suspicious: ['sable.sus.what', 'sable.sus.movement', 'sable.sus.checking', 'sable.sus.wind'],
  hunted: ['sable.hunt.contact', 'sable.hunt.halcyon', 'sable.hunt.flank', 'sable.hunt.there'],
  lostTarget: ['sable.lost.gone', 'sable.lost.spread', 'sable.lost.notime'],
  bodyFound: ['sable.body.down', 'sable.body.name'],
  alarm: ['sable.alarm.panel', 'sable.alarm.hitting'],
  lockdown: ['sable.lock.sealed', 'sable.lock.nobody'],
  calm: ['sable.calm.nothing', 'sable.calm.ghosts'],
  hurt: ['sable.hurt.hit', 'sable.hurt.medic'],
  reinforce: ['sable.reinf.inbound'],
  warden: ['sable.warden.contact', 'sable.warden.aegis', 'sable.warden.hold'],
};
export const BARK_COOLDOWN_S = 90;
