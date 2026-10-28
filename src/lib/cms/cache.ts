/** Bounded, coalesced stale-while-revalidate cache. No draft or authenticated visitor data. */
export class StaleCache {
  private entries = new Map<string, { value: unknown; at: number; stale: boolean }>();
  private pending = new Map<string, Promise<unknown>>();
  private generation = 0;
  constructor(
    private ttl = 30_000,
    private maxStale = 300_000,
    private maxEntries = 256,
  ) {}
  invalidate() {
    this.generation++;
    for (const entry of this.entries.values()) entry.stale = true;
  }
  clear() {
    this.generation++;
    this.entries.clear();
  }
  async get<T>(key: string, load: () => Promise<T>, now = Date.now()): Promise<T> {
    const entry = this.entries.get(key);
    const refresh = () => {
      const existing = this.pending.get(key);
      if (existing) return existing as Promise<T>;
      const generation = this.generation;
      const promise = load()
        .then((value) => {
          if (generation === this.generation) {
            if (this.entries.size >= this.maxEntries)
              this.entries.delete(this.entries.keys().next().value!);
            this.entries.set(key, { value, at: Date.now(), stale: false });
          }
          return value;
        })
        .finally(() => this.pending.delete(key));
      this.pending.set(key, promise);
      return promise;
    };
    if (entry && now - entry.at <= this.maxStale) {
      if (entry.stale || now - entry.at >= this.ttl) void refresh().catch(() => {});
      return entry.value as T;
    }
    return refresh();
  }
}
