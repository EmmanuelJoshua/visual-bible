"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ThreeUIScene } from "@/components/atmosphere/ThreeUIScene";
import { corePeople, allEvents, messianicLine } from "@/data";

const fade = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
};

const stats: [string, string, string][] = [
  ["01", "3,066", "people in the full graph"],
  ["02", corePeople.length.toLocaleString(), "curated core figures"],
  ["03", allEvents.length.toLocaleString(), "dated events, Creation to AD 100"],
  ["04", messianicLine.length.toString(), "generations, Adam to Jesus"],
];

export function HomeHero() {
  return (
    <div className="flex min-h-dvh flex-col pt-14">
      <div className="mx-auto grid w-full max-w-7xl flex-1 gap-10 px-4 pb-10 pt-10 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
        {/* ---- editorial column ---- */}
        <div className="flex flex-col justify-center">
          <motion.div
            {...fade}
            transition={{ duration: 0.7, delay: 0.05 }}
            className="mb-6 flex items-center gap-3"
          >
            <span className="hairline w-10" />
            <span className="micro-label text-faint">
              From Adam to the Apostles
            </span>
            <span className="text-[12px] font-medium text-accent" dir="rtl">
              תולדות
            </span>
          </motion.div>

          <motion.h1
            {...fade}
            transition={{ duration: 0.7, delay: 0.18 }}
            className="display-tight text-[17vw] text-foreground sm:text-[11vw] lg:text-[6.6rem] xl:text-[7.6rem]"
          >
            One story.
            <br />
            <span className="text-accent">One family.</span>
          </motion.h1>

          <motion.p
            {...fade}
            transition={{ duration: 0.7, delay: 0.32 }}
            className="mt-7 max-w-md text-[15px] leading-relaxed text-muted"
          >
            Every genealogy in Scripture, woven into a single explorable graph —
            and four millennia of events on one cinematic timeline. Trace the
            scarlet thread from Eden to the empty tomb.
          </motion.p>

          <motion.div
            {...fade}
            transition={{ duration: 0.7, delay: 0.45 }}
            className="mt-9 flex flex-wrap items-center gap-3"
          >
            <Link
              href="/explore"
              className="micro-label bg-accent px-7 py-3.5 !text-[11px] text-[#f4efe6] transition-colors hover:bg-accent-bright"
            >
              Enter the World&ensp;→
            </Link>
            <Link
              href="/explore?story=dwelling"
              className="micro-label border border-line-strong px-7 py-3.5 !text-[11px] text-foreground transition-colors hover:border-foreground"
            >
              Start the Story
            </Link>
          </motion.div>

          {/* numbered index */}
          <motion.dl
            {...fade}
            transition={{ duration: 0.7, delay: 0.6 }}
            className="mt-12 max-w-lg"
          >
            {stats.map(([n, value, label]) => (
              <div
                key={n}
                className="flex items-baseline gap-4 border-t border-line py-2.5 last:border-b"
              >
                <span className="micro-label !text-[10px] text-accent">{n}</span>
                <dt className="font-display text-lg font-bold tracking-tight text-foreground">
                  {value}
                </dt>
                <dd className="micro-label ml-auto !text-[10px] text-faint">
                  {label}
                </dd>
              </div>
            ))}
          </motion.dl>
        </div>

        {/* ---- ink panel with the living tree ---- */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.9, delay: 0.3 }}
          className="theme-ink relative min-h-[420px] overflow-hidden lg:min-h-0"
        >
          <ThreeUIScene kind="tree" interactive className="!absolute" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between p-5">
            <div>
              <div className="micro-label text-[#f4efe6]/70">
                The family tree
              </div>
              <div className="mt-1 text-[12px] text-[#f4efe6]/40" dir="rtl">
                עץ המשפחה
              </div>
            </div>
            <div className="micro-label !text-[10px] text-[#f4efe6]/40">
              fig. 01
            </div>
          </div>
          <span className="pointer-events-none absolute left-5 top-5 micro-label !text-[10px] text-[#f4efe6]/40">
            Genesis — Revelation
          </span>
        </motion.div>
      </div>

      {/* ---- footer strip ---- */}
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-4 sm:px-6">
          <span className="micro-label !text-[10px] text-faint">Scroll — explore</span>
          <span className="micro-label !text-[10px] text-faint">
            Data:{" "}
            <a
              href="https://github.com/robertrouse/theographic-bible-metadata"
              target="_blank"
              rel="noreferrer"
              className="underline decoration-dotted underline-offset-2 hover:text-foreground"
            >
              Theographic
            </a>{" "}
            CC BY 4.0 · Scenes:{" "}
            <a
              href="https://threeui.com"
              target="_blank"
              rel="noreferrer"
              className="underline decoration-dotted underline-offset-2 hover:text-foreground"
            >
              ThreeUI
            </a>{" "}
            MIT
          </span>
        </div>
      </div>
    </div>
  );
}
