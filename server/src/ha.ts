import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import type { TriggerHaCuePayload } from '@ttrpgapp/shared';

interface HaConfig {
  url?: string;
  token?: string;
}

export function registerHaRoutes(app: FastifyInstance, db: Database.Database): void {
  const getSetting = db.prepare('SELECT value FROM plugin_state WHERE plugin_id = ? AND key = ?');

  function getHaSettings(): HaConfig {
    const row = getSetting.get('settings', 'ha') as { value: string } | undefined;
    if (!row?.value) return {};
    try {
      return JSON.parse(row.value) as HaConfig;
    } catch {
      return {};
    }
  }

  app.post<{ Body: TriggerHaCuePayload }>('/api/ha/cue', async (req, reply) => {
    const { scene_id, fx_script, transition_s } = req.body;
    if (!scene_id) {
      return reply.code(400).send({ error: 'scene_id is required' });
    }

    const { url, token } = getHaSettings();
    if (!url || !token) {
      return reply.code(400).send({ error: 'Home Assistant URL or Token not configured' });
    }

    const endpoint = `${url.replace(/\/+$/, '')}/api/services/script/ttrpg_cue`;
    const payload = {
      scene_id,
      fx_script: fx_script || 'none',
      transition_s: transition_s ?? 2.5,
    };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(2000),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return reply.code(502).send({ error: `HA returned ${res.status}: ${text}` });
      }

      return { ok: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.code(504).send({ error: `Home Assistant unreachable: ${msg}` });
    }
  });

  app.post<{ Body?: { url?: string; token?: string } }>('/api/ha/test', async (req, reply) => {
    const saved = getHaSettings();
    const url = req.body?.url || saved.url;
    const token = req.body?.token || saved.token;

    if (!url || !token) {
      return reply.code(400).send({ error: 'Home Assistant URL and Token are required' });
    }

    const endpoint = `${url.replace(/\/+$/, '')}/api/states`;
    try {
      const res = await fetch(endpoint, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(2500),
      });

      if (!res.ok) {
        return reply.code(502).send({ error: `HA returned status ${res.status}` });
      }

      return { ok: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.code(504).send({ error: `Connection failed: ${msg}` });
    }
  });
}
