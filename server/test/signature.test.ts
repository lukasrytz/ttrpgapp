import { describe, expect, it } from 'vitest';
import { trackSignature } from '@ttrpgapp/shared';

describe('trackSignature', () => {
  it('is stable across the different paths each device uses', () => {
    // Desktop stores a folder-relative path; Android a MediaStore absolute path.
    const desktop = trackSignature('Combat/Goblin Ambush.mp3', 212);
    const androidPhone = trackSignature('/storage/emulated/0/Music/DnD/Goblin Ambush.mp3', 212);
    const androidTablet = trackSignature('primary:Music/DnD/Goblin Ambush.mp3', 212);
    expect(desktop).toBe(androidPhone);
    expect(desktop).toBe(androidTablet);
  });

  it('strips directory and extension, lowercases, and trims', () => {
    expect(trackSignature('A/B/Battle Theme.FLAC', 100)).toBe('battle theme|100');
    expect(trackSignature('  Spaced Name .ogg  ', 100)).toBe('spaced name|100');
  });

  it('rounds duration to the whole second (absorbs re-encode drift)', () => {
    expect(trackSignature('x.mp3', 211.4)).toBe(trackSignature('x.wav', 210.8));
    expect(trackSignature('x.mp3', 211.4)).toBe('x|211');
  });

  it('disambiguates same-named tracks by duration', () => {
    expect(trackSignature('Ambience.mp3', 120)).not.toBe(trackSignature('Ambience.mp3', 300));
  });

  it('collapses unknown/zero/negative duration to 0 so both sides agree', () => {
    expect(trackSignature('x.mp3', null)).toBe('x|0');
    expect(trackSignature('x.mp3', 0)).toBe('x|0');
    expect(trackSignature('x.mp3', -5)).toBe('x|0');
  });

  it('handles a bare filename with no directory', () => {
    expect(trackSignature('theme.mp3', 60)).toBe('theme|60');
  });

  it('handles a Windows backslash path', () => {
    expect(trackSignature('Combat\\Battle.mp3', 90)).toBe('battle|90');
  });
});
