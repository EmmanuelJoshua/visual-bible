import * as THREE from "three";
import { DEG, ecef, enu, geodetic } from "./geo";

/**
 * The globe's camera, kept as a place to look at and how to look at it — a
 * target on the ground, a distance, a heading and a tilt — and the input
 * that moves it: drag to pan, right-drag (or ctrl / shift + drag) to turn
 * and tilt, the wheel or a pinch to zoom toward the cursor.
 */

export type View = {
  lng: number;
  lat: number;
  /** ground height at the target, metres */
  h: number;
  /** eye to target, metres */
  dist: number;
  /** radians clockwise from north, as a map's bearing */
  heading: number;
  /** radians from straight down */
  pitch: number;
};

export const MIN_DIST = 30;
export const MAX_DIST = 2.6e7;
/** metres from the target at zoom 0: the scale the journey camera was tuned on */
const ZOOM_K = 7.2e7;

export const distForZoom = (z: number) => ZOOM_K / 2 ** z;
export const zoomForDist = (d: number) => Math.log2(ZOOM_K / d);

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const smooth = (t: number) => t * t * (3 - 2 * t);

/** as steep as the camera may tilt from a distance: freely near the ground, nearly straight down from space */
export function maxPitch(dist: number) {
  const t = clamp((Math.log(dist) - Math.log(5e5)) / (Math.log(1.2e7) - Math.log(5e5)), 0, 1);
  return (82 - 70 * smooth(t)) * DEG;
}

export type CameraFrame = {
  target: THREE.Vector3;
  eye: THREE.Vector3;
  /** the camera's axes in ECEF: right, up, and back (it looks down -z) */
  x: THREE.Vector3;
  y: THREE.Vector3;
  z: THREE.Vector3;
};

const _east = new THREE.Vector3();
const _up = new THREE.Vector3();
const _south = new THREE.Vector3();
const _fwd = new THREE.Vector3();

/** where the eye is and which way it faces, in ECEF */
export function cameraFrame(v: View, out?: CameraFrame): CameraFrame {
  const f = out ?? {
    target: new THREE.Vector3(),
    eye: new THREE.Vector3(),
    x: new THREE.Vector3(),
    y: new THREE.Vector3(),
    z: new THREE.Vector3(),
  };
  enu(v.lng, v.lat, _east, _up, _south);
  const ch = Math.cos(v.heading);
  const sh = Math.sin(v.heading);
  // forward along the ground (north turned by the heading) and right of it
  _fwd.copy(_south).multiplyScalar(-ch).addScaledVector(_east, sh);
  f.x.copy(_east).multiplyScalar(ch).addScaledVector(_south, sh);
  ecef(v.lng, v.lat, v.h, f.target);
  f.z.copy(_up).multiplyScalar(Math.cos(v.pitch)).addScaledVector(_fwd, -Math.sin(v.pitch));
  f.eye.copy(f.target).addScaledVector(f.z, v.dist);
  f.y.crossVectors(f.z, f.x).normalize();
  return f;
}

export type Pick = (clientX: number, clientY: number) => { lng: number; lat: number } | null;

type Pointer = { x: number; y: number; t: number };

export class GlobeControls {
  readonly view: View = { lng: 35, lat: 32, h: 0, dist: 4e6, heading: 0, pitch: 0 };
  private pointers = new Map<number, Pointer>();
  private mode: "pan" | "turn" | "pinch" | null = null;
  private velocity = { x: 0, y: 0 };
  private zoomPending = 0;
  private zoomAt: { x: number; y: number } | null = null;
  private pinch: { d: number; a: number; mx: number; my: number } | null = null;
  private moved = false;

  constructor(
    private dom: HTMLElement,
    private fov: number,
    private pick: Pick,
    /** called as the person takes the camera */
    private onStart: () => void,
  ) {
    dom.addEventListener("pointerdown", this.down);
    dom.addEventListener("pointermove", this.move);
    dom.addEventListener("pointerup", this.up);
    dom.addEventListener("pointercancel", this.up);
    dom.addEventListener("wheel", this.wheel, { passive: false });
    dom.addEventListener("dblclick", this.dblclick);
    dom.addEventListener("contextmenu", this.contextmenu);
  }

  /** is a hand on the camera, or is it still gliding from one */
  get active() {
    return this.mode !== null || Math.hypot(this.velocity.x, this.velocity.y) > 0.02 || Math.abs(this.zoomPending) > 1e-3;
  }

