export interface AppConfig {
  musicFolders: string[];
  notesVault: string;
  dataDir: string;
  /** plugin id -> enabled */
  plugins: Record<string, boolean>;
}

/** Subset of the config the client is allowed to see. */
export interface ClientConfig {
  plugins: { id: string; name: string; enabled: boolean }[];
}
