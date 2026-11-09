import { BrowserInputSource, InputManager, PointerLook, BrowserInputFamilyDetector, type InputBinding } from '@slu/web-shell';
import type { GameOptions } from '../../data/options';

/** Pad button indices (standard mapping). */
export const PAD = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, SELECT: 8, START: 9, L3: 10, R3: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 } as const;

export interface ActionDef { action: string; label: string; keys: string[]; mouse?: number[]; pad?: number[]; axes?: InputBinding['gamepadAxes']; rebindable?: boolean; context: 'foot' | 'mech' | 'both' | 'ui' }

/** Default bindings — GDD §3 and §7 control tables. */
export const ACTIONS: ActionDef[] = [
  { action: 'move_f', label: 'Move forward', keys: ['KeyW'], axes: [{ axis: 1, direction: -1, threshold: 0.12 }], rebindable: true, context: 'both' },
  { action: 'move_b', label: 'Move back', keys: ['KeyS'], axes: [{ axis: 1, direction: 1, threshold: 0.12 }], rebindable: true, context: 'both' },
  { action: 'move_l', label: 'Move left', keys: ['KeyA'], axes: [{ axis: 0, direction: -1, threshold: 0.12 }], rebindable: true, context: 'both' },
  { action: 'move_r', label: 'Move right', keys: ['KeyD'], axes: [{ axis: 0, direction: 1, threshold: 0.12 }], rebindable: true, context: 'both' },
  { action: 'look_l', label: 'Look left', keys: [], axes: [{ axis: 2, direction: -1, threshold: 0.1 }], context: 'both' },
  { action: 'look_r', label: 'Look right', keys: [], axes: [{ axis: 2, direction: 1, threshold: 0.1 }], context: 'both' },
  { action: 'look_u', label: 'Look up', keys: [], axes: [{ axis: 3, direction: -1, threshold: 0.1 }], context: 'both' },
  { action: 'look_d', label: 'Look down', keys: [], axes: [{ axis: 3, direction: 1, threshold: 0.1 }], context: 'both' },
  { action: 'sprint', label: 'Sprint', keys: ['ShiftLeft', 'ShiftRight'], pad: [PAD.L3], rebindable: true, context: 'foot' },
  { action: 'crouch', label: 'Crouch / Slide', keys: ['KeyC', 'ControlLeft'], pad: [PAD.B], rebindable: true, context: 'foot' },
  { action: 'jump', label: 'Vault / Mantle / Interact', keys: ['Space'], pad: [PAD.A], rebindable: true, context: 'foot' },
  { action: 'interact', label: 'Interact', keys: ['KeyE'], pad: [PAD.A], rebindable: true, context: 'foot' },
  { action: 'takedown', label: 'Takedown', keys: ['KeyF'], pad: [PAD.X], rebindable: true, context: 'foot' },
  { action: 'aim', label: 'Aim', keys: [], mouse: [2], pad: [PAD.LT], rebindable: true, context: 'foot' },
  { action: 'fire', label: 'Fire', keys: [], mouse: [0], pad: [PAD.RT], rebindable: true, context: 'foot' },
  { action: 'reload', label: 'Reload (pad: tap) / Swap (pad: hold)', keys: ['KeyR'], pad: [PAD.Y], rebindable: true, context: 'foot' },
  { action: 'weapon1', label: 'Weapon 1', keys: ['Digit1'], rebindable: true, context: 'foot' },
  { action: 'weapon2', label: 'Weapon 2', keys: ['Digit2'], rebindable: true, context: 'foot' },
  { action: 'weapon3', label: 'Weapon 3', keys: ['Digit3'], rebindable: true, context: 'foot' },
  { action: 'throw', label: 'Throwable', keys: ['KeyG'], pad: [PAD.RB], rebindable: true, context: 'foot' },
  { action: 'throwCycle', label: 'Cycle throwable', keys: ['KeyT'], pad: [PAD.RIGHT], rebindable: true, context: 'foot' },
  { action: 'scan', label: 'Scan (Recon visor)', keys: ['KeyQ'], pad: [PAD.LB], rebindable: true, context: 'foot' },
  { action: 'ping', label: 'Objective ping', keys: ['Tab'], pad: [PAD.UP], rebindable: true, context: 'both' },
  { action: 'stim', label: 'Use stim', keys: ['KeyH'], pad: [PAD.DOWN], rebindable: true, context: 'foot' },
  { action: 'shoulder', label: 'Swap shoulder', keys: ['KeyV'], pad: [PAD.LEFT], rebindable: true, context: 'foot' },
  // mech (GDD §7)
  { action: 'm_boost', label: 'Quick boost (tap) / Assault boost (hold)', keys: ['ShiftLeft', 'ShiftRight'], pad: [PAD.B], rebindable: true, context: 'mech' },
  { action: 'm_jets', label: 'Jump / jets / flight', keys: ['Space'], pad: [PAD.A], rebindable: true, context: 'mech' },
  { action: 'm_descend', label: 'Descend', keys: ['KeyC', 'ControlLeft'], pad: [PAD.DOWN], rebindable: true, context: 'mech' },
  { action: 'm_lock', label: 'Hard lock', keys: ['KeyZ'], mouse: [1], pad: [PAD.R3], rebindable: true, context: 'mech' },
  { action: 'm_rifle', label: 'Rifle', keys: [], mouse: [0], pad: [PAD.RT], rebindable: true, context: 'mech' },
  { action: 'm_blade', label: 'Blade / shove', keys: [], mouse: [2], pad: [PAD.LT], rebindable: true, context: 'mech' },
  { action: 'm_missiles', label: 'Missiles', keys: ['KeyQ'], pad: [PAD.LB], rebindable: true, context: 'mech' },
  { action: 'm_cannon', label: 'Shoulder cannon', keys: ['KeyE'], pad: [PAD.RB], rebindable: true, context: 'mech' },
  // system
  { action: 'pause', label: 'Pause', keys: ['Escape', 'KeyP'], pad: [PAD.START], context: 'both' },
  { action: 'skip', label: 'Skip (hold)', keys: ['Space', 'Enter'], pad: [PAD.A], context: 'both' },
  { action: 'dev', label: 'Dev panel', keys: ['Backquote'], context: 'both' },
  { action: 'ui_up', label: 'Up', keys: ['ArrowUp', 'KeyW'], pad: [PAD.UP], axes: [{ axis: 1, direction: -1, threshold: 0.6 }], context: 'ui' },
  { action: 'ui_down', label: 'Down', keys: ['ArrowDown', 'KeyS'], pad: [PAD.DOWN], axes: [{ axis: 1, direction: 1, threshold: 0.6 }], context: 'ui' },
  { action: 'ui_left', label: 'Left', keys: ['ArrowLeft', 'KeyA'], pad: [PAD.LEFT], axes: [{ axis: 0, direction: -1, threshold: 0.6 }], context: 'ui' },
  { action: 'ui_right', label: 'Right', keys: ['ArrowRight', 'KeyD'], pad: [PAD.RIGHT], axes: [{ axis: 0, direction: 1, threshold: 0.6 }], context: 'ui' },
  { action: 'ui_accept', label: 'Accept', keys: ['Enter', 'Space'], pad: [PAD.A], context: 'ui' },
  { action: 'ui_back', label: 'Back', keys: ['Escape', 'Backspace'], pad: [PAD.B], context: 'ui' },
];

