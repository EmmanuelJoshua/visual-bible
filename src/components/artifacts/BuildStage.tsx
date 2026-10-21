"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { ArtifactId } from "@/data/artifacts";
import type { BuildInfo } from "@/data/builds";
import {
  assembleBuild,
  loadBuildModel,
  showStep,
  tickParts,
  type Assembled,
} from "@/lib/artifacts/build";
import { disposeGroup } from "@/lib/artifacts/geometry";
import {
  loadArtifactMaterials,
  loadStudioEnv,
} from "@/lib/artifacts/materials";

export type BuildMeta = {
  steps: { parts: number; tally: Partial<Record<string, number>> }[];
};

type Env = BuildInfo["env"];

const ENV: Record<
  Env,
  {
    top: number;
    horizon: number;
    ground: number;
    fog: number;
    sun: number;
    sunI: number;
    sunDir: [number, number, number];
    hemiSky: number;
    hemiGround: number;
    hemiI: number;
    exposure: number;
  }
> = {
  jerusalem: {
    top: 0x4f73a3,
    horizon: 0xeec48c,
    ground: 0xa88a62,
    fog: 0xe2bf8c,
    sun: 0xffcf8f,
    sunI: 4.2,
    sunDir: [-0.62, 0.5, -0.6],
    hemiSky: 0xc8d6ea,
    hemiGround: 0x6a4e30,
    hemiI: 0.45,
    exposure: 0.85,
  },
  deluge: {
    top: 0x323c47,
    horizon: 0x8a9498,
    ground: 0x4c4a3a,
    fog: 0x7e888c,
    sun: 0xe2e8ee,
    sunI: 3,
    sunDir: [-0.4, 0.72, -0.56],
    hemiSky: 0xb4c2d0,
    hemiGround: 0x3a342a,
    hemiI: 0.6,
    exposure: 0.95,
  },
  desert: {
    top: 0x5f8dbb,
    horizon: 0xf0d09c,
    ground: 0xc6a473,
    fog: 0xe8c995,
    sun: 0xffd8a0,
    sunI: 4,
    sunDir: [-0.58, 0.55, -0.6],
    hemiSky: 0xdfe4ea,
    hemiGround: 0x8a6a40,
    hemiI: 0.45,
    exposure: 0.88,
  },
  sanctuary: {
    top: 0x120e0b,
    horizon: 0x2c2119,
    ground: 0x2a2119,
    fog: 0x1d1712,
    sun: 0xffd9a0,
    sunI: 2.6,
    sunDir: [-0.45, 0.85, -0.5],
    hemiSky: 0x8a6a50,
    hemiGround: 0x120e0a,
    hemiI: 0.7,
    exposure: 1.15,
  },
};

const DEFAULT_DIR = new THREE.Vector3(-0.72, 0.55, -0.95).normalize();
const FOV = 40;
const WALK_FOV = 62;

