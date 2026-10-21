import type { Journey, LngLat } from "@/data/journeys";
import { ERAS } from "@/data/eras";

/* ------------------------------- distances -------------------------------- */

const EARTH_KM = 6371;
const rad = (d: number) => (d * Math.PI) / 180;

export function distanceKm(a: LngLat, b: LngLat): number {
  const dLat = rad(b[1] - a[1]);
  const dLng = rad(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** compass heading from a to b, degrees clockwise from north */
export function headingDeg(a: LngLat, b: LngLat): number {
  const y = Math.sin(rad(b[0] - a[0])) * Math.cos(rad(b[1]));
  const x =
    Math.cos(rad(a[1])) * Math.sin(rad(b[1])) -
    Math.sin(rad(a[1])) * Math.cos(rad(b[1])) * Math.cos(rad(b[0] - a[0]));
  return (Math.atan2(y, x) * 180) / Math.PI;
}

const lerp = (a: number, b: number, s: number) => a + (b - a) * s;
const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));
const smooth = (s: number) => s * s * (3 - 2 * s);
export const easeInOut = (s: number) => 0.5 - Math.cos(Math.PI * s) / 2;

/* --------------------------------- paths ---------------------------------- */

export type Segment = {
  pts: LngLat[];
  /** cumulative km at each point */
  cum: number[];
  km: number;
  /** a "time passes" hop with no travelled route */
  jump: boolean;
  /** gentle camera bearing for this leg */
  bearing: number;
  /** zoom that frames the whole leg */
  travelZoom: number;
};

export type JourneyPath = {
  segments: Segment[];
  stopZoom: number[];
};

const zoomForKm = (km: number) =>
  clamp(11 - Math.log2(Math.max(km, 1) / 8), 3.4, 10.5);

const pathCache = new Map<string, JourneyPath>();

export function pathOf(j: Journey): JourneyPath {
  const hit = pathCache.get(j.id);
  if (hit) return hit;
  const segments: Segment[] = [];
  for (let i = 1; i < j.stops.length; i++) {
    const a = j.stops[i - 1].coord;
    const b = j.stops[i].coord;
    const pts: LngLat[] = [a, ...(j.stops[i].via ?? []), b];
    const cum = [0];
    for (let k = 1; k < pts.length; k++)
      cum.push(cum[k - 1] + distanceKm(pts[k - 1], pts[k]));
    const km = cum[cum.length - 1];
    segments.push({
      pts,
      cum,
      km,
      jump: !!j.stops[i].newLeg,
      // travel direction nudges the camera, but north stays roughly up
      bearing: km < 0.5 ? 0 : 24 * Math.sin(rad(headingDeg(a, b))),
      travelZoom: zoomForKm(km * 1.15),
    });
  }
  // stops are framed by their nearest neighbour, so the camera settles close
  const stopZoom = j.stops.map((_, i) => {
    const near = [segments[i - 1], segments[i]]
      .filter((s): s is Segment => !!s)
      .map((s) => zoomForKm(Math.max(s.km, 6) * 1.6));
    return clamp(Math.max(...near) + 0.4, 5.6, 10.6);
  });
  const path = { segments, stopZoom };
  pathCache.set(j.id, path);
  return path;
}

/** point at fraction u (0..1) of a segment's length */
export function pointAt(seg: Segment, u: number): LngLat {
  const d = clamp(u, 0, 1) * seg.km;
  for (let k = 1; k < seg.pts.length; k++) {
    if (d <= seg.cum[k] || k === seg.pts.length - 1) {
      const span = seg.cum[k] - seg.cum[k - 1] || 1;
      const s = clamp((d - seg.cum[k - 1]) / span, 0, 1);
      const a = seg.pts[k - 1];
      const b = seg.pts[k];
      return [lerp(a[0], b[0], s), lerp(a[1], b[1], s)];
    }
  }
  return seg.pts[seg.pts.length - 1];
}

/** the travelled part of a segment, up to fraction u */
export function partialLine(seg: Segment, u: number): LngLat[] {
  const d = clamp(u, 0, 1) * seg.km;
  const out: LngLat[] = [seg.pts[0]];
  for (let k = 1; k < seg.pts.length; k++) {
    if (seg.cum[k] < d) out.push(seg.pts[k]);
    else break;
  }
  out.push(pointAt(seg, u));
  return out;
}

