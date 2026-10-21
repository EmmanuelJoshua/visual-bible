"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import type { Person } from "@/data/types";
import { lifespanLabel, formatYear } from "@/data/types";

export type PersonNodeData = {
  person: Person;
  dimmed: boolean;
  selected: boolean;
  hiddenRelatives: number;
  onExpand?: (slug: string) => void;
};

export type PersonFlowNode = Node<PersonNodeData, "person">;

function yearsLabel(p: Person): string {
  const span = lifespanLabel(p);
  if (span) return span;
  if (p.minYear) return `fl. ${formatYear(p.minYear)}`;
  return "";
}

export const PersonNode = memo(function PersonNode({
  data,
}: NodeProps<PersonFlowNode>) {
  const { person: p, dimmed, selected, hiddenRelatives, onExpand } = data;
  const messianic = !!p.messianic;

  return (
    <div
      className={`group relative w-[176px] border px-3 py-2 transition-all duration-200 ${
        selected
          ? "border-accent bg-paper shadow-[4px_4px_0_rgba(180,38,26,0.25)]"
          : messianic
            ? "border-accent/60 bg-paper hover:border-accent"
            : "border-line-strong bg-paper hover:border-foreground/60"
      } ${dimmed ? "opacity-15" : "opacity-100"}`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-1.5 !w-1.5 !border-0 !bg-accent-dim"
      />
      <div className="flex items-center gap-2">
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
            messianic
              ? "bg-accent"
              : p.gender === "F"
                ? "bg-[#a67a42]"
                : "bg-[#7a6f66]"
          }`}
        />
        <span
          className={`truncate font-display text-[13px] font-bold leading-tight tracking-tight ${
            messianic ? "text-accent" : "text-foreground"
          }`}
          title={p.name}
        >
          {p.name}
        </span>
      </div>
      <div className="mt-0.5 truncate pl-3.5 text-[10px] font-medium uppercase tracking-[0.08em] text-faint">
        {yearsLabel(p)}
      </div>
      {hiddenRelatives > 0 && onExpand && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onExpand(p.slug);
          }}
          className="absolute -bottom-2.5 left-1/2 z-10 -translate-x-1/2 border border-line-strong bg-paper px-1.5 py-px text-[9px] font-semibold text-muted opacity-0 transition-opacity hover:border-accent hover:text-accent group-hover:opacity-100"
          title={`Show ${hiddenRelatives} more relative${hiddenRelatives > 1 ? "s" : ""}`}
        >
          +{hiddenRelatives}
        </button>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-1.5 !w-1.5 !border-0 !bg-accent-dim"
      />
    </div>
  );
});
