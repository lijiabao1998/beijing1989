// Keyboard + on-screen joystick + pinch/wheel zoom + camera orbit (yaw + pitch) & playback hotkeys. Pattern adapted from shanghaisurvival (same owner); see NOTICE.md.
const MIN_ZOOM = 0.45;
const MAX_ZOOM = 2.0;
const MIN_PITCH = -0.38;
const MAX_PITCH = 0.48;
const ORBIT_KEY_SPEED = 1.65;
const PITCH_KEY_SPEED = 1.1;
const TOUCH_ORBIT_THRESHOLD = 6;
const MOUSE_ORBIT_THRESHOLD = 2;
const DRAG_RAD_PER_PX = 0.0044;

function clampZoom(z: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
}

function clampPitch(p: number): number {
  return Math.min(MAX_PITCH, Math.max(MIN_PITCH, p));
}

function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

export class Controls {
  keys = new Set<string>();
  joy = { x: 0, y: 0 };
  zoom = 1;
  orbitDelta = 0;
  orbitVel = 0;
  private orbitYaw = 0;
  private orbitPitch = 0;
  private pitchDelta = 0;
  private pitchVel = 0;
  private orbitSensitivity = 1.0;
  private viewfinderMode = false;
  private viewfinderLockMove = false;
  onInteract: () => void = () => {};
  onCamMode?: () => void;
  onSpeedDelta?: (delta: -1 | 1) => void;

