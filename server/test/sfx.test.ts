import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type Database from 'better-sqlite3';
import { openDb } from '../src/db.js';
import { listSfxClips, scanSfx } from '../src/sfx.js';

describe('scanSfx', () => {
  let tempDir: string;
  let sfxDir: string;
  let db: Database.Database;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ttrpg-sfx-test-'));
    sfxDir = path.join(tempDir, 'sfx');
    fs.mkdirSync(sfxDir, { recursive: true });
    db = openDb(path.join(tempDir, 'data'));
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('scans new clips and removes deleted clips', async () => {
    const clip1 = path.join(sfxDir, 'Thunderclap.wav');
    const clip2 = path.join(sfxDir, 'SwordClash.mp3');
    fs.writeFileSync(clip1, 'fake audio content');
    fs.writeFileSync(clip2, 'fake audio content');

    const config = {
      musicFolders: [],
      sfxFolders: [sfxDir],
      notesVault: './vault',
      dataDir: './data',
      plugins: { dnd5e: true },
    };

    const scan1 = await scanSfx(db, config);
    expect(scan1.added).toBe(2);
    expect(scan1.removed).toBe(0);
    expect(scan1.total).toBe(2);

    const clips = listSfxClips(db);
    expect(clips.map((c) => c.name)).toEqual(['SwordClash', 'Thunderclap']);
    expect(clips[0]?.folder).toBe(sfxDir);

    // Remove one clip and rescan
    fs.unlinkSync(clip1);
    const scan2 = await scanSfx(db, config);
    expect(scan2.added).toBe(0);
    expect(scan2.removed).toBe(1);
    expect(scan2.total).toBe(1);

    const clipsAfter = listSfxClips(db);
    expect(clipsAfter.map((c) => c.name)).toEqual(['SwordClash']);
  });
});
