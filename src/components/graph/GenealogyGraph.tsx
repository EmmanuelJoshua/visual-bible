"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  MiniMap,
  Controls,
  useReactFlow,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { corePeople, messianicSet, loadAllPeople, getAllPeopleSync } from "@/data";
import type { Person } from "@/data/types";
import { ERAS } from "@/data/eras";
import { layoutFamily, lineageOf, NODE_WIDTH, NODE_HEIGHT } from "@/lib/graphLayout";
import { useExplorerStore } from "@/store/useExplorerStore";
import { PersonNode, type PersonFlowNode } from "./PersonNode";

function LabelNode({ data }: { data: { text: string } }) {
  return (
    <div className="pointer-events-none whitespace-nowrap text-[11px] uppercase tracking-[0.25em] text-faint">
      {data.text}
    </div>
  );
}

const nodeTypes = { person: PersonNode, label: LabelNode };

function eraOfPerson(p: Person): string {
  const year = p.birthYear ?? p.minYear;
  for (const era of ERAS) if (year <= era.endYear) return era.id;
  return "church";
}

function GraphInner() {
  const selected = useExplorerStore((s) => s.selected);
  const isolated = useExplorerStore((s) => s.isolated);
  const eraFilter = useExplorerStore((s) => s.eraFilter);
  const expanded = useExplorerStore((s) => s.expanded);
  const select = useExplorerStore((s) => s.select);
  const expand = useExplorerStore((s) => s.expand);

  const { setCenter } = useReactFlow();
  const [, forceRender] = useState(0);

  /* ----- visible people: curated core + user-expanded extras ----- */
  const visiblePeople = useMemo(() => {
    if (!expanded.length) return corePeople;
    const bySlug = new Map(corePeople.map((p) => [p.slug, p]));
    const all = getAllPeopleSync();
    if (all) {
      const allBySlug = new Map(all.map((p) => [p.slug, p]));
      for (const slug of expanded) {
        if (!bySlug.has(slug)) {
          const p = allBySlug.get(slug);
          if (p) bySlug.set(slug, p);
        }
      }
    }
    return [...bySlug.values()];
  }, [expanded]);

  const bySlug = useMemo(
    () => new Map(visiblePeople.map((p) => [p.slug, p])),
    [visiblePeople],
  );

  const layout = useMemo(
    () => layoutFamily(visiblePeople, messianicSet),
    [visiblePeople],
  );

  /* ----- expand-on-demand ----- */
  const handleExpand = useCallback(
    async (slug: string) => {
      const all = await loadAllPeople();
      forceRender((n) => n + 1); // all-people cache is now warm
      const allBySlug = new Map(all.map((p) => [p.slug, p]));
      const p = allBySlug.get(slug);
      if (!p) return;
      const relatives = [
        p.father,
        p.mother,
        ...(p.partners ?? []),
        ...(p.children ?? []),
      ].filter((s): s is string => !!s && !bySlug.has(s));
      if (relatives.length) expand(relatives);
    },
    [bySlug, expand],
  );

  /* ----- dimming: isolate-lineage or era filter ----- */
  const lineage = useMemo(
    () => (isolated ? lineageOf(isolated, bySlug) : null),
    [isolated, bySlug],
  );

  const isDimmed = useCallback(
    (p: Person) => {
      if (lineage) return !lineage.has(p.slug);
      if (eraFilter) return eraOfPerson(p) !== eraFilter;
      return false;
    },
    [lineage, eraFilter],
  );

  /* ----- React Flow nodes & edges ----- */
  const nodes = useMemo(() => {
    const personNodes: PersonFlowNode[] = layout.nodes.map(({ person, x, y }) => {
        const hiddenRelatives = [
          person.father,
          person.mother,
          ...(person.partners ?? []),
          ...(person.children ?? []),
        ].filter((s): s is string => !!s && !bySlug.has(s)).length;
        return {
          id: person.slug,
          type: "person" as const,
          position: { x, y },
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
          data: {
            person,
            dimmed: isDimmed(person),
            selected: selected === person.slug,
            hiddenRelatives,
            onExpand: handleExpand,
          },
        };
      });
    const labelNode = {
      id: "__singleton-label",
      type: "label" as const,
      position: {
        x: layout.singletonOrigin.x,
        y: layout.singletonOrigin.y + 40,
      },
      data: { text: "Figures without recorded lineage" },
      selectable: false,
      draggable: false,
    };
    return [...personNodes, labelNode];
  }, [layout, bySlug, isDimmed, selected, handleExpand]);

  const edges: Edge[] = useMemo(
    () =>
      layout.edges.map((e) => {
        const dim =
          (lineage && !(lineage.has(e.source) && lineage.has(e.target))) ||
          (eraFilter &&
            (isDimmed(bySlug.get(e.source)!) || isDimmed(bySlug.get(e.target)!)));
        if (e.kind === "partner") {
          return {
            id: e.id,
            source: e.source,
            target: e.target,
            style: {
              stroke: "#8a7f70",
              strokeDasharray: "4 4",
              strokeWidth: 1,
              opacity: dim ? 0.06 : 0.5,
            },
            type: "straight",
            focusable: false,
          };
        }
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          animated: e.messianic && !dim,
          style: e.messianic
            ? {
                stroke: "#b4261a",
                strokeWidth: 2,
                opacity: dim ? 0.08 : 0.95,
              }
            : {
                stroke: "#141210",
                strokeWidth: 1,
                opacity: dim ? 0.05 : 0.35,
              },
          type: "smoothstep",
          focusable: false,
        };
      }),
    [layout.edges, lineage, eraFilter, isDimmed, bySlug],
  );

  /* ----- initial camera: begin the story at Adam ----- */
  const handleInit = useCallback(() => {
    // opened on someone (a deep link, or from the map): start on them
    const selected = useExplorerStore.getState().selected;
    const start = selected && layout.nodes.find((n) => n.person.slug === selected);
    if (start) {
      setCenter(start.x + NODE_WIDTH / 2, start.y + NODE_HEIGHT / 2, { zoom: 1.1, duration: 0 });
      return;
    }
    if (selected) return;
    const adam = layout.nodes.find((n) => n.person.slug === "adam_78");
    if (adam) {
      setCenter(adam.x + NODE_WIDTH / 2, adam.y + 260, { zoom: 0.7, duration: 0 });
    }
  }, [layout.nodes, setCenter]);

  /* ----- fly to the selected person ----- */
  const lastFlown = useRef<string | null>(null);
  useEffect(() => {
    if (!selected || selected === lastFlown.current) return;
    const node = layout.nodes.find((n) => n.person.slug === selected);
    if (node) {
      lastFlown.current = selected;
      setCenter(node.x + NODE_WIDTH / 2, node.y + NODE_HEIGHT / 2, {
        zoom: 1.1,
        duration: 700,
      });
    }
  }, [selected, layout.nodes, setCenter]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onInit={handleInit}
      onNodeClick={(_, node) => {
        if (node.type === "person") select(node.id);
      }}
      onPaneClick={() => select(null)}
      minZoom={0.03}
      maxZoom={2}
      onlyRenderVisibleElements
      nodesDraggable={false}
      nodesConnectable={false}
      edgesFocusable={false}
      proOptions={{ hideAttribution: true }}
      className="!bg-transparent"
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={36}
        size={1.2}
        color="#cfc5b2"
      />
      <Controls showInteractive={false} position="bottom-right" />
      <MiniMap
        position="bottom-left"
        pannable
        zoomable
        className="!h-28 !w-44"
        maskColor="rgba(244,239,230,0.82)"
        nodeColor={(n) =>
          (n as PersonFlowNode).data?.person?.messianic ? "#b4261a" : "#c4baa6"
        }
        nodeStrokeWidth={0}
      />
    </ReactFlow>
  );
}

export function GenealogyGraph() {
  return (
    <ReactFlowProvider>
      <GraphInner />
    </ReactFlowProvider>
  );
}
