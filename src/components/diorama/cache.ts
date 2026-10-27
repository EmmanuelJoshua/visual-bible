/**
 * The diorama's files, kept in the browser's Cache Storage under the build's
 * version: downloaded once, then read from disk. A new build is a new cache;
 * older ones are deleted.
 */

const PREFIX = "diorama-v";

export class DioramaCache {
  private cache: Promise<Cache | null>;

  constructor(readonly version: number) {
    this.cache =
      typeof caches === "undefined"
        ? Promise.resolve(null)
        : caches
            .keys()
            .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== PREFIX + version).map((k) => caches.delete(k))))
            .then(() => caches.open(PREFIX + version))
            .catch(() => null);
  }

  url(path: string) {
    return `/diorama/${path}?v=${this.version}`;
  }

  /** the file, from disk if it's there; `onProgress(loaded, total)` while it downloads */
  async blob(path: string, onProgress?: (loaded: number, total: number) => void): Promise<Blob> {
    const url = this.url(path);
    const cache = await this.cache;
    const hit = await cache?.match(url).catch(() => undefined);
    if (hit) {
      const b = await hit.blob();
      onProgress?.(b.size, b.size);
      return b;
    }
    const res = await fetch(url);
    if (!res.ok || !res.body) throw new Error(`${res.status} ${url}`);
    const total = Number(res.headers.get("content-length")) || 0;
    const reader = res.body.getReader();
    const parts: Uint8Array[] = [];
    let loaded = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(value);
      loaded += value.length;
      onProgress?.(loaded, Math.max(total, loaded));
    }
    const blob = new Blob(parts as BlobPart[], { type: res.headers.get("content-type") ?? "" });
    void cache?.put(url, new Response(blob, { headers: { "content-type": blob.type } })).catch(() => undefined);
    return blob;
  }

  async bitmap(path: string, opts?: ImageBitmapOptions, onProgress?: (loaded: number, total: number) => void) {
    return createImageBitmap(await this.blob(path, onProgress), opts);
  }

  /** into the cache without decoding, for later */
  async warm(path: string) {
    const cache = await this.cache;
    if (!cache || (await cache.match(this.url(path)))) return;
    await this.blob(path).catch(() => undefined);
  }
}