  stop() {
    this.velocity = { x: 0, y: 0 };
    this.zoomPending = 0;
  }

  /* ------------------------------------------------------------ moves */

  /** metres of ground per screen pixel at the target */
  private mpp() {
    const h = this.dom.clientHeight || 1;
    return (2 * this.view.dist * Math.tan((this.fov / 2) * DEG)) / h;
  }

  /** slide the target so the ground follows the pointer */
  pan(dx: number, dy: number) {
    const v = this.view;
    const m = this.mpp();
    // farther ground slides faster under a tilted camera
    const along = m / Math.max(0.35, Math.cos(v.pitch));
    const right = -dx * m;
    const fwd = dy * along;
    const east = right * Math.cos(v.heading) + fwd * Math.sin(v.heading);
    const north = -right * Math.sin(v.heading) + fwd * Math.cos(v.heading);
    const r = 6371008.8;
    v.lat = clamp(v.lat + (north / r) / DEG, -85, 85);
    v.lng = wrapLng(v.lng + (east / (r * Math.max(0.05, Math.cos(v.lat * DEG)))) / DEG);
  }

  turn(dx: number, dy: number) {
    const v = this.view;
    v.heading = wrapAngle(v.heading + dx * 0.006);
    v.pitch = clamp(v.pitch - dy * 0.005, 0, maxPitch(v.dist));
  }

  /** zoom by a factor about a screen point, which stays under the cursor */
  zoom(factor: number, clientX?: number, clientY?: number) {
    const v = this.view;
    const d = clamp(v.dist * factor, MIN_DIST, MAX_DIST);
    const f = d / v.dist;
    const p = clientX === undefined ? null : this.pick(clientX, clientY!);
    if (p) {
      const target = ecef(v.lng, v.lat, v.h);
      const at = ecef(p.lng, p.lat, v.h);
      const moved = geodetic(at.lerp(target, f));
      v.lng = moved.lng;
      v.lat = clamp(moved.lat, -85, 85);
    }
    v.dist = d;
    v.pitch = Math.min(v.pitch, maxPitch(d));
  }

  /** glide after a fling, and ease the wheel's steps; once a frame */
  update(dt: number) {
    if (this.mode === null && (this.velocity.x || this.velocity.y)) {
      this.pan(this.velocity.x * dt, this.velocity.y * dt);
      const k = Math.exp(-dt / 240);
      this.velocity.x *= k;
      this.velocity.y *= k;
      if (Math.hypot(this.velocity.x, this.velocity.y) < 0.02) this.velocity = { x: 0, y: 0 };
    }
    if (Math.abs(this.zoomPending) > 1e-4) {
      const step = this.zoomPending * Math.min(1, dt / 90);
      this.zoomPending -= step;
      this.zoom(Math.exp(step), this.zoomAt?.x, this.zoomAt?.y);
    } else this.zoomPending = 0;
  }

  /* ------------------------------------------------------------ input */

