export interface StorageAdapter {
  put(params: { key: string; contentType: string; body: Buffer }): Promise<{ url: string }>;
  get(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
  /** Reverses a URL previously returned by put() back into a key, or null if it isn't ours. */
  keyFromUrl(url: string): string | null;
}
