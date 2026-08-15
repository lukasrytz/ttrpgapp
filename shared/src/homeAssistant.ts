import cuesData from './ttrpg_cues.json';

export interface HaCue {
  id: string;
  entity_id: string;
  system: string;
  mood: string;
  intensity: string;
  category: string;
  label: string;
  description: string;
  tags: string[];
  transition_s?: number;
  readable?: boolean;
  fx?: string | null;
  preview: string[];
}

export interface HaCueManifest {
  schema_version: number;
  generated_at: string;
  channels: string[];
  systems: Array<{ id: string; label: string; description: string }>;
  categories: string[];
  total_cues: number;
  cues: HaCue[];
}

export interface HaSettings {
  url: string;
  token: string;
}

export interface TriggerHaCuePayload {
  scene_id: string;
  fx_script?: string | null;
  transition_s?: number;
}

export const CUES_MANIFEST: HaCueManifest = cuesData as unknown as HaCueManifest;
export const ALL_CUES: HaCue[] = CUES_MANIFEST.cues;

export function findCueByEntityId(entityId: string): HaCue | undefined {
  return ALL_CUES.find((c) => c.entity_id === entityId || c.id === entityId);
}
