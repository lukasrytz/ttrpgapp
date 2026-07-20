import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MusicFolder, MusicScanResult, TagDimension, Track } from '@ttrpgapp/shared';
import { DEFAULT_TAG_VOCAB, TAG_DIMENSIONS } from '@ttrpgapp/shared';
import { backend, type TrackUpdate } from '../backend';
import { usePlayer, shuffleTracks } from '../player/PlayerProvider';
import { EMPTY_FILTER, matches, type Filter } from '../music/filter';

function fmtDuration(sec: number | null): string {
  if (!sec) return '';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function MusicPage() {
  const qc = useQueryClient();
  const player = usePlayer();
  const [filter, setFilter] = useState<Filter>(EMPTY_FILTER);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [pickingFolders, setPickingFolders] = useState(false);

  const { data } = useQuery({
    queryKey: ['tracks'],
    queryFn: () => backend().listTracks(),
  });
  const tracks = useMemo(() => data ?? [], [data]);

  const folders = useQuery({
    queryKey: ['musicFolders'],
    queryFn: () => backend().listMusicFolders(),
  });
  const enabledFolders = folders.data?.filter((f) => f.enabled).length ?? 0;

  const scan = useMutation({
    mutationFn: (): Promise<MusicScanResult> => backend().scanMusic(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tracks'] });
      qc.invalidateQueries({ queryKey: ['musicFolders'] });
    },
  });

  const vocab = useMemo(() => {
    const v: Record<TagDimension, string[]> = { theme: [], mood: [], landscape: [] };
    for (const dim of TAG_DIMENSIONS) {
      const values = new Set(DEFAULT_TAG_VOCAB[dim]);
      for (const t of tracks) for (const tag of t.tags[dim]) values.add(tag);
      v[dim] = [...values].sort();
    }
    return v;
  }, [tracks]);

  const filtered = useMemo(() => tracks.filter((t) => matches(t, filter)), [tracks, filter]);
  const selected = tracks.find((t) => t.id === selectedId) ?? null;

  const toggleDim = (dim: TagDimension, value: string) => {
    setFilter((f) => {
      const next = new Set(f.dims[dim]);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return { ...f, dims: { ...f.dims, [dim]: next } };
    });
  };

  return (
    <div className="page music-page">
      <div className="music-main">
        <div className="page-header">
          <h1>Music</h1>
          <div className="header-actions">
            <button
              onClick={() => setPickingFolders(true)}
              disabled={!folders.data}
              title="Choose which folders make up your library"
            >
              📁 Folders{folders.data ? ` (${enabledFolders}/${folders.data.length})` : ''}
            </button>
            <button onClick={() => scan.mutate()} disabled={scan.isPending}>
              {scan.isPending ? 'Scanning…' : 'Rescan library'}
            </button>
            <button
              className="primary"
              disabled={filtered.length === 0}
              onClick={() => player.playQueue(shuffleTracks(filtered))}
              title="Shuffle all matching tracks into the queue"
            >
              ▶ Play {filtered.length} filtered
            </button>
          </div>
        </div>
        {scan.data && (
          <p className="muted">
            Scan: {scan.data.added} added, {scan.data.removed} removed, {scan.data.total} total.
          </p>
        )}

        <div className="filter-panel">
          {TAG_DIMENSIONS.map((dim) => (
            <div className="filter-row" key={dim}>
              <span className="filter-label">{dim}</span>
              <div className="chip-row">
                {vocab[dim].map((v) => (
                  <button
                    key={v}
                    className={`chip ${filter.dims[dim].has(v) ? 'chip-on' : ''}`}
                    onClick={() => toggleDim(dim, v)}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="filter-row">
            <span className="filter-label">intensity</span>
            <div className="chip-row">
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  className={`chip ${filter.minIntensity === n ? 'chip-on' : ''}`}
                  onClick={() => setFilter((f) => ({ ...f, minIntensity: n }))}
                >
                  {n === 0 ? 'any' : `≥ ${n}`}
                </button>
              ))}
            </div>
            <input
              placeholder="Search title/artist…"
              value={filter.search}
              onChange={(e) => setFilter((f) => ({ ...f, search: e.target.value }))}
            />
          </div>
        </div>

        {tracks.length === 0 ? (
          <p className="muted">
            No tracks in your library. Pick the folders holding your game music under
            “📁 Folders”, then hit “Rescan library”.
          </p>
        ) : (
          <table className="track-table">
            <tbody>
              {filtered.map((t) => (
                <tr
                  key={t.id}
                  className={[
                    t.id === selectedId ? 'row-selected' : '',
                    t.id === player.current?.id ? 'row-playing' : '',
                  ].join(' ')}
                  onClick={() => setSelectedId(t.id)}
                >
                  <td className="cell-play">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        player.playTrack(t);
                      }}
                      title="Play now (crossfade)"
                    >
                      ▶
                    </button>
                  </td>
                  <td>
                    <div>{t.title}</div>
                    {t.artist && <div className="muted small">{t.artist}</div>}
                  </td>
                  <td className="cell-tags">
                    {TAG_DIMENSIONS.flatMap((dim) => t.tags[dim]).map((tag) => (
                      <span key={tag} className="tag">
                        {tag}
                      </span>
                    ))}
                    {t.intensity != null && <span className="tag tag-int">⚡{t.intensity}</span>}
                  </td>
                  <td className="muted cell-dur">{fmtDuration(t.durationSec)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <TagEditor
          key={selected.id}
          track={selected}
          vocab={vocab}
          onClose={() => setSelectedId(null)}
        />
      )}

      {pickingFolders && folders.data && (
        <FolderPicker folders={folders.data} onClose={() => setPickingFolders(false)} />
      )}
    </div>
  );
}

/**
 * Folder selection: the device's audio library is mostly not game music, so
 * the user ticks the folders that are. Everything else stays out of the app.
 */
function FolderPicker({ folders, onClose }: { folders: MusicFolder[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [enabled, setEnabled] = useState(
    () => new Set(folders.filter((f) => f.enabled).map((f) => f.path)),
  );
  const [search, setSearch] = useState('');

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? folders.filter((f) => f.path.toLowerCase().includes(q)) : folders;
  }, [folders, search]);

  const save = useMutation({
    // All folders selected is the same as "no restriction" — store it as such,
    // so folders added to the device later come along.
    mutationFn: () =>
      backend().setMusicFolders(enabled.size === folders.length ? null : [...enabled]),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['tracks'] }),
        qc.invalidateQueries({ queryKey: ['musicFolders'] }),
      ]);
      onClose();
    },
  });

  const toggle = (path: string) =>
    setEnabled((prev) => {
      const next = new Set(prev);
      if (!next.delete(path)) next.add(path);
      return next;
    });

  const trackCount = folders
    .filter((f) => enabled.has(f.path))
    .reduce((n, f) => n + f.trackCount, 0);

  return (
    <div className="palette-backdrop" onClick={onClose}>
      <div className="folder-picker" onClick={(e) => e.stopPropagation()}>
        <div className="folder-picker-head">
          <strong>Music folders</strong>
          <button onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <p className="muted small folder-picker-hint">
          Only the ticked folders make up your library — {trackCount} track
          {trackCount === 1 ? '' : 's'} from {enabled.size} folder
          {enabled.size === 1 ? '' : 's'}.
        </p>
        <input
          placeholder="Filter folders…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="folder-list">
          {shown.map((f) => (
            <label key={f.path} className="folder-row">
              <input
                type="checkbox"
                checked={enabled.has(f.path)}
                onChange={() => toggle(f.path)}
              />
              <span className="folder-name">
                {f.label}
                <span className="muted small folder-path">{f.path}</span>
              </span>
              <span className="muted small">{f.trackCount}</span>
            </label>
          ))}
          {shown.length === 0 && <p className="muted folder-empty">No folders match.</p>}
        </div>
        <div className="folder-picker-foot">
          <button onClick={() => setEnabled(new Set(folders.map((f) => f.path)))}>All</button>
          <button onClick={() => setEnabled(new Set())}>None</button>
          <button className="primary" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function TagEditor({
  track,
  vocab,
  onClose,
}: {
  track: Track;
  vocab: Record<TagDimension, string[]>;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [newTag, setNewTag] = useState<Record<TagDimension, string>>({
    theme: '',
    mood: '',
    landscape: '',
  });

  const update = useMutation({
    mutationFn: (body: TrackUpdate) => backend().updateTrack(track.id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tracks'] }),
  });

  const toggleTag = (dim: TagDimension, value: string) => {
    const has = track.tags[dim].includes(value);
    const values = has ? track.tags[dim].filter((v) => v !== value) : [...track.tags[dim], value];
    update.mutate({ tags: { [dim]: values } });
  };

  return (
    <aside className="tag-editor">
      <div className="tag-editor-head">
        <strong>{track.title}</strong>
        <button onClick={onClose}>✕</button>
      </div>
      <div className="filter-row">
        <span className="filter-label">intensity</span>
        <div className="chip-row">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              className={`chip ${track.intensity === n ? 'chip-on' : ''}`}
              onClick={() => update.mutate({ intensity: track.intensity === n ? null : n })}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      {TAG_DIMENSIONS.map((dim) => (
        <div className="filter-row" key={dim}>
          <span className="filter-label">{dim}</span>
          <div className="chip-row">
            {vocab[dim].map((v) => (
              <button
                key={v}
                className={`chip ${track.tags[dim].includes(v) ? 'chip-on' : ''}`}
                onClick={() => toggleTag(dim, v)}
              >
                {v}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const v = newTag[dim].trim().toLowerCase();
              if (!v) return;
              update.mutate({ tags: { [dim]: [...track.tags[dim], v] } });
              setNewTag((s) => ({ ...s, [dim]: '' }));
            }}
          >
            <input
              placeholder={`add ${dim}…`}
              value={newTag[dim]}
              onChange={(e) => setNewTag((s) => ({ ...s, [dim]: e.target.value }))}
            />
          </form>
        </div>
      ))}
    </aside>
  );
}