  constructor(root: HTMLElement, stick: HTMLElement, knob: HTMLElement) {
    let pid = -1, cx = 0, cy = 0;
    const pts = new Map<number, [number, number]>();
    let d0 = 0, z0 = 1;
    let orbitPid = -1, orbitStartX = 0, orbitStartY = 0, orbitLastX = 0, orbitLastY = 0;
    let orbitActivated = false, orbitThresh = TOUCH_ORBIT_THRESHOLD, orbitMouseBtn = -1;

    const resetTransientInput = () => {
      this.keys.clear();
      this.joy = { x: 0, y: 0 };
      knob.style.transform = '';
      pid = -1;
      pts.clear();
      d0 = 0;
      orbitPid = -1;
      orbitActivated = false;
      orbitMouseBtn = -1;
      this.orbitDelta = 0;
      this.orbitVel = 0;
      this.pitchDelta = 0;
      this.pitchVel = 0;
    };

    addEventListener('keydown', e => {
      if (e.ctrlKey || e.metaKey || e.altKey || isEditableTarget(e.target)) return;
      const k = e.key.toLowerCase();
      this.keys.add(k);
      if (!e.repeat) {
        if (k === 'e' || e.key === ' ') this.onInteract();
        else if (k === 'c') this.onCamMode?.();
        else if (e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract') this.onSpeedDelta?.(-1);
        else if (e.key === '=' || e.key === '+' || e.code === 'NumpadAdd') this.onSpeedDelta?.(1);
      }
    });
    addEventListener('keyup', e => {
      this.keys.delete(e.key.toLowerCase());
    });
    addEventListener('blur', resetTransientInput);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) resetTransientInput();
    });

    root.addEventListener('wheel', e => {
      this.zoom = clampZoom(this.zoom * (e.deltaY > 0 ? 1.08 : 0.93));
    }, { passive: true });
    root.addEventListener('contextmenu', e => e.preventDefault());

    stick.addEventListener('pointerdown', e => {
      pid = e.pointerId;
      const r = stick.getBoundingClientRect();
      cx = r.left + r.width / 2;
      cy = r.top + r.height / 2;
      try { stick.setPointerCapture(pid); } catch { /* ignore synthetic capture failure */ }
      move(e);
    });
    const move = (e: PointerEvent) => {
      if (e.pointerId !== pid) return;
      let dx = (e.clientX - cx) / 50, dy = (e.clientY - cy) / 50;
      const l = Math.hypot(dx, dy);
      if (l > 1) { dx /= l; dy /= l; }
      this.joy = { x: dx, y: dy };
      knob.style.transform = `translate(${dx * 34}px,${dy * 34}px)`;
    };
    stick.addEventListener('pointermove', move);
    const end = (e: PointerEvent) => {
      if (e.pointerId !== pid) return;
      pid = -1;
      this.joy = { x: 0, y: 0 };
      knob.style.transform = '';
    };
    stick.addEventListener('pointerup', end);
    stick.addEventListener('pointercancel', end);

    const isInStick = (e: PointerEvent): boolean => {
      if (stick.contains(e.target as Node)) return true;
      if (stick.hidden) return false;
      const r = stick.getBoundingClientRect();
      return r.width > 0 && r.height > 0
        && e.clientX >= r.left && e.clientX <= r.right
        && e.clientY >= r.top && e.clientY <= r.bottom;
    };
    const dist = () => {
      const [a, b] = [...pts.values()];
      return Math.hypot(a[0] - b[0], a[1] - b[1]) || 1;
    };

    // pinch zoom + single-pointer/right/middle/Shift+left (or plain left in Viewfinder) drag camera orbit on canvas
    root.addEventListener('pointerdown', e => {
      if (isInStick(e)) return;
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 2) {
        orbitPid = -1;
        orbitActivated = false;
        d0 = dist();
        z0 = this.zoom;
        return;
      }
      if (pts.size === 1) {
        const isMouse = e.pointerType === 'mouse';
        const mouseOrbit = isMouse && (e.button === 2 || e.button === 1 || (e.button === 0 && (e.shiftKey || this.viewfinderMode)));
        const touchOrbit = e.pointerType === 'touch' || e.pointerType === 'pen';
        if (mouseOrbit || touchOrbit) {
          orbitPid = e.pointerId;
          orbitStartX = e.clientX;
          orbitStartY = e.clientY;
          orbitLastX = e.clientX;
          orbitLastY = e.clientY;
          orbitActivated = false;
          orbitThresh = isMouse ? MOUSE_ORBIT_THRESHOLD : TOUCH_ORBIT_THRESHOLD;
          orbitMouseBtn = isMouse ? e.button : -1;
        }
      }
    });
    root.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 2 && d0) {
        this.zoom = clampZoom(z0 * d0 / dist());
        return;
      }
      if (pts.size === 1 && e.pointerId === orbitPid) {
        if (orbitMouseBtn === 0 && (e.buttons & 1) === 0) { orbitPid = -1; orbitActivated = false; return; }
        if (orbitMouseBtn === 1 && (e.buttons & 4) === 0) { orbitPid = -1; orbitActivated = false; return; }
        if (orbitMouseBtn === 2 && (e.buttons & 2) === 0) { orbitPid = -1; orbitActivated = false; return; }
        if (!orbitActivated) {
          if (Math.hypot(e.clientX - orbitStartX, e.clientY - orbitStartY) <= orbitThresh) return;
          orbitActivated = true;
          orbitLastX = e.clientX;
          orbitLastY = e.clientY;
          try { root.setPointerCapture(e.pointerId); } catch { /* ignore synthetic capture failure */ }
        }
        const dx = Math.max(-120, Math.min(120, e.clientX - orbitLastX));
        const dy = Math.max(-120, Math.min(120, e.clientY - orbitLastY));
        orbitLastX = e.clientX;
        orbitLastY = e.clientY;
        this.addOrbitYaw(-dx * DRAG_RAD_PER_PX * this.orbitSensitivity);
        this.addOrbitPitch(-dy * DRAG_RAD_PER_PX * this.orbitSensitivity);
      }
    });
    const up = (e: PointerEvent) => {
      pts.delete(e.pointerId);
      if (pts.size < 2) d0 = 0;
      if (e.pointerId === orbitPid) {
        orbitPid = -1;
        orbitActivated = false;
        orbitMouseBtn = -1;
        try {
          if (root.hasPointerCapture(e.pointerId)) root.releasePointerCapture(e.pointerId);
        } catch { /* ignore */ }
      }
    };
    root.addEventListener('pointerup', up);
    root.addEventListener('pointercancel', up);
  }

  setOrbitSensitivity(mult: number): void {
    if (!Number.isFinite(mult)) return;
    this.orbitSensitivity = Math.max(0.4, Math.min(2.0, mult));
  }

  /** Enable Viewfinder aiming mode (ArrowUp/Down pitch camera; optional lockMove routes W/S/A/D to aim). */
  setViewfinderMode(on: boolean, lockMove = false): void {
    this.viewfinderMode = on;
    this.viewfinderLockMove = on && lockMove;
    if (!on) {
      this.pitchVel = 0;
    }
  }

  isViewfinderMode(): boolean {
    return this.viewfinderMode;
  }

  /** Keyboard orbit direction: +1 left (Q / [), -1 right (R / ]). */
  get orbitKey(): number {
    const k = this.keys;
    const left = k.has('q') || k.has('[') || (this.viewfinderMode && this.viewfinderLockMove && (k.has('a') || k.has('arrowleft')));
    const right = k.has('r') || k.has(']') || (this.viewfinderMode && this.viewfinderLockMove && (k.has('d') || k.has('arrowright')));
    return (left ? 1 : 0) - (right ? 1 : 0);
  }

  /** Keyboard vertical pitch direction in Viewfinder mode: +1 up, -1 down. */
  get pitchKey(): number {
    if (!this.viewfinderMode) return 0;
    const k = this.keys;
    const up = k.has('arrowup') || (this.viewfinderLockMove && k.has('w'));
    const down = k.has('arrowdown') || (this.viewfinderLockMove && k.has('s'));
    return (up ? 1 : 0) - (down ? 1 : 0);
  }

  /** Cumulative tracked orbit yaw offset (radians) since last resetOrbit(). */
  getOrbitYaw(): number {
    return this.orbitYaw + this.orbitDelta;
  }

  /** Queue an incremental camera yaw orbit delta in radians. */
  addOrbitYaw(rad: number): void {
    if (!Number.isFinite(rad)) return;
    this.orbitDelta += rad;
  }

  /** Current camera vertical pitch angle in radians, clamped to [-0.38, 0.48]. */
  getOrbitPitch(): number {
    return clampPitch(this.orbitPitch + this.pitchDelta);
  }

  /** Queue an incremental camera pitch delta in radians, clamped to [-0.38, 0.48]. */
  addOrbitPitch(dp: number): void {
    if (!Number.isFinite(dp)) return;
    const next = clampPitch(this.orbitPitch + this.pitchDelta + dp);
    this.pitchDelta = next - this.orbitPitch;
  }

  /** Directly set camera vertical pitch angle in radians, clamped to [-0.38, 0.48]. */
  setOrbitPitch(rad: number): void {
    if (!Number.isFinite(rad)) return;
    this.orbitPitch = clampPitch(rad);
    this.pitchDelta = 0;
    this.pitchVel = 0;
  }

  /** Consume smoothed pointer-drag + keyboard orbit yaw delta (radians) for the current frame and advance pitch smoothing. */
  consumeOrbit(dt = 1 / 60): number {
    const safeDt = Math.min(Math.max(dt, 0), 0.05);
    const dragAlpha = 1 - Math.exp(-22 * safeDt);
    const dragStep = this.orbitDelta * dragAlpha;
    this.orbitDelta -= dragStep;
    if (Math.abs(this.orbitDelta) < 1e-5) this.orbitDelta = 0;

    const velAlpha = 1 - Math.exp(-12 * safeDt);
    const targetVel = this.orbitKey * ORBIT_KEY_SPEED * this.orbitSensitivity;
    this.orbitVel += (targetVel - this.orbitVel) * velAlpha;
    if (this.orbitKey === 0 && Math.abs(this.orbitVel) < 1e-4) this.orbitVel = 0;

    const yawStep = dragStep + this.orbitVel * safeDt;
    this.orbitYaw += yawStep;

    // Advance pitch smoothing in lockstep with yaw consumption
    const pitchStep = this.pitchDelta * dragAlpha;
    this.pitchDelta -= pitchStep;
    if (Math.abs(this.pitchDelta) < 1e-5) this.pitchDelta = 0;

    const targetPitchVel = this.pitchKey * PITCH_KEY_SPEED;
    this.pitchVel += (targetPitchVel - this.pitchVel) * velAlpha;
    if (this.pitchKey === 0 && Math.abs(this.pitchVel) < 1e-4) this.pitchVel = 0;

    const nextPitch = clampPitch(this.orbitPitch + pitchStep + this.pitchVel * safeDt);
    this.orbitPitch = nextPitch;
    if (this.pitchDelta !== 0) {
      this.pitchDelta = clampPitch(this.orbitPitch + this.pitchDelta) - this.orbitPitch;
    }

    return yawStep;
  }

  /** Clear queued orbit delta, angular velocity, yaw offset, and vertical pitch (e.g., on scene switch). */
  resetOrbit(): void {
    this.orbitDelta = 0;
    this.orbitVel = 0;
    this.orbitYaw = 0;
    this.pitchDelta = 0;
    this.pitchVel = 0;
    this.orbitPitch = 0;
  }

  /** Movement vector in screen terms: x right, y down (toward camera). */
  axis() {
    let x = this.joy.x, y = this.joy.y;
    const k = this.keys;
    if (!(this.viewfinderMode && this.viewfinderLockMove)) {
      if (k.has('a') || k.has('arrowleft')) x -= 1;
      if (k.has('d') || k.has('arrowright')) x += 1;
      if (k.has('w') || (!this.viewfinderMode && k.has('arrowup'))) y -= 1;
      if (k.has('s') || (!this.viewfinderMode && k.has('arrowdown'))) y += 1;
    }
    const l = Math.hypot(x, y);
    return l > 1 ? { x: x / l, y: y / l } : { x, y };
  }
}
