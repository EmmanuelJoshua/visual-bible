"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { ARTIFACTS, ARTIFACT_ERAS, artifactById, type ArtifactId } from "@/data/artifacts";
import { BUILDS, BUILD_ORDER } from "@/data/builds";
import { BuildWorkbench } from "./BuildWorkbench";

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
    isArtifactId(fromUrl) ? fromUrl : BUILD_ORDER[0],
  );
  const stepFromUrl = Number(params.get("step"));
  const [mode, setMode] = useState<"orbit" | "place">("orbit");

  useEffect(() => {
    if (isArtifactId(fromUrl)) setId(fromUrl);
  }, [fromUrl]);
  const artifact = useMemo(() => artifactById.get(id)!, [id]);
  const build = BUILDS[id];
  const pick = (a: ArtifactId) => {
    setId(a);
    history.replaceState(null, "", `/artifacts?object=${a}`);
  };

  if (build) {
    return (
      <div className="mx-auto w-full max-w-[1440px] flex-1 px-4 pb-16 pt-24 sm:px-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-4 flex items-center gap-3">
              <span className="hairline w-10" />
              <span className="micro-label text-faint">Cubit-built · step by step</span>
            </div>
            <h1 className="display-tight text-[11vw] text-foreground sm:text-5xl lg:text-6xl">
              Build it <span className="text-accent">as written.</span>
            </h1>
          </div>
          <p className="max-w-md text-[14px] leading-relaxed text-muted">
            Each structure goes up part by part in the order the text gives it, with
            the verse for every step. 1 unit = 1 short cubit. Drag to orbit, scroll to
            zoom, or flip to the blueprint.
          </p>
        </div>
        <Picker id={id} onPick={pick} />
        <BuildWorkbench
          key={id}
          artifact={artifact}
          info={build}
          initialStep={
            fromUrl === id && stepFromUrl > 0 ? stepFromUrl - 1 : 0
          }
        />
      </div>
    );
  }

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

        <Picker id={id} onPick={pick} />

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

function Picker({ id, onPick }: { id: ArtifactId; onPick: (a: ArtifactId) => void }) {
  return (
    <div className="mt-8 space-y-4">
      <div>
        <div className="micro-label mb-2 text-faint">Step-by-step builds</div>
        <div className="flex flex-wrap gap-2">
          {BUILD_ORDER.map((bid) => (
            <PickButton key={bid} a={bid} on={bid === id} onPick={onPick} build />
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        {ARTIFACT_ERAS.map((era) => {
          const list = ARTIFACTS.filter((a) => a.era === era && !BUILDS[a.id]);
          if (!list.length) return null;
          return (
            <div key={era}>
              <div className="micro-label mb-2 text-faint">{era}</div>
              <div className="flex flex-wrap gap-2">
                {list.map((a) => (
                  <PickButton key={a.id} a={a.id} on={a.id === id} onPick={onPick} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PickButton({
  a,
  on,
  onPick,
  build,
}: {
  a: ArtifactId;
  on: boolean;
  onPick: (a: ArtifactId) => void;
  build?: boolean;
}) {
  const art = artifactById.get(a)!;
  return (
    <button
      onClick={() => onPick(a)}
      aria-pressed={on}
      className={`border text-left transition-colors ${build ? "px-4 py-2" : "px-3 py-1.5"} ${
        on
          ? "border-accent bg-accent text-[#f4efe6]"
          : "border-line-strong bg-paper text-foreground hover:border-foreground"
      }`}
    >
      <div className={`font-display font-bold tracking-tight ${build ? "text-[15px]" : "text-sm"}`}>
        {art.name}
      </div>
      {build && (
        <div className={`text-[10px] uppercase tracking-wider ${on ? "text-[#f4efe6]/75" : "text-faint"}`}>
          {BUILDS[a]?.steps.length} steps
        </div>
      )}
    </button>
  );
}
