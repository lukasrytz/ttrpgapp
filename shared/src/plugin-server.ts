/**
 * Server side of a game-system plugin (HTTP mode only). Compendium content
 * and views live on the client (see plugin-client.ts); the server just needs
 * the identity to report enabled state. Per-plugin persistent state goes
 * through the core /api/plugin-state KV endpoints.
 */
export interface ServerPlugin {
  id: string;
  name: string;
}
