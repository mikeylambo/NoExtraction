/** Chapter structure & results grading — GDD §8 (Slice column). */
export interface ChapterDef {
  id: string;
  number: number;
  title: string;
  minutes: number;
  introduces: string;
  setPiece: string;
  core: number;
  onFoot: boolean;
  /** Grading targets. */
  par: { seconds: number; takedownsForS: number };
}

export const CHAPTERS: ChapterDef[] = [
  { id: 'ch1', number: 1, title: 'The Job', minutes: 10, introduces: 'Movement, takedown, chains, visor, alert ladder, Fast vs Long Route', setPiece: 'Silent sabotage of FLAMINGO-07', core: 72, onFoot: true, par: { seconds: 600, takedownsForS: 6 } },
  { id: 'ch2', number: 2, title: 'Left Behind', minutes: 8, introduces: 'Lockdown, carbine, first Timed Zone, first story cache', setPiece: 'The Pad', core: 58, onFoot: true, par: { seconds: 480, takedownsForS: 5 } },
  { id: 'ch3', number: 3, title: 'Dead Colony', minutes: 12, introduces: 'Shotgun, alternate routes, collapse events as tools, personal caches', setPiece: 'Freight Lift', core: 41, onFoot: true, par: { seconds: 720, takedownsForS: 6 } },
  { id: 'ch4', number: 4, title: 'Under the Ice', minutes: 8, introduces: 'Darkness + visor reliance, Heavies, water hazards', setPiece: 'Conduit Flood', core: 24, onFoot: true, par: { seconds: 480, takedownsForS: 4 } },
  { id: 'ch5', number: 5, title: 'Flamingo', minutes: 15, introduces: 'Mech boot-up and full mech kit', setPiece: 'The Marshal', core: 11, onFoot: false, par: { seconds: 900, takedownsForS: 0 } },
  { id: 'ch6', number: 6, title: 'Ascent', minutes: 7, introduces: 'Ascent flight, jettison', setPiece: 'Break atmosphere', core: 2, onFoot: false, par: { seconds: 420, takedownsForS: 0 } },
];

export const chapterById = (id: string) => CHAPTERS.find((c) => c.id === id)!;

export interface ChapterStats {
  seconds: number;
  lockdowns: number;
  takedowns: number;
  cachesFound: number;
  cachesTotal: number;
  componentsSecured: number;
  componentsAvailable: number;
  deaths: number;
}

export type Grade = 'S' | 'A' | 'B' | 'C';
const GRADE_ORDER: Grade[] = ['C', 'B', 'A', 'S'];
export const betterGrade = (a: Grade | undefined, b: Grade): Grade => (!a ? b : GRADE_ORDER.indexOf(b) > GRADE_ORDER.indexOf(a) ? b : a);

/**
 * Points: time (40), quiet (30: no lockdowns), caches (15), components (15). Takedowns add a
 * small bonus on stealth chapters. S ≥ 85, A ≥ 70, B ≥ 50, else C.
 */
export function gradeChapter(def: ChapterDef, s: ChapterStats): { grade: Grade; score: number } {
  const timeScore = 40 * Math.max(0, Math.min(1, 1.5 - s.seconds / def.par.seconds));
  const quietScore = def.onFoot ? Math.max(0, 30 - s.lockdowns * 15) : Math.max(0, 30 - s.deaths * 8);
  const cacheScore = s.cachesTotal ? (15 * s.cachesFound) / s.cachesTotal : 15;
  const compScore = s.componentsAvailable ? (15 * s.componentsSecured) / s.componentsAvailable : 15;
  const tdBonus = def.par.takedownsForS ? Math.min(5, (5 * s.takedowns) / def.par.takedownsForS) : 0;
  const score = Math.round(Math.min(100, timeScore + quietScore + cacheScore + compScore + tdBonus));
  const grade: Grade = score >= 85 ? 'S' : score >= 70 ? 'A' : score >= 50 ? 'B' : 'C';
  return { grade, score };
}
