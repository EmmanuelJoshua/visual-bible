import * as THREE from "three";

/**
 * Earth geometry for the globe: WGS84 positions (ECEF, metres) and the Web
 * Mercator tile scheme that the imagery and terrain sources share.
 */

export const A = 6378137; // WGS84 semi-major axis, m
const E2 = 6.69437999014e-3; // first eccentricity squared
export const DEG = Math.PI / 180;
/** mean radius, for horizon tests and distances */
export const R = 6371008.8;
export const MERCATOR_MAX_LAT = 85.0511287798;

/** geodetic (degrees, metres above the ellipsoid) → ECEF metres */
export function ecef(lng: number, lat: number, h = 0, out = new THREE.Vector3()) {
  const phi = lat * DEG;
  const lam = lng * DEG;
  const s = Math.sin(phi);
  const c = Math.cos(phi);
  const n = A / Math.sqrt(1 - E2 * s * s);
  return out.set((n + h) * c * Math.cos(lam), (n + h) * c * Math.sin(lam), (n * (1 - E2) + h) * s);
}

/** ECEF → geodetic, by Bowring's method (sub-millimetre for Earth's surface) */
export function geodetic(p: THREE.Vector3): { lng: number; lat: number; h: number } {
  const b = A * Math.sqrt(1 - E2);
  const ep2 = (A * A - b * b) / (b * b);
  const pr = Math.hypot(p.x, p.y);
  const th = Math.atan2(p.z * A, pr * b);
  const lat = Math.atan2(p.z + ep2 * b * Math.sin(th) ** 3, pr - E2 * A * Math.cos(th) ** 3);
  const lng = Math.atan2(p.y, p.x);
  const s = Math.sin(lat);
  const n = A / Math.sqrt(1 - E2 * s * s);
  const h = pr / Math.cos(lat) - n;
  return { lng: lng / DEG, lat: lat / DEG, h };
}

/** east, up and south unit vectors at a place (the local frame the app's models use) */
export function enu(lng: number, lat: number, east = new THREE.Vector3(), up = new THREE.Vector3(), south = new THREE.Vector3()) {
  const phi = lat * DEG;
  const lam = lng * DEG;
  east.set(-Math.sin(lam), Math.cos(lam), 0);
  up.set(Math.cos(phi) * Math.cos(lam), Math.cos(phi) * Math.sin(lam), Math.sin(phi));
  // north = up × east; south is its opposite
  south.set(Math.sin(phi) * Math.cos(lam), Math.sin(phi) * Math.sin(lam), -Math.cos(phi));
  return { east, up, south };
}

/** the local frame at a place as a matrix: x east, y up, z south, origin on the ground */
export function frameAt(lng: number, lat: number, h = 0, out = new THREE.Matrix4()) {
  const { east, up, south } = enu(lng, lat);
  return out.makeBasis(east, up, south).setPosition(ecef(lng, lat, h));
}

/* ------------------------------------------------------------- mercator */

export const tileLng = (x: number, z: number) => (x / 2 ** z) * 360 - 180;
export const tileLat = (y: number, z: number) => Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** z))) / DEG;

/** fractional tile coordinates of a place at zoom z */
export function tileXY(lng: number, lat: number, z: number) {
  const n = 2 ** z;
  const la = Math.max(-MERCATOR_MAX_LAT, Math.min(MERCATOR_MAX_LAT, lat)) * DEG;
  return {
    x: ((lng + 180) / 360) * n,
    y: ((1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2) * n,
  };
}

/** great-circle distance, metres */
export function distanceM(a: [number, number], b: [number, number]) {
  const dLat = (b[1] - a[1]) * DEG;
  const dLng = (b[0] - a[0]) * DEG;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * DEG) * Math.cos(b[1] * DEG) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
