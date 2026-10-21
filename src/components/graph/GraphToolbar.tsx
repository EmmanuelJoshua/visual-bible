"use client";

import { ERAS } from "@/data/eras";
import type { EraId } from "@/data/types";
import { useExplorerStore } from "@/store/useExplorerStore";
import { SearchBox } from "@/components/SearchBox";

export function GraphToolbar() {
  const eraFilter = useExplorerStore((s) => s.eraFilter);
  const setEraFilter = useExplorerStore((s) => s.setEraFilter);
  const selected = useExplorerStore((s) => s.selected);
  const isolated = useExplorerStore((s) => s.isolated);
  const isolate = useExplorerStore((s) => s.isolate);
  const reset = useExplorerStore((s) => s.reset);

  return (
    <div className="pointer-events-none absolute inset-x-0 top-16 z-20 flex flex-wrap items-center justify-center gap-2 px-4">
      <div className="pointer-events-auto">
        <SearchBox />
      </div>

      <div className="pointer-events-auto flex items-center gap-2 border border-line-strong bg-paper/90 px-2 py-1 backdrop-blur">
        <select
          value={eraFilter ?? ""}
          onChange={(e) =>
            setEraFilter((e.target.value || null) as EraId | null)
          }
          className="micro-label max-w-40 bg-transparent px-2 py-1 !text-[10px] text-muted outline-none [&>option]:bg-paper [&>option]:normal-case"
          aria-label="Filter by era"
        >
          <option value="">All eras</option>
          {ERAS.map((era) => (
            <option key={era.id} value={era.id}>
              {era.name}
            </option>
          ))}
        </select>

        <span className="h-4 w-px bg-line-strong" />

        <button
          onClick={() => isolate(isolated ? null : selected)}
          disabled={!selected && !isolated}
          className={`micro-label px-3 py-1 !text-[10px] transition-colors disabled:opacity-40 ${
            isolated
              ? "bg-accent text-[#f4efe6]"
              : "text-muted hover:text-foreground"
          }`}
          title="Dim everyone outside the selected person's lineage"
        >
          {isolated ? "Show all" : "Isolate lineage"}
        </button>

        <span className="h-4 w-px bg-line-strong" />

        <button
          onClick={reset}
          className="micro-label px-3 py-1 !text-[10px] text-muted transition-colors hover:text-foreground"
          title="Reset filters and expansions"
        >
          Reset
        </button>
      </div>

      <div className="pointer-events-auto hidden items-center gap-2 border border-line-strong bg-paper/90 px-3 py-2 backdrop-blur md:flex">
        <span className="h-0.5 w-6 bg-accent" />
        <span className="micro-label !text-[10px] text-faint">
          The scarlet thread — line of the Messiah
        </span>
      </div>
    </div>
  );
}
