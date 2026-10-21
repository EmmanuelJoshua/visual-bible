"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { flatten, storyById, STORIES } from "@/story";
import { useStoryStore } from "@/story/store";
import { useJourneyStore } from "@/components/journeys/store";

const GOLD = "#d9b45a";
const iconBtn =
  "flex h-8 w-8 items-center justify-center rounded-full border border-white/20 text-white/80 transition-colors hover:border-white/60 hover:text-white disabled:opacity-30";

/** the "start a story" entry point, shown while exploring freely */
export function StoryLauncher() {
  const storyId = useStoryStore((s) => s.storyId);
  const start = useStoryStore((s) => s.start);
  const [open, setOpen] = useState(false);
  if (storyId) return null;
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full border border-[#d9b45a]/70 bg-[#0d0b09]/80 px-3.5 py-1.5 text-[12px] font-semibold text-white backdrop-blur-md transition-colors hover:border-[#d9b45a] hover:bg-[#0d0b09]"
      >
        <svg viewBox="0 0 16 16" className="h-3 w-3" fill={GOLD} aria-hidden>
          <path d="M4 2.5v11a.8.8 0 0 0 1.2.7l9-5.5a.8.8 0 0 0 0-1.4l-9-5.5A.8.8 0 0 0 4 2.5Z" />
        </svg>
        Story mode
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 w-[min(320px,calc(100vw-32px))] rounded-md border border-white/15 bg-[#0d0b09]/95 p-2 shadow-2xl backdrop-blur-md">
          {STORIES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setOpen(false);
                start(s.id);
              }}
              className="block w-full rounded-sm px-3 py-2.5 text-left transition-colors hover:bg-white/8"
            >
              <div className="font-display text-[15px] font-extrabold text-white">{s.title}</div>
              <div className="mt-0.5 text-[12px] text-white/60">{s.subtitle}</div>
              <div className="micro-label mt-1.5 !text-[9.5px]" style={{ color: GOLD }}>
                {s.chapters.length} chapters · {flatten(s).length} scenes
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** narration and controls while a story runs; a small pill while exploring off it */
export function StoryOverlay() {
  const storyId = useStoryStore((s) => s.storyId);
  const index = useStoryStore((s) => s.index);
  const status = useStoryStore((s) => s.status);
  const reduceMotion = useReducedMotion();
  const story = storyId ? storyById.get(storyId) : undefined;
  if (!story) return null;
  const scenes = flatten(story);
  const pos = scenes[index];
  const { next, prev, goTo, setStatus, resume, exit } = useStoryStore.getState();
  const last = scenes.length - 1;

  if (status === "exploring")
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={resume}
          className="flex items-center gap-2 rounded-full bg-[#d9b45a] px-3.5 py-1.5 text-[12px] font-bold text-[#0d0b09] shadow-[0_0_20px_rgba(217,180,90,0.4)] transition-transform hover:scale-[1.03]"
        >
          <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor" aria-hidden>
            <path d="M4 2.5v11a.8.8 0 0 0 1.2.7l9-5.5a.8.8 0 0 0 0-1.4l-9-5.5A.8.8 0 0 0 4 2.5Z" />
          </svg>
          Resume · {pos.chapter.title}
        </button>
        <button
          type="button"
          onClick={exit}
          className="rounded-full border border-white/20 bg-[#0d0b09]/70 px-3 py-1.5 text-[12px] text-white/70 backdrop-blur-md hover:text-white"
        >
          End story
        </button>
      </div>
    );

  return (
    <div className="w-[min(420px,calc(100vw-32px))] rounded-md border border-[#d9b45a]/50 bg-[#0d0b09]/90 text-white shadow-2xl backdrop-blur-md">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2">
        <div className="micro-label truncate !text-[10px]" style={{ color: GOLD }}>
          {story.title} · Chapter {pos.chapterIndex + 1} of {story.chapters.length}
        </div>
        <button
          type="button"
          onClick={exit}
          className="shrink-0 p-1 text-white/50 hover:text-white"
          aria-label="End story"
        >
          <svg width="11" height="11" viewBox="0 0 14 14" fill="none" aria-hidden>
            <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={pos.scene.id}
          initial={reduceMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
          transition={{ duration: 0.3 }}
          className="px-4 pb-3 pt-3"
        >
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">
            {pos.chapter.title}
          </div>
          <h2 className="font-display mt-1 text-[19px] font-extrabold leading-tight sm:text-[21px]">
            {pos.scene.title}
          </h2>
          <p className="mt-2 text-[13.5px] leading-relaxed text-white/85">{pos.scene.narration}</p>
          {pos.scene.ref && (
            <div className="mt-1.5 text-[12px]" style={{ color: GOLD }}>
              {pos.scene.ref}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* progress: one dash per scene, a gap between chapters */}
      <div className="flex gap-2 px-4">
        {story.chapters.map((c, ci) => (
          <div key={c.id} className="flex flex-1 gap-0.5" title={c.title}>
            {scenes
              .filter((s) => s.chapterIndex === ci)
              .map((s) => (
                <button
                  key={s.scene.id}
                  type="button"
                  onClick={() => goTo(s.index)}
                  aria-label={`Scene: ${s.scene.title}`}
                  className="h-3 flex-1 py-1"
                >
                  <span
                    className="block h-full rounded-full"
                    style={{
                      background: s.index <= index ? GOLD : "rgba(255,255,255,0.18)",
                    }}
                  />
                </button>
              ))}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 px-4 pb-3 pt-2">
        <button type="button" className={iconBtn} onClick={prev} disabled={index === 0} aria-label="Previous scene">
          <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor" aria-hidden>
            <path d="M3 2h2v12H3zM14 2.8v10.4a.6.6 0 0 1-.9.5L6 8.5a.6.6 0 0 1 0-1l7.1-5.2a.6.6 0 0 1 .9.5Z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => (status === "playing" ? setStatus("paused") : resume())}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[#d9b45a] text-[#0d0b09]"
          aria-label={status === "playing" ? "Pause story" : "Play story"}
        >
          {status === "playing" ? (
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
              <rect x="3" y="2" width="3.5" height="12" rx="1" />
              <rect x="9.5" y="2" width="3.5" height="12" rx="1" />
            </svg>
          ) : (
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
              <path d="M4 2.5v11a.8.8 0 0 0 1.2.7l9-5.5a.8.8 0 0 0 0-1.4l-9-5.5A.8.8 0 0 0 4 2.5Z" />
            </svg>
          )}
        </button>
        <button type="button" className={iconBtn} onClick={next} disabled={index === last} aria-label="Next scene">
          <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor" aria-hidden>
            <path d="M11 2h2v12h-2zM2 2.8v10.4a.6.6 0 0 0 .9.5L10 8.5a.6.6 0 0 0 0-1L2.9 2.3a.6.6 0 0 0-.9.5Z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => {
            setStatus("exploring");
            useJourneyStore.getState().setPlaying(false);
          }}
          className="micro-label ml-auto rounded-sm border border-white/25 px-3 py-2 !text-[10px] text-white/80 transition-colors hover:border-white/60 hover:text-white"
        >
          Explore from here
        </button>
      </div>
    </div>
  );
}