/** Edge-latched per-sim-step input state. */
export interface InputFrame {
  moveX: number; moveZ: number; lookX: number; lookY: number;
  down: Set<string>; pressed: Set<string>; released: Set<string>;
  /** Seconds each action has been held. */
  held: Map<string, number>;
  wheel: number;
  pad: boolean;
}

/**
 * Game input: the shell's InputManager + BrowserInputSource (keyboard / mouse buttons / gamepad)
 * and PointerLook (mouse deltas), merged into semantic per-step frames. Edges are latched so a
 * press during hitstop or between fixed steps is never lost.
 */
export class GameInput {
  readonly manager = new InputManager();
  private source: BrowserInputSource;
  private detach: () => void = () => {};
  readonly look: PointerLook;
  readonly family = new BrowserInputFamilyDetector({});
  private pendingPressed = new Set<string>();
  private pendingReleased = new Set<string>();
  private heldTime = new Map<string, number>();
  private wheelAcc = 0;
  private bindings: InputBinding[] = [];
  /** Scripted input for the bot: overrides devices when set. */
  scripted: { move: [number, number]; look: [number, number]; down: Set<string> } | null = null;
  private scriptedPrev = new Set<string>();
  sens = { mouse: 0.0022, pad: 3.1, invertY: false };

  constructor(readonly canvas: HTMLCanvasElement, options: GameOptions) {
    this.bindings = this.buildBindings(options);
    this.manager.setBindings(this.bindings);
    this.source = new BrowserInputSource(this.bindings);
    this.detach = this.source.attach();
    this.look = new PointerLook(canvas);
    this.look.attach();
    this.family.attach();
    addEventListener('wheel', (e) => { if (this.look.locked) this.wheelAcc += Math.sign(e.deltaY); }, { passive: true });
    addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('keydown', (e) => { if (['Tab', 'Space', 'ArrowUp', 'ArrowDown'].includes(e.code) && document.activeElement === document.body) e.preventDefault(); });
  }