  private down = (e: PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0 && e.button !== 2) return;
    this.dom.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, t: e.timeStamp });
    this.velocity = { x: 0, y: 0 };
    this.zoomPending = 0;
    this.moved = false;
    if (this.pointers.size === 2) {
      this.mode = "pinch";
      this.pinch = this.pinchState();
    } else if (this.pointers.size === 1) {
      const turn = e.button === 2 || e.ctrlKey || e.shiftKey || e.altKey || e.metaKey;
      this.mode = turn ? "turn" : "pan";
    }
    this.onStart();
  };

  private move = (e: PointerEvent) => {
    const p = this.pointers.get(e.pointerId);
    if (!p || !this.mode) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    const dt = Math.max(1, e.timeStamp - p.t);
    p.x = e.clientX;
    p.y = e.clientY;
    p.t = e.timeStamp;
    if (dx || dy) this.moved = true;
    if (this.mode === "pan") {
      this.pan(dx, dy);
      // a running average, for the glide on release
      this.velocity.x = this.velocity.x * 0.6 + (dx / dt) * 0.4;
      this.velocity.y = this.velocity.y * 0.6 + (dy / dt) * 0.4;
    } else if (this.mode === "turn") {
      this.turn(dx, dy);
    } else if (this.mode === "pinch" && this.pinch) {
      const now = this.pinchState();
      if (!now) return;
      this.pan(now.mx - this.pinch.mx, now.my - this.pinch.my);
      this.zoom(this.pinch.d / Math.max(1, now.d), now.mx, now.my);
      this.view.heading = wrapAngle(this.view.heading - (now.a - this.pinch.a));
      this.pinch = now;
    }
  };

  private up = (e: PointerEvent) => {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    this.pointers.delete(e.pointerId);
    if (this.dom.hasPointerCapture(e.pointerId)) this.dom.releasePointerCapture(e.pointerId);
    // no glide if the pointer rested before letting go
    if (this.mode !== "pan" || e.timeStamp - p.t > 80) this.velocity = { x: 0, y: 0 };
    if (this.pointers.size === 1) {
      this.mode = "pan";
      this.velocity = { x: 0, y: 0 };
    } else if (this.pointers.size === 0) {
      this.mode = null;
      this.pinch = null;
    }
  };

  private pinchState() {
    const [a, b] = [...this.pointers.values()];
    if (!a || !b) return null;
    return {
      d: Math.hypot(b.x - a.x, b.y - a.y),
      a: Math.atan2(b.y - a.y, b.x - a.x),
      mx: (a.x + b.x) / 2,
      my: (a.y + b.y) / 2,
    };
  }

  private wheel = (e: WheelEvent) => {
    e.preventDefault();
    const px = e.deltaY * (e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1);
    // trackpad pinches arrive as ctrl + wheel, in finer steps
    const k = e.ctrlKey ? 0.012 : 0.0022;
    this.zoomPending += clamp(px, -240, 240) * k;
    this.zoomAt = { x: e.clientX, y: e.clientY };
    this.velocity = { x: 0, y: 0 };
    this.onStart();
  };

  private dblclick = (e: MouseEvent) => {
    this.zoomPending += Math.log(0.45);
    this.zoomAt = { x: e.clientX, y: e.clientY };
    this.onStart();
  };

  private contextmenu = (e: Event) => e.preventDefault();

  /** true if the last press was a click rather than a drag */
  get clicked() {
    return !this.moved;
  }

  dispose() {
    const d = this.dom;
    d.removeEventListener("pointerdown", this.down);
    d.removeEventListener("pointermove", this.move);
    d.removeEventListener("pointerup", this.up);
    d.removeEventListener("pointercancel", this.up);
    d.removeEventListener("wheel", this.wheel);
    d.removeEventListener("dblclick", this.dblclick);
    d.removeEventListener("contextmenu", this.contextmenu);
  }
}

export const wrapLng = (lng: number) => ((((lng + 180) % 360) + 360) % 360) - 180;
export const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/* ------------------------------------------------------------- flights */

export type Flight = { from: View; to: View; peak: number; start: number; dur: number; onEnd?: () => void };

/** a flight between views: along the great circle, rising over long distances and looking down while high */
export function flightView(f: Flight, now: number, out: View): boolean {
  const t = Math.min(1, (now - f.start) / f.dur);
  const e = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
  const a = ecef(f.from.lng, f.from.lat, 0).normalize();
  const b = ecef(f.to.lng, f.to.lat, 0).normalize();
  const angle = a.angleTo(b);
  let p: THREE.Vector3;
  if (angle < 1e-7) p = a;
  else {
    const s = Math.sin(angle);
    p = a.multiplyScalar(Math.sin((1 - e) * angle) / s).addScaledVector(b, Math.sin(e * angle) / s);
  }
  const g = geodetic(p.multiplyScalar(6371008.8));
  out.lng = g.lng;
  out.lat = g.lat;
  out.h = f.from.h + (f.to.h - f.from.h) * e;
  const la = Math.log(f.from.dist);
  const lb = Math.log(f.to.dist);
  const rise = Math.max(0, Math.log(f.peak) - Math.max(la, lb));
  const bump = Math.sin(Math.PI * e);
  out.dist = Math.exp(la + (lb - la) * e + rise * bump);
  out.heading = f.from.heading + wrapAngle(f.to.heading - f.from.heading) * e;
  // high up, look down at the ground passing below
  const pitch = f.from.pitch + (f.to.pitch - f.from.pitch) * e;
  out.pitch = Math.min(pitch * (1 - 0.7 * Math.min(1, rise / 2) * bump), maxPitch(out.dist));
  return t >= 1;
}
