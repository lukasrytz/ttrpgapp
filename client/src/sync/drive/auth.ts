import { Preferences } from '@capacitor/preferences';

/**
 * Supplies Google API access tokens to the Drive target. Kept as a small
 * interface so the REST layer (target.ts) can be unit-tested without OAuth.
 */
export interface TokenProvider {
  isAuthed(): Promise<boolean>;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
  /** A valid access token, refreshing if needed. `force` bypasses the cache. */
  getAccessToken(force?: boolean): Promise<string>;
}

interface StoredTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number; // epoch ms
}

const STORE_KEY = 'sync.google.tokens';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const REDIRECT = 'ch.rytz.ttrpgapp:/oauth';

/**
 * Google OAuth (authorization-code + PKCE) for installed apps. The initial
 * consent is handled by @capacitor-community/generic-oauth2; refreshes are done
 * directly against Google's token endpoint (installed-app clients need no
 * secret). Tokens are persisted in Preferences.
 *
 * NOTE: the interactive flow can only be exercised on a real device with a
 * configured Google Cloud OAuth client — see README. The REST layer that
 * consumes this is unit-tested independently.
 */
export class GoogleDriveAuth implements TokenProvider {
  private tokens: StoredTokens | null = null;
  private loaded = false;

  constructor(private clientId: string) {}

  private async load() {
    if (this.loaded) return;
    const { value } = await Preferences.get({ key: STORE_KEY });
    this.tokens = value ? (JSON.parse(value) as StoredTokens) : null;
    this.loaded = true;
  }

  private async persist() {
    if (this.tokens) {
      await Preferences.set({ key: STORE_KEY, value: JSON.stringify(this.tokens) });
    } else {
      await Preferences.remove({ key: STORE_KEY });
    }
  }

  async isAuthed(): Promise<boolean> {
    await this.load();
    return this.tokens !== null;
  }

  async signIn(): Promise<void> {
    // Imported lazily so the web build doesn't require the native plugin.
    const { GenericOAuth2 } = await import('@capacitor-community/generic-oauth2');
    const res = await GenericOAuth2.authenticate({
      authorizationBaseUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      accessTokenEndpoint: TOKEN_ENDPOINT,
      scope: DRIVE_SCOPE,
      pkceEnabled: true,
      additionalParameters: { access_type: 'offline', prompt: 'consent' },
      android: { appId: this.clientId, responseType: 'code', redirectUrl: REDIRECT },
      web: {
        appId: this.clientId,
        responseType: 'code',
        redirectUrl: window.location.origin,
        windowOptions: 'height=700,left=100,top=100',
      },
    });
    const r = res as Record<string, unknown>;
    const accessToken = String(r['access_token'] ?? '');
    const refreshToken = r['refresh_token'] ? String(r['refresh_token']) : null;
    const expiresIn = Number(r['expires_in'] ?? 3600);
    if (!accessToken) throw new Error('Google sign-in returned no access token');
    this.tokens = { accessToken, refreshToken, expiresAt: Date.now() + expiresIn * 1000 };
    await this.persist();
  }

  async signOut(): Promise<void> {
    this.tokens = null;
    await this.persist();
  }

  async getAccessToken(force = false): Promise<string> {
    await this.load();
    if (!this.tokens) throw new Error('Not signed in to Google Drive');
    const fresh = !force && Date.now() < this.tokens.expiresAt - 60_000;
    if (fresh) return this.tokens.accessToken;
    if (!this.tokens.refreshToken) {
      // Can't refresh silently — force a new interactive sign-in.
      throw new Error('Google session expired; please reconnect');
    }
    const body = new URLSearchParams({
      client_id: this.clientId,
      grant_type: 'refresh_token',
      refresh_token: this.tokens.refreshToken,
    });
    const res = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`);
    const data = (await res.json()) as { access_token: string; expires_in?: number };
    this.tokens.accessToken = data.access_token;
    this.tokens.expiresAt = Date.now() + (data.expires_in ?? 3600) * 1000;
    await this.persist();
    return this.tokens.accessToken;
  }
}