/* -------------------------------- progress -------------------------------- */

export function locate(j: Journey, t: number) {
  const last = j.stops.length - 1;
  const tc = clamp(t, 0, last);
  const seg = Math.min(Math.floor(tc), last - 1);
  return { seg, s: tc - seg };
}

/** where the travelling marker is at progress t */
export function markerAt(j: Journey, t: number): LngLat {
  const { seg, s } = locate(j, t);
  return pointAt(pathOf(j).segments[seg], easeInOut(s));
}

export type CameraPose = {
  center: LngLat;
  zoom: number;
  pitch: number;
  bearing: number;
};

const pitchFor = (zoom: number) => clamp(lerp(38, 62, (zoom - 4) / 5), 38, 62);

/**
 * A deterministic, flyTo-like camera for progress t: settle close at stops,
 * pull back to frame long legs, and lean gently into the direction of travel.
 */
export function cameraAt(j: Journey, t: number): CameraPose {
  const path = pathOf(j);
  const { seg, s } = locate(j, t);
  const leg = path.segments[seg];
  const zA = path.stopZoom[seg];
  const zB = path.stopZoom[seg + 1];
  const zMid = Math.min(leg.travelZoom, zA, zB);
  let zoom: number;
  if (s < 0.35) zoom = lerp(zA, zMid, smooth(s / 0.35));
  else if (s > 0.65) zoom = lerp(zMid, zB, smooth((s - 0.65) / 0.35));
  else zoom = zMid;
  const prevBearing = seg > 0 ? path.segments[seg - 1].bearing : leg.bearing;
  const bearing = lerp(prevBearing, leg.bearing, smooth(clamp(s / 0.4, 0, 1)));
  return {
    center: pointAt(leg, easeInOut(s)),
    zoom,
    pitch: pitchFor(zoom),
    bearing,
  };
}

/** a calm, north-up framing of one stop (used for reduced motion) */
export function stopPose(j: Journey, index: number): CameraPose {
  const zoom = pathOf(j).stopZoom[index];
  return { center: j.stops[index].coord, zoom, pitch: 50, bearing: 0 };
}

/** seconds the playback spends travelling a leg */
export function legSeconds(km: number): number {
  return clamp(1.6 + Math.log2(1 + km / 40) * 0.95, 2.2, 6.5);
}

export function yearAt(j: Journey, t: number): number {
  const { seg, s } = locate(j, t);
  return lerp(j.stops[seg].year, j.stops[seg + 1].year, s);
}

export function tForYear(j: Journey, year: number): number {
  const last = j.stops.length - 1;
  if (year <= j.stops[0].year) return 0;
  if (year >= j.stops[last].year) return last;
  for (let i = 0; i < last; i++) {
    const y0 = j.stops[i].year;
    const y1 = j.stops[i + 1].year;
    if (year >= y0 && year < y1) return i + (year - y0) / (y1 - y0);
  }
  return last;
}

/* ----------------------------- timeline scale ----------------------------- */

/** each era gets an equal slice, so the dense later centuries stay usable */
const ERA_EDGES = ERAS.map((e, i) => [
  e.startYear,
  i < ERAS.length - 1 ? ERAS[i + 1].startYear : e.endYear + 1,
]);

export function yearToFrac(year: number): number {
  const n = ERA_EDGES.length;
  if (year <= ERA_EDGES[0][0]) return 0;
  for (let i = 0; i < n; i++) {
    const [a, b] = ERA_EDGES[i];
    if (year < b) return (i + (year - a) / (b - a)) / n;
  }
  return 1;
}

export function fracToYear(f: number): number {
  const n = ERA_EDGES.length;
  const x = clamp(f, 0, 0.99999) * n;
  const i = Math.floor(x);
  const [a, b] = ERA_EDGES[i];
  return a + (x - i) * (b - a);
}

export function approxYear(year: number): string {
  const y = Math.round(year);
  return y < 0 ? `c. ${-y} BC` : `AD ${y}`;
}
