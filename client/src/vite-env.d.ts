/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Google OAuth client id for Drive sync (Android). Set at build time. */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
