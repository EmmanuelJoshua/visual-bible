import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

/**
 * The room the model stands in: a warm, dim backdrop; shafts of light from a
 * high window drifting across the view; dust turning in them; and the
 * model's own body — its cut sides showing the rock beneath the land (and the
 * clear resin of the sea where a coast meets the edge), on a dark plinth.
 */

/* ------------------------------------------------------------ backdrop */

export function backdrop() {
  const mat = new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    uniforms: { uTime: { value: 0 }, uAspect: { value: 1 } },
    vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }",
    fragmentShader: `
      varying vec2 vUv;
      uniform float uAspect;
      uniform float uTime;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
      void main() {
        vec2 p = (vUv - vec2(0.5, 0.56)) * vec2(uAspect, 1.0);
        float r = length(p);
        // a pool of warm light behind the model, falling off to near black
        vec3 inner = vec3(0.19, 0.145, 0.105);
        vec3 outer = vec3(0.028, 0.022, 0.018);
        vec3 c = mix(inner, outer, smoothstep(0.05, 0.95, r));
        c += (hash(vUv * 1024.0 + uTime) - 0.5) * 0.006;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -100;
  return mesh;
}

/** shafts of window light across the whole view, drifting slowly; drawn over the scene, added */
export function lightShafts() {
  const mat = new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    transparent: true,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uAspect: { value: 1 }, uStrength: { value: 1 } },
    vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime;
      uniform float uAspect;
      uniform float uStrength;
      float band(float x, float w) { return smoothstep(w, 0.0, abs(x)); }
      void main() {
        vec2 p = vec2(vUv.x * uAspect, vUv.y);
        // across the view at a slant, as from a high window to the upper left
        float s = dot(p, normalize(vec2(1.0, 0.55)));
        float t = uTime * 0.012;
        float l = band(fract(s * 0.9 - t) - 0.5, 0.08) * 0.55
          + band(fract(s * 0.9 + 0.31 - t * 0.7) - 0.5, 0.05) * 0.35
          + band(fract(s * 0.9 + 0.62 - t * 1.3) - 0.5, 0.12) * 0.25;
        // strongest toward the top, where the window is
        l *= smoothstep(-0.2, 1.1, vUv.y) * (0.75 + 0.25 * sin(uTime * 0.21));
        gl_FragColor = vec4(vec3(1.0, 0.86, 0.66) * l * 0.055 * uStrength, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 100;
  return mesh;
}

/** dust turning slowly in the air over the model */
export function dust(box: THREE.Box3, count = 1400) {
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  const size = box.getSize(new THREE.Vector3());
  for (let i = 0; i < count; i++) {
    pos[i * 3] = box.min.x + Math.random() * size.x;
    pos[i * 3 + 1] = box.min.y + Math.random() * size.y;
    pos[i * 3 + 2] = box.min.z + Math.random() * size.z;
    seed[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("seed", new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uScale: { value: 1 } },
    vertexShader: `
      attribute float seed;
      uniform float uTime;
      uniform float uScale;
      varying float vA;
      void main() {
        vec3 p = position;
        float t = uTime * (0.05 + seed * 0.06);
        p += vec3(sin(t + seed * 40.0), sin(t * 0.7 + seed * 13.0) * 0.6, cos(t * 0.9 + seed * 27.0)) * 40.0;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uScale * (1.0 + seed * 2.2) * 900.0 / -mv.z;
        vA = 0.25 + 0.75 * fract(seed * 7.13);
      }`,
    fragmentShader: `
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(vec3(1.0, 0.9, 0.75) * a * vA * 0.5, 1.0);
      }`,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return points;
}

/* ------------------------------------------------------------ the body */

const STRATA = `
  float h1(float x) { return fract(sin(x * 127.1) * 43758.5453); }
  float n1(float x) { float i = floor(x); float f = fract(x); return mix(h1(i), h1(i + 1.0), f * f * (3.0 - 2.0 * f)); }
`;

/**
 * The cut sides: walls down from the land's edge to the plinth. Below the
 * ground, layered rock; above the sea floor where the sea meets the edge,
 * the clear deep blue of the resin the sea is cast in.
 */
export function slabSides(edge: { x: number; z: number; ground: number }[], bottom: number) {
  const n = edge.length;
  const pos: number[] = [];
  const floor: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i < n; i++) {
    const e = edge[i];
    const top = Math.max(e.ground, 0);
    pos.push(e.x, top, e.z, e.x, bottom, e.z);
    floor.push(e.ground, e.ground);
  }
  for (let i = 0; i < n - 1; i++) {
    const a = i * 2;
    // outward faces: the edge runs clockwise seen from above
    idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("floorY", new THREE.Float32BufferAttribute(floor, 1));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.88, metalness: 0, color: 0xffffff });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float floorY;\nvarying float vFloor;\nvarying vec3 vPos;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvFloor = floorY;\nvPos = position;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying float vFloor;\nvarying vec3 vPos;\n${STRATA}`)
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        {
          float y = vPos.y;
          float along = vPos.x * 0.013 + vPos.z * 0.011;
          // layers of sandstone, limestone and shale, wavering a little along the cut
          float k = y * 0.16 + n1(along) * 1.6 + n1(along * 3.7) * 0.4;
          float layer = h1(floor(k));
          vec3 sand = vec3(0.62, 0.47, 0.32);
          vec3 lime = vec3(0.74, 0.68, 0.57);
          vec3 shale = vec3(0.36, 0.29, 0.24);
          vec3 rust = vec3(0.55, 0.3, 0.19);
          vec3 rock = layer < 0.35 ? sand : layer < 0.6 ? lime : layer < 0.85 ? shale : rust;
          rock *= 0.85 + 0.25 * n1(k * 6.0 + along * 9.0);
          // deeper is darker, as cut stone is
          rock *= mix(1.0, 0.5, smoothstep(0.0, -110.0, y));
          // the sea's resin above the sea floor
          float resin = step(vFloor + 0.05, y);
          vec3 water = mix(vec3(0.05, 0.16, 0.26), vec3(0.16, 0.42, 0.5), smoothstep(-3.0, 0.0, y));
          diffuseColor.rgb = mix(rock, water, resin);
        }`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        "#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.12, step(vFloor + 0.05, vPos.y));",
      );
  };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  return mesh;
}

/** the plinth: a dark rounded block the model is mounted on */
export function plinth(width: number, depth: number, top: number) {
  const h = 50;
  const geo = new RoundedBoxGeometry(width + 70, h, depth + 70, 4, 14);
  const mat = new THREE.MeshStandardMaterial({ color: 0x1b1511, roughness: 0.42, metalness: 0.05 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = top - h / 2;
  mesh.receiveShadow = true;
  return mesh;
}
