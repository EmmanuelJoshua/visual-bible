"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { ArtifactId } from "@/data/artifacts";
import { disposeGroup, loadArtifactObject } from "@/lib/artifacts/geometry";
import {
  loadArtifactMaterials,
  loadStudioEnv,
} from "@/lib/artifacts/materials";

type Mode = "orbit" | "place";

export function ObjectStage({
  artifactId,
  mode = "orbit",
  ink = false,
  className = "",
}: {
  artifactId: ArtifactId;
  mode?: Mode;
  ink?: boolean;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let cancelled = false;
    let raf = 0;
    let model: THREE.Group | null = null;
    let ground: THREE.Mesh | null = null;
    const ac = new AbortController();
    const ro = new ResizeObserver(() => fit());
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
      },
      { rootMargin: "80px" },
    );

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = ink ? 1.2 : 1.25;
    host.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.touchAction = "none";
    renderer.domElement.style.cursor = "grab";

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 600);
    const pivot = new THREE.Group();
    scene.add(pivot);
    scene.add(new THREE.AmbientLight(ink ? 0x6a5040 : 0xfff4e4, 0.45));
    scene.add(
      new THREE.HemisphereLight(ink ? 0xffe2b8 : 0xf2e6d0, 0x1a1612, 0.7),
    );

    const rot = { x: 0.18, y: 0.4 };
    const pan = { x: 0, z: 0 };
    let zoom = 1;
    const pointer = { id: -1, x: 0, y: 0 };
    let hovering = false;
    let visible = true;
    let origin = new THREE.Vector3(4, 3, 5);
    let span = 4;

    const fit = () => {
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };

    const canvas = renderer.domElement;
    const sig = { signal: ac.signal };
    canvas.addEventListener(
      "pointerdown",
      (e) => {
        pointer.id = e.pointerId;
        pointer.x = e.clientX;
        pointer.y = e.clientY;
        canvas.setPointerCapture(e.pointerId);
        canvas.style.cursor = "grabbing";
      },
      sig,
    );
    canvas.addEventListener(
      "pointermove",
      (e) => {
        if (pointer.id !== e.pointerId) return;
        const dx = e.clientX - pointer.x;
        const dy = e.clientY - pointer.y;
        pointer.x = e.clientX;
        pointer.y = e.clientY;
        if (modeRef.current === "place") {
          const k = span * 0.0022;
          pan.x += dx * k;
          pan.z += dy * k;
        } else {
          rot.y += dx * 0.008;
          rot.x += dy * 0.006;
          rot.x = Math.max(-0.9, Math.min(1.15, rot.x));
        }
      },
      sig,
    );
    const endPointer = (e: PointerEvent) => {
      if (pointer.id !== e.pointerId) return;
      pointer.id = -1;
      canvas.style.cursor = "grab";
    };
    canvas.addEventListener("pointerup", endPointer, sig);
    canvas.addEventListener("pointercancel", endPointer, sig);
    canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        zoom *= e.deltaY > 0 ? 1.08 : 0.92;
        zoom = Math.max(0.55, Math.min(2.4, zoom));
      },
      { passive: false, signal: ac.signal },
    );
    canvas.addEventListener("pointerenter", () => {
      hovering = true;
    }, sig);
    canvas.addEventListener("pointerleave", () => {
      hovering = false;
    }, sig);

    fit();
    ro.observe(host);
    io.observe(host);

    let last = performance.now();
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!visible || !model) return;
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (!reduce && pointer.id < 0 && !hovering && modeRef.current === "orbit") {
        rot.y += dt * 0.22;
      }
      pivot.rotation.set(rot.x, rot.y, 0);
      pivot.position.set(pan.x, 0, pan.z);
      camera.position.copy(origin).multiplyScalar(zoom);
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    };
    tick();

    void Promise.all([loadArtifactMaterials(), loadStudioEnv(renderer)])
      .then(async ([mats, env]) => [await loadArtifactObject(artifactId, mats), env] as const)
      .then(([loaded, env]) => {
        if (cancelled) return;
        scene.environment = env;

        model = loaded;
        pivot.add(model);

        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center);
        model.position.y += size.y / 2;

        span = Math.max(size.x, size.y, size.z);
        const dist = span * 1.55;
        camera.position.set(dist * 0.65, dist * 0.42, dist * 0.85);
        camera.lookAt(0, 0, 0);
        camera.near = Math.max(0.05, span * 0.01);
        camera.far = span * 20;
        camera.updateProjectionMatrix();
        origin = camera.position.clone();

        const key = new THREE.DirectionalLight(0xfff1d6, 2.1);
        key.position.set(span * -0.6, span * 1.4, span * 0.9);
        key.castShadow = true;
        key.shadow.mapSize.set(1024, 1024);
        const sc = key.shadow.camera;
        sc.near = span * 0.05;
        sc.far = span * 6;
        sc.left = -span;
        sc.right = span;
        sc.top = span;
        sc.bottom = -span;
        scene.add(key);
        const rim = new THREE.DirectionalLight(0xc8392a, 0.22);
        rim.position.set(span * 0.8, span * 0.4, span * -0.6);
        scene.add(rim);

        ground = new THREE.Mesh(
          new THREE.CircleGeometry(span * 1.1, 48),
          new THREE.ShadowMaterial({ opacity: ink ? 0.5 : 0.28 }),
        );
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -size.y / 2;
        ground.receiveShadow = true;
        pivot.add(ground);

        if (reduce) {
          cancelAnimationFrame(raf);
          renderer.render(scene, camera);
        }
      },
    );

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ac.abort();
      ro.disconnect();
      io.disconnect();
      if (model) disposeGroup(model);
      if (ground) {
        ground.geometry.dispose();
        (ground.material as THREE.Material).dispose();
      }
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [artifactId, ink]);

  return (
    <div
      ref={hostRef}
      className={`relative h-full w-full overflow-hidden ${className}`}
    />
  );
}
