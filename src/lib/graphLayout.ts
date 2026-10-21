import dagre from "@dagrejs/dagre";
import type { Person } from "@/data/types";

export const NODE_WIDTH = 176;
export const NODE_HEIGHT = 58;

export type LaidOutNode = {
  person: Person;
  x: number;
  y: number;
};

export type FamilyEdge = {
  id: string;
  source: string;
  target: string;
  kind: "parent" | "partner";
  messianic: boolean;
};

/**
 * Generation-layered layout: dagre ranks parent→child edges top-to-bottom,
 * which naturally stacks the genealogy by generation.
 */
export function layoutFamily(people: Person[], messianicSet: Set<string>) {
  const visible = new Set(people.map((p) => p.slug));
  const edges: FamilyEdge[] = [];

  for (const p of people) {
    for (const rel of ["father", "mother"] as const) {
      const parent = p[rel];
      if (parent && visible.has(parent)) {
        edges.push({
          id: `${rel}:${parent}->${p.slug}`,
          source: parent,
          target: p.slug,
          kind: "parent",
          messianic: messianicSet.has(parent) && messianicSet.has(p.slug),
        });
      }
    }
    for (const partner of p.partners ?? []) {
      // dedupe: only emit from the lexicographically smaller slug
      if (visible.has(partner) && p.slug < partner) {
        edges.push({
          id: `partner:${p.slug}<->${partner}`,
          source: p.slug,
          target: partner,
          kind: "partner",
          messianic: false,
        });
      }
    }
  }

  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: "TB",
    ranksep: 90,
    nodesep: 28,
    edgesep: 16,
    marginx: 60,
    marginy: 60,
  });
  g.setDefaultEdgeLabel(() => ({}));

  for (const p of people)
    g.setNode(p.slug, { width: NODE_WIDTH, height: NODE_HEIGHT });
  // Only parent edges participate in ranking; partner edges would distort
  // the generational layering.
  for (const e of edges)
    if (e.kind === "parent") g.setEdge(e.source, e.target);

  dagre.layout(g);

  // People with no family edges at all would otherwise be strewn across
  // rank 0 by dagre; collect them into a compact year-sorted grid beside
  // the main tree instead.
  const connected = new Set<string>();
  for (const e of edges) {
    connected.add(e.source);
    connected.add(e.target);
  }

  const nodes: LaidOutNode[] = [];
  let maxX = 0;
  let minY = Infinity;
  for (const p of people) {
    if (!connected.has(p.slug)) continue;
    const pos = g.node(p.slug);
    const x = pos.x - NODE_WIDTH / 2;
    const y = pos.y - NODE_HEIGHT / 2;
    maxX = Math.max(maxX, x + NODE_WIDTH);
    minY = Math.min(minY, y);
    nodes.push({ person: p, x, y });
  }
  if (!Number.isFinite(minY)) minY = 0;

  const singletons = people
    .filter((p) => !connected.has(p.slug))
    .sort((a, b) => (a.birthYear ?? a.minYear) - (b.birthYear ?? b.minYear));
  const COLS = 3;
  const GX = NODE_WIDTH + 32;
  const GY = NODE_HEIGHT + 26;
  singletons.forEach((p, i) => {
    nodes.push({
      person: p,
      x: maxX + 220 + (i % COLS) * GX,
      y: minY + 90 + Math.floor(i / COLS) * GY,
    });
  });

  return { nodes, edges, singletonOrigin: { x: maxX + 220, y: minY } };
}

/** Ancestors + descendants (and the person) within the visible set. */
export function lineageOf(
  slug: string,
  bySlug: Map<string, Person>,
): Set<string> {
  const keep = new Set<string>([slug]);
  // ancestors
  const up = [slug];
  while (up.length) {
    const p = bySlug.get(up.pop()!);
    if (!p) continue;
    for (const parent of [p.father, p.mother]) {
      if (parent && bySlug.has(parent) && !keep.has(parent)) {
        keep.add(parent);
        up.push(parent);
      }
    }
  }
  // descendants
  const down = [slug];
  while (down.length) {
    const p = bySlug.get(down.pop()!);
    if (!p) continue;
    for (const child of p.children ?? []) {
      if (bySlug.has(child) && !keep.has(child)) {
        keep.add(child);
        down.push(child);
      }
    }
  }
  return keep;
}
