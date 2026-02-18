/// <reference types="vite/client" />

declare module "*.svg" {
  const src: string;
  export default src;
}

declare const __APP_VERSION__: string;
declare const __INIT_DB__: { version: number; indexedDB: Record<string, unknown[]>; localStorage: Record<string, string | null> };
