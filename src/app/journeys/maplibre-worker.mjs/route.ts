import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const dynamic = "force-static";

/**
 * MapLibre v6 runs its tile parsing in a module worker that it looks for next
 * to its own bundle URL, which a bundler moves. Serving the worker from a
 * known path keeps it same-origin; under `output: "export"` this route is
 * written out as the static file `/journeys/maplibre-worker.mjs`.
 */
export async function GET() {
  const source = await readFile(
    join(process.cwd(), "node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs"),
    "utf8",
  );
  return new Response(source, {
    headers: { "Content-Type": "text/javascript; charset=utf-8" },
  });
}