  buildBindings(options: GameOptions): InputBinding[] {
    return ACTIONS.map((a) => {
      const o = options.bindings[a.action];
      return { action: a.action, keyboard: o?.keys ?? a.keys, mouseButtons: o?.mouse ?? a.mouse ?? [], gamepadButtons: o?.pad ?? a.pad ?? [], gamepadAxes: a.axes ?? [] };
    });
  }

  rebind(options: GameOptions): void {
    this.detach();
    this.bindings = this.buildBindings(options);
    this.manager.setBindings(this.bindings);
    this.source = new BrowserInputSource(this.bindings);
    this.detach = this.source.attach();
  }

  get usingPad(): boolean { const f = this.family.activeFamily; return f !== 'keyboard-mouse' && f !== 'touch'; }

  /** Poll devices once per animation frame. */
  poll(realDt: number): void {
    const raw = this.source.poll();
    this.family.sampleGamepads();
    if (this.scripted) {
      for (const a of ACTIONS) raw.set(a.action, this.scripted.down.has(a.action) ? 1 : 0);
    }
    this.manager.update(raw);
    for (const a of ACTIONS) {
      const st = this.manager.get(a.action);
      if (st.pressed) this.pendingPressed.add(a.action);
      if (st.released) this.pendingReleased.add(a.action);
      if (st.down) this.heldTime.set(a.action, (this.heldTime.get(a.action) ?? 0) + realDt);
      else this.heldTime.delete(a.action);
    }
    if (this.scripted) this.scriptedPrev = new Set(this.scripted.down);
  }

  isDown(action: string): boolean { return this.manager.isDown(action); }

  /** Build a frame for one simulation step and clear latched edges. */
  frame(dt: number): InputFrame {
    const m = this.manager;
    let mx = m.value('move_r') - m.value('move_l');
    let mz = m.value('move_f') - m.value('move_b');
    if (this.scripted) { mx = this.scripted.move[0]; mz = this.scripted.move[1]; }
    const len = Math.hypot(mx, mz); if (len > 1) { mx /= len; mz /= len; }
    let lx = 0, ly = 0;
    const d = this.look.consume();
    lx -= d.x * this.sens.mouse; ly -= d.y * this.sens.mouse * (this.sens.invertY ? -1 : 1);
    const px = m.value('look_r') - m.value('look_l'), py = m.value('look_d') - m.value('look_u');
    const curve = (v: number) => Math.sign(v) * Math.pow(Math.abs(v), 1.6);
    lx -= curve(px) * this.sens.pad * dt; ly -= curve(py) * this.sens.pad * dt * (this.sens.invertY ? -1 : 1);
    if (this.scripted) { lx = this.scripted.look[0]; ly = this.scripted.look[1]; }
    const down = new Set<string>();
    for (const a of ACTIONS) if (m.isDown(a.action)) down.add(a.action);
    const f: InputFrame = { moveX: mx, moveZ: mz, lookX: lx, lookY: ly, down, pressed: this.pendingPressed, released: this.pendingReleased, held: new Map(this.heldTime), wheel: this.wheelAcc, pad: this.usingPad };
    this.pendingPressed = new Set(); this.pendingReleased = new Set(); this.wheelAcc = 0;
    return f;
  }

  /** Discard any latched edges (on state changes, so a menu press doesn't fire in gameplay). */
  flush(): void { this.pendingPressed.clear(); this.pendingReleased.clear(); this.look.consume(); this.wheelAcc = 0; }
}

export const emptyFrame = (): InputFrame => ({ moveX: 0, moveZ: 0, lookX: 0, lookY: 0, down: new Set(), pressed: new Set(), released: new Set(), held: new Map(), wheel: 0, pad: false });
