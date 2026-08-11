/** A sound-effect clip. Deliberately thinner than Track: no tags, no intensity. */
export interface SfxClip {
  id: number;
  /** Server: path relative to its folder root. Android: the device path. */
  path: string;
  /** Server: the configured folder root. Android: '' (device paths are absolute). */
  folder: string;
  /** Display name — the filename without its extension. */
  name: string;
  durationSec: number | null;
}