type Tween = {
  p0: THREE.Vector3;
  p1: THREE.Vector3;
  t0: THREE.Vector3;
  t1: THREE.Vector3;
  f0: number;
  f1: number;
  start: number;
  dur: number;
};

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function skyDome(env: (typeof ENV)[Env], radius: number) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(env.top) },
      horizon: { value: new THREE.Color(env.horizon) },
    },
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 top; uniform vec3 horizon; varying vec3 vP;
      void main(){ float h = clamp(vP.y, 0.0, 1.0); gl_FragColor = vec4(mix(horizon, top, pow(h, 0.55)), 1.0);
      #include <colorspace_fragment>
      }`,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 16), mat);
}

export function BuildStage({
  id,
  info,
  step,
  walk,
  hidden,
  fitNonce,
  onReady,
}: {
  id: ArtifactId;
  info: BuildInfo;
  step: number;
  walk: number | null;
  hidden: boolean;
  fitNonce: number;
  onReady?: (meta: BuildMeta) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const labelTextRef = useRef<HTMLSpanElement>(null);
  const live = useRef({ step, walk, hidden, onReady, info });
  const api = useRef<{
    setStep: (s: number, animate: boolean) => void;
    setWalk: (w: number | null) => void;
    fit: () => void;
  } | null>(null);

  useEffect(() => {
    live.current = { step, walk, hidden, onReady, info };
  });

  useEffect(() => {
    const host = hostRef.current;
    const labelEl = labelRef.current;
    const labelText = labelTextRef.current;
    if (!host || !labelEl || !labelText) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const env = ENV[live.current.info.env];

    let cancelled = false;
    let raf = 0;
    let asm: Assembled | null = null;
    let visible = true;
    let tween: Tween | null = null;
    let walking = false;
    let labelShownAt = 0;
    const extras: THREE.Object3D[] = [];

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = env.exposure;
    const canvas = renderer.domElement;
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.touchAction = "none";
    host.prepend(canvas);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(env.horizon);
    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 1000);
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.addEventListener("start", () => {
      tween = null;
    });

    // dev-only probe for automated checks: dispatch "buildstage:probe" on window
    const probe = () => {
      const r = (v: THREE.Vector3) => v.toArray().map((n) => +n.toFixed(2));
      host.dataset.probe = JSON.stringify({
        pos: r(camera.position),
        target: r(controls.target),
        fov: camera.fov,
        calls: renderer.info.render.calls,
      });
    };
    if (process.env.NODE_ENV !== "production") window.addEventListener("buildstage:probe", probe);
    scene.add(new THREE.HemisphereLight(env.hemiSky, env.hemiGround, env.hemiI));
    const sun = new THREE.DirectionalLight(env.sun, env.sunI);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    scene.add(sun, sun.target);

    // the stepper covers the bottom of the stage: lift the optical centre above it
    const OVERLAY = 84;
    const fit = () => {
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      if (h > OVERLAY * 3) camera.setViewOffset(w, h + OVERLAY, 0, OVERLAY, w, h);
      else camera.clearViewOffset();
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(fit);
    ro.observe(host);
    const io = new IntersectionObserver(
      ([e]) => {
        visible = e.isIntersecting;
      },
      { rootMargin: "80px" },
    );
    io.observe(host);
    fit();

    const flyTo = (
      pos: THREE.Vector3,
      target: THREE.Vector3,
      dur: number,
      fov = camera.fov,
    ) => {
      if (reduce) dur = 0.01;
      tween = {
        p0: camera.position.clone(),
        p1: pos,
        t0: controls.target.clone(),
        t1: target,
        f0: camera.fov,
        f1: fov,
        start: performance.now(),
        dur,
      };
    };

    /** Frame a box from the current viewing direction, elevation clamped. */
    const frame = (box: THREE.Box3, dur: number, pad = 1) => {
      if (!asm) return;
      const minR = asm.span * (asm.span < 10 ? 0.22 : 0.14);
      const size = box.getSize(new THREE.Vector3());
      const grow = Math.max(0, minR * 2 - Math.max(size.x, size.y, size.z)) / 2;
      const b = box.clone().expandByScalar(grow);
      const center = b.getCenter(new THREE.Vector3());
      center.lerp(asm.bounds.getCenter(new THREE.Vector3()), 0.08);

      const dir = camera.position.clone().sub(controls.target);
      if (dir.lengthSq() < 1e-6) dir.copy(DEFAULT_DIR);
      dir.normalize();
      const el = THREE.MathUtils.clamp(Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1)), 0.3, 1.1);
      const flat = new THREE.Vector3(dir.x, 0, dir.z);
      if (flat.lengthSq() < 1e-6) flat.set(DEFAULT_DIR.x, 0, DEFAULT_DIR.z);
      flat.normalize();
      dir.copy(flat.multiplyScalar(Math.cos(el))).setY(Math.sin(el));

      // tight fit: distance at which every corner lands inside the frustum
      const up = new THREE.Vector3(0, 1, 0);
      const right = new THREE.Vector3().crossVectors(up, dir).normalize();
      const camUp = new THREE.Vector3().crossVectors(dir, right);
      const tv = Math.tan(THREE.MathUtils.degToRad(FOV) / 2);
      const th = tv * camera.aspect;
      let dist = 0;
      const p = new THREE.Vector3();
      for (let i = 0; i < 8; i++) {
        p.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).sub(center);
        const z = p.dot(dir);
        dist = Math.max(dist, z + Math.abs(p.dot(right)) / th, z + Math.abs(p.dot(camUp)) / tv);
      }
      dist *= 1.08 * pad;
      flyTo(center.clone().add(dir.multiplyScalar(dist)), center, dur, FOV);
    };

    const stepBox = (s: number) => {
      if (!asm) return new THREE.Box3();
      const f = asm.steps[s]?.focus;
      return f && !f.isEmpty() ? f.clone() : asm.bounds.clone();
    };

    const walkTo = (i: number, first: boolean) => {
      const stops = live.current.info.walk;
      if (!stops || !stops[i]) return;
      const s = stops[i];
      const pos = new THREE.Vector3(s.at[0], s.eye, s.at[1]);
      const look = new THREE.Vector3(s.look[0], s.look[1], s.look[2]);
      const d = camera.position.distanceTo(pos);
      flyTo(pos, look, first ? 2.6 : THREE.MathUtils.clamp(d / 12, 1.4, 4), WALK_FOV);
    };

    api.current = {
      setStep(s, animate) {
        if (!asm) return;
        showStep(asm, s, performance.now(), animate && !reduce);
        labelShownAt = performance.now() + (reduce ? 0 : 350);
        labelEl.style.opacity = "0";
        labelText.textContent = live.current.info.steps[s]?.label ?? "";
        if (!walking) frame(stepBox(s), 1.1, 1.15);
      },
      setWalk(w) {
        if (!asm) return;
        if (w === null) {
          if (!walking) return;
          walking = false;
          controls.enabled = true;
          frame(asm.bounds, 1.6);
          return;
        }
        const first = !walking;
        walking = true;
        controls.enabled = false;
        labelEl.style.opacity = "0";
        walkTo(w, first);
      },
      fit() {
        if (!asm) return;
        frame(asm.bounds, 1.1);
      },
    };

    const project = new THREE.Vector3();
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!visible || live.current.hidden) return;
      const now = performance.now();
      if (asm) tickParts(asm, now);

      if (tween) {
        const k = Math.min(1, (now - tween.start) / 1000 / tween.dur);
        const e = ease(k);
        camera.position.lerpVectors(tween.p0, tween.p1, e);
        controls.target.lerpVectors(tween.t0, tween.t1, e);
        camera.fov = tween.f0 + (tween.f1 - tween.f0) * e;
        camera.updateProjectionMatrix();
        if (k >= 1) tween = null;
      }
      if (walking) camera.lookAt(controls.target);
      else controls.update();

      // floating label pinned to the newest part
      if (asm && !walking) {
        const meta = asm.steps[live.current.step];
        if (meta) {
          project.copy(meta.anchor).project(camera);
          const w = host.clientWidth;
          const h = host.clientHeight;
          const onScreen =
            project.z < 1 && Math.abs(project.x) < 1.05 && Math.abs(project.y) < 1.05;
          const x = (project.x * 0.5 + 0.5) * w;
          const y = (-project.y * 0.5 + 0.5) * h;
          labelEl.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
          labelEl.style.opacity = onScreen && now >= labelShownAt ? "1" : "0";
        }
      }
      renderer.render(scene, camera);
    };
    tick();

    void Promise.all([loadArtifactMaterials(), loadStudioEnv(renderer), loadBuildModel(id)]).then(
      ([mats, envMap, model]) => {
        if (cancelled) return;
        scene.environment = envMap;
        scene.environmentIntensity = env === ENV.sanctuary ? 0.55 : 0.45;
        asm = assembleBuild(id, mats, model);
        scene.add(asm.root);

        const { span, bounds } = asm;
        const center = bounds.getCenter(new THREE.Vector3());
        camera.near = Math.max(0.02, span * 0.004);
        camera.far = span * 40;
        camera.updateProjectionMatrix();
        controls.minDistance = span * 0.04;
        controls.maxDistance = span * 3.5;
        scene.fog = new THREE.Fog(env.fog, span * 2.2, span * 9);

        const sky = skyDome(env, span * 25);
        const ground = new THREE.Mesh(
          new THREE.CircleGeometry(span * 22, 64),
          new THREE.MeshStandardMaterial({ color: env.ground, roughness: 1, metalness: 0 }),
        );
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.01;
        ground.receiveShadow = true;
        scene.add(sky, ground);
        extras.push(sky, ground);

        const [dx, dy, dz] = env.sunDir;
        sun.position.copy(center).add(new THREE.Vector3(dx, dy, dz).multiplyScalar(span * 1.6));
        sun.target.position.copy(center);
        const sc = sun.shadow.camera;
        const half = span * 0.72;
        sc.left = -half;
        sc.right = half;
        sc.top = half;
        sc.bottom = -half;
        sc.near = span * 0.1;
        sc.far = span * 4;
        sc.updateProjectionMatrix();
        sun.shadow.bias = -0.0004;
        sun.shadow.normalBias = span * 0.0006;

        // start on the whole structure, then settle on the step
        const r = bounds.getBoundingSphere(new THREE.Sphere()).radius;
        controls.target.copy(center);
        camera.position.copy(center).add(DEFAULT_DIR.clone().multiplyScalar(r * 2.6));
        controls.update();

        live.current.onReady?.({
          steps: asm.steps.map((s) => ({ parts: s.parts, tally: s.tally })),
        });
        api.current?.setStep(live.current.step, true);
        if (live.current.walk !== null) api.current?.setWalk(live.current.walk);
      },
    );

    return () => {
      cancelled = true;
      api.current = null;
      window.removeEventListener("buildstage:probe", probe);
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      controls.dispose();
      if (asm) disposeGroup(asm.root);
      for (const o of extras) disposeGroup(o);
      renderer.dispose();
      canvas.remove();
    };
  }, [id]);

  useEffect(() => {
    api.current?.setStep(step, true);
  }, [step]);

  useEffect(() => {
    api.current?.setWalk(walk);
  }, [walk]);

  useEffect(() => {
    if (fitNonce) api.current?.fit();
  }, [fitNonce]);

  return (
    <div ref={hostRef} className="relative h-full w-full overflow-hidden">
      <div
        ref={labelRef}
        className="pointer-events-none absolute left-0 top-0 opacity-0 transition-opacity duration-300"
        aria-hidden
      >
        <div className="absolute bottom-0 left-0 flex -translate-x-1/2 flex-col items-center">
          <span
            ref={labelTextRef}
            className="whitespace-nowrap border border-[#e2b850]/60 bg-[#141210]/85 px-2.5 py-1 font-display text-[11px] font-bold tracking-wide text-[#f4efe6] shadow-lg backdrop-blur-sm"
          />
          <span className="h-6 w-px bg-[#e2b850]/80" />
          <span className="-mb-1 h-2 w-2 rounded-full border border-[#141210] bg-[#e2b850]" />
        </div>
      </div>
    </div>
  );
}
