export interface StorageAdapter {
  put(params: { key: string; contentType: string; body: Buffer }): Promise<{ url: string }>;
  get(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}
