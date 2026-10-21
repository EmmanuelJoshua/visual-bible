"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { ARTIFACTS, ARTIFACT_ERAS, artifactById, type ArtifactId } from "@/data/artifacts";

const ObjectStage = dynamic(
  () => import("./ObjectStage").then((m) => m.ObjectStage),
  { ssr: false },
);

const IDS = ARTIFACTS.map((a) => a.id);

function isArtifactId(v: string | null): v is ArtifactId {
  return !!v && IDS.includes(v as ArtifactId);
}

export function ArtifactsView() {
  const params = useSearchParams();
  const fromUrl = params.get("object");
  const [id, setId] = useState<ArtifactId>(
    isArtifactId(fromUrl) ? fromUrl : "ark",
  );
  const [mode, setMode] = useState<"orbit" | "place">("orbit");

  useEffect(() => {
    if (isArtifactId(fromUrl)) setId(fromUrl);
  }, [fromUrl]);
  const artifact = useMemo(() => artifactById.get(id)!, [id]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-10 px-4 pb-16 pt-24 sm:px-6 lg:flex-row lg:gap-14">
      <div className="flex max-w-xl flex-col justify-center lg:w-[42%]">
        <div className="mb-5 flex items-center gap-3">
          <span className="hairline w-10" />
          <span className="micro-label text-faint">Cubit-built · Three.js</span>
        </div>
        <h1 className="display-tight text-[12vw] text-foreground sm:text-5xl lg:text-6xl">
          Small models.
          <br />
          <span className="text-accent">True measure.</span>
        </h1>
        <p className="mt-5 max-w-md text-[15px] leading-relaxed text-muted">
          Geometry from the measurements in the text — 1 unit is 1 short cubit.
          Drag to turn. Switch to Place to slide the piece on the desk. Nothing
          here is a walkthrough; they are objects in the page.
        </p>

        <div className="mt-8 space-y-5">
          {ARTIFACT_ERAS.map((era) => (
            <div key={era}>
              <div className="micro-label mb-2 text-faint">{era}</div>
              <div className="flex flex-wrap gap-2">
                {ARTIFACTS.filter((a) => a.era === era).map((a) => (
                  <button
                    key={a.id}
                    onClick={() => {
                      setId(a.id);
                      history.replaceState(null, "", `/artifacts?object=${a.id}`);
                    }}
                    className={`border px-3 py-1.5 text-left transition-colors ${
                      a.id === id
                        ? "border-accent bg-accent text-[#f4efe6]"
                        : "border-line-strong bg-paper text-foreground hover:border-foreground"
                    }`}
                  >
                    <div className="font-display text-sm font-bold tracking-tight">
                      {a.name}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 border border-line-strong bg-paper px-5 py-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-2xl font-extrabold tracking-tight">
              {artifact.name}
            </h2>
            <span className="text-[13px] font-medium text-accent" dir="rtl">
              {artifact.hebrew}
            </span>
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-foreground/85">
            {artifact.summary}
          </p>
          <div className="mt-3 text-[11px] italic text-faint">
            {artifact.refs.join(" · ")}
          </div>
          <dl className="mt-4">
            {artifact.dims.map((d) => (
              <div
                key={d.label}
                className="flex items-baseline gap-3 border-t border-line py-1.5 text-[13px]"
              >
                <dt className="micro-label !text-[10px] text-faint">{d.label}</dt>
                <dd className="ml-auto text-foreground">
                  {d.cubits ? (
                    <>
                      {d.cubits}
                      {(d.unit ?? "cubits") !== "" && (
                        <span className="text-faint"> {d.unit ?? "cubits"}</span>
                      )}
                    </>
                  ) : (
                    <span className="text-faint">see note</span>
                  )}
                  {d.interpretive && (
                    <span className="ml-2 text-[10px] uppercase tracking-wider text-accent">
                      interpretive
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-[11px] text-faint">
            Short cubit taken as ≈18 in / 45 cm. Gold and bronze maps from{" "}
            <a
              href="https://ambientcg.com"
              target="_blank"
              rel="noreferrer"
              className="underline decoration-dotted underline-offset-2"
            >
              ambientCG
            </a>
            ; wood, linen, stone, and studio light from{" "}
            <a
              href="https://polyhaven.com"
              target="_blank"
              rel="noreferrer"
              className="underline decoration-dotted underline-offset-2"
            >
              Poly Haven
            </a>{" "}
            — all CC0. Reconstructing from cubits is a reading of the text, not
            a photograph of the original.
          </p>
        </div>
      </div>

      <div className="theme-ink relative min-h-[420px] flex-1 overflow-hidden lg:sticky lg:top-20 lg:h-[min(80vh,680px)] lg:min-h-0">
        <ObjectStage artifactId={id} mode={mode} ink />
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-5">
          <span className="micro-label !text-[10px] text-[#f4efe6]/40">
            fig. {String(IDS.indexOf(id) + 1).padStart(2, "0")}
          </span>
          <span className="micro-label !text-[10px] text-[#f4efe6]/40">
            1 cubit = 1 unit
          </span>
        </div>
        <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-3 p-5">
          <div className="pointer-events-none">
            <div className="micro-label text-[#f4efe6]/70">Drag to {mode}</div>
            <div className="mt-1 text-[12px] text-[#f4efe6]/40" dir="rtl">
              {artifact.hebrew}
            </div>
          </div>
          <div className="pointer-events-auto flex gap-2">
            {(["orbit", "place"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`micro-label border px-3 py-1.5 !text-[10px] ${
                  mode === m
                    ? "border-[#f4efe6] text-[#f4efe6]"
                    : "border-[#f4efe6]/30 text-[#f4efe6]/50 hover:border-[#f4efe6]/70"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
