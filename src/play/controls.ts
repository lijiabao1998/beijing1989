// Keyboard + on-screen joystick + pinch/wheel zoom. Pattern adapted from shanghaisurvival (same owner); see NOTICE.md.
export class Controls {
  keys = new Set<string>();
  joy = { x: 0, y: 0 };
  zoom = 1;
  onInteract: () => void = () => {};
  constructor(root: HTMLElement, stick: HTMLElement, knob: HTMLElement) {
    addEventListener('keydown', e => { this.keys.add(e.key.toLowerCase()); if (e.key === 'e' || e.key === 'E' || e.key === ' ') this.onInteract(); });
    addEventListener('keyup', e => this.keys.delete(e.key.toLowerCase()));
    addEventListener('blur', () => this.keys.clear());
    root.addEventListener('wheel', e => { this.zoom = Math.min(1.7, Math.max(0.55, this.zoom * (e.deltaY > 0 ? 1.08 : 0.93))); }, { passive: true });
    let pid = -1, cx = 0, cy = 0;
    stick.addEventListener('pointerdown', e => { pid = e.pointerId; const r = stick.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; stick.setPointerCapture(pid); move(e); });
    const move = (e: PointerEvent) => {
      if (e.pointerId !== pid) return;
      let dx = (e.clientX - cx) / 50, dy = (e.clientY - cy) / 50; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
      this.joy = { x: dx, y: dy }; knob.style.transform = `translate(${dx * 34}px,${dy * 34}px)`;
    };
    stick.addEventListener('pointermove', move);
    const end = (e: PointerEvent) => { if (e.pointerId !== pid) return; pid = -1; this.joy = { x: 0, y: 0 }; knob.style.transform = ''; };
    stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);
    // pinch zoom on the canvas
    const pts = new Map<number, [number, number]>(); let d0 = 0, z0 = 1;
    root.addEventListener('pointerdown', e => { pts.set(e.pointerId, [e.clientX, e.clientY]); if (pts.size === 2) { d0 = dist(); z0 = this.zoom; } });
    root.addEventListener('pointermove', e => { if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, [e.clientX, e.clientY]); if (pts.size === 2 && d0) this.zoom = Math.min(1.7, Math.max(0.55, z0 * d0 / dist())); });
    const up = (e: PointerEvent) => { pts.delete(e.pointerId); d0 = 0; };
    root.addEventListener('pointerup', up); root.addEventListener('pointercancel', up);
    const dist = () => { const [a, b] = [...pts.values()]; return Math.hypot(a[0] - b[0], a[1] - b[1]) || 1; };
  }
  /** Movement vector in screen terms: x right, y down (toward camera). */
  axis() {
    let x = this.joy.x, y = this.joy.y;
    const k = this.keys;
    if (k.has('a') || k.has('arrowleft')) x -= 1; if (k.has('d') || k.has('arrowright')) x += 1;
    if (k.has('w') || k.has('arrowup')) y -= 1; if (k.has('s') || k.has('arrowdown')) y += 1;
    const l = Math.hypot(x, y); return l > 1 ? { x: x / l, y: y / l } : { x, y };
  }
}
