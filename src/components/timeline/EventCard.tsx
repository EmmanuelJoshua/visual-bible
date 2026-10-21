"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import type { BibleEvent } from "@/data/types";
import { formatYear } from "@/data/types";
import { getPersonSync } from "@/data";
import { artifactById, artifactIdByEventId } from "@/data/artifacts";

const ObjectStage = dynamic(
  () =>
    import("@/components/artifacts/ObjectStage").then((m) => m.ObjectStage),
  { ssr: false },
);

function prettifySlug(slug: string): string {
  const base = slug.replace(/_\d+$/, "").replace(/_/g, " ");
  return base.charAt(0).toUpperCase() + base.slice(1);
}

export function EventCard({
  event,
  index,
  side,
  highlighted,
}: {
  event: BibleEvent;
  index: number;
  side: "left" | "right";
  highlighted: boolean;
}) {
  const participants = (event.participants ?? []).slice(0, 5);
  const artifactId = artifactIdByEventId.get(event.id);
  const artifact = artifactId ? artifactById.get(artifactId) : undefined;

  return (
    <div
      id={`event-${event.id}`}
      className={`relative flex w-full ${side === "left" ? "justify-start pr-[calc(50%+20px)]" : "justify-end pl-[calc(50%+20px)]"} max-md:!justify-end max-md:!pl-12 max-md:!pr-0`}
    >
      {/* node on the spine */}
      <span
        className={`absolute top-4 left-1/2 z-10 h-2 w-2 -translate-x-1/2 max-md:left-4 ${
          highlighted ? "scale-150 bg-accent" : "bg-accent-dim"
        }`}
      />
      <motion.article
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className={`w-full max-w-md border bg-paper px-4 py-3 transition-colors ${
          highlighted
            ? "border-accent shadow-[5px_5px_0_rgba(180,38,26,0.2)]"
            : "border-line-strong hover:border-foreground/50"
        }`}
      >
        <div className="flex items-baseline gap-3">
          <span className="shrink-0 text-[10px] font-semibold tracking-[0.1em] text-accent">
            {String(index + 1).padStart(2, "0")}
          </span>
          <h3 className="font-display text-[16px] font-bold leading-snug tracking-tight text-foreground">
            {event.title}
          </h3>
          <span className="micro-label ml-auto shrink-0 !text-[10px] text-faint">
            {formatYear(event.startYear)}
          </span>
        </div>
        {event.ref && (
          <div className="mt-1 pl-[26px] text-[11px] italic text-faint">
            {event.ref}
          </div>
        )}
        {participants.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5 pl-[26px]">
            {participants.map((slug) =>
              slug === "god" ? (
                <span
                  key={slug}
                  className="border border-line px-2 py-0.5 text-[10px] text-muted"
                >
                  God
                </span>
              ) : (
                <Link
                  key={slug}
                  href={`/genealogy?person=${slug}`}
                  className="border border-line px-2 py-0.5 text-[10px] text-muted transition-colors hover:border-accent hover:text-accent"
                >
                  {getPersonSync(slug)?.name ?? prettifySlug(slug)}
                </Link>
              ),
            )}
            {(event.participants?.length ?? 0) > 5 && (
              <span className="px-1 text-[10px] text-faint">
                +{event.participants!.length - 5} more
              </span>
            )}
          </div>
        )}
        {artifactId && artifact && (
          <div className="mt-3 border-t border-line pt-3">
            <div className="relative h-40 overflow-hidden border border-line bg-surface">
              <ObjectStage artifactId={artifactId} />
            </div>
            <Link
              href={`/artifacts?object=${artifactId}`}
              className="mt-2 inline-block text-[11px] text-accent underline decoration-dotted underline-offset-2 hover:text-accent-bright"
            >
              Cubit model · {artifact.name} ↗
            </Link>
          </div>
        )}
      </motion.article>
    </div>
  );
}
