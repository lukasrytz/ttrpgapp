import { describe, expect, it } from 'vitest';
import { heuristicTags, mergeTags, parseLlmTags, type AutotagInput } from '@ttrpgapp/shared';

const base: AutotagInput = {
  folder: '',
  filename: '',
  title: '',
  artist: null,
  album: null,
  genre: null,
  comment: null,
};

describe('heuristicTags', () => {
  it('reads the folder name as a strong signal', () => {
    const t = heuristicTags({ ...base, folder: 'Taverns', filename: 'Merry Fiddle.mp3' });
    expect(t.theme).toContain('social'); // "tavern" → social
    expect(t.mood).toContain('joyful'); // "merry"
  });

  it('tags a battle track with theme + mood + high intensity', () => {
    const t = heuristicTags({ ...base, folder: 'Combat', title: 'Epic Boss Battle' });
    expect(t.theme).toContain('battle');
    expect(t.mood).toContain('epic');
    expect(t.intensity).toBe(5); // "boss"/"epic"
  });

  it('picks landscape from the title', () => {
    const t = heuristicTags({ ...base, title: 'Misty Forest', genre: 'Ambient' });
    expect(t.landscape).toContain('wilderness'); // "forest" → wilderness
    expect(t.mood).toContain('peaceful'); // "ambient"
    expect(t.intensity).toBe(1); // "ambient"
  });

  it('requires a left word boundary (no "disease" → wilderness via "sea")', () => {
    const t = heuristicTags({ ...base, title: 'A curious disease' });
    expect(t.landscape).not.toContain('wilderness');
  });

  it('returns empty/null for signal-free input', () => {
    const t = heuristicTags({ ...base, filename: 'track01.mp3' });
    expect(t).toEqual({ theme: [], mood: [], landscape: [], intensity: null });
  });
});

describe('parseLlmTags', () => {
  it('keeps only in-vocab values and clamps intensity', () => {
    const raw = 'Sure!\n{"theme":["social","spaceship"],"mood":["joyful"],"landscape":[],"intensity":9}';
    const t = parseLlmTags(raw);
    expect(t.theme).toEqual(['social']); // "spaceship" dropped (not in vocab)
    expect(t.mood).toEqual(['joyful']);
    expect(t.intensity).toBe(5); // clamped from 9
  });

  it('lowercases/dedupes and tolerates missing fields', () => {
    const t = parseLlmTags('{"theme":["Social","SOCIAL"]}');
    expect(t.theme).toEqual(['social']);
    expect(t.intensity).toBeNull();
  });

  it('returns empties when there is no JSON', () => {
    expect(parseLlmTags('the model refused')).toEqual({
      theme: [],
      mood: [],
      landscape: [],
      intensity: null,
    });
  });
});

describe('mergeTags', () => {
  it('unions tags and prefers the LLM intensity', () => {
    const h = heuristicTags({ ...base, folder: 'Combat', title: 'Forest Ambush' });
    const llm = parseLlmTags('{"mood":["tense"],"intensity":3}');
    const m = mergeTags(h, llm);
    expect(m.theme).toContain('battle');
    expect(m.landscape).toContain('wilderness'); // "forest" → wilderness
    expect(m.mood).toContain('tense');
    expect(m.intensity).toBe(3); // LLM wins over heuristic
  });

  it('falls back to heuristic intensity when the LLM gives none', () => {
    const h = heuristicTags({ ...base, title: 'Boss Fight' });
    const m = mergeTags(h, parseLlmTags('{"mood":["epic"]}'));
    expect(m.intensity).toBe(5);
  });
});
