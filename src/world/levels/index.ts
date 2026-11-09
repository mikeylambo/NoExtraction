import type { LevelDef } from '../Level';
import { CH1 } from './ch1';
import { CH2 } from './ch2';
import { CH3 } from './ch3';
import { CH4 } from './ch4';
import { CH5 } from './ch5';
export const LEVELS: Record<string, LevelDef> = { ch1: CH1, ch2: CH2, ch3: CH3, ch4: CH4, ch5: CH5 };
