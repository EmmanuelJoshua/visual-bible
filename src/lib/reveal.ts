import { corePersonBySlug, loadAllPeople } from "@/data";
import type { Person } from "@/data/types";
import { useExplorerStore } from "@/store/useExplorerStore";

/**
 * Makes a person visible in the genealogy graph (expanding their paternal
 * chain until it joins the visible graph) and selects them.
 */
export async function revealAndSelect(slug: string) {
  const store = useExplorerStore.getState();
  const all = await loadAllPeople();
  const bySlug = new Map(all.map((p) => [p.slug, p]));
  const visible = (s: string) =>
    corePersonBySlug.has(s) || store.expanded.includes(s);

  const chain: string[] = [];
  let cur: Person | undefined = bySlug.get(slug) ?? corePersonBySlug.get(slug);
  let guard = 0;
  while (cur && !visible(cur.slug) && guard++ < 40) {
    chain.push(cur.slug);
    cur = cur.father ? bySlug.get(cur.father) : undefined;
  }
  if (chain.length) store.expand(chain);
  store.select(slug);
}
