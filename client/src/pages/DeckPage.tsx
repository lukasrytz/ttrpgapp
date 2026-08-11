import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import type { DeckButton, DeckLayout, DeckPage as DeckPageType } from '@ttrpgapp/shared';
import { trackSignature } from '@ttrpgapp/shared';
import { backend } from '../backend';
import { usePlayer } from '../player/PlayerProvider';
import { useSfx } from '../player/SfxProvider';
import { loadDeck, saveDeck } from '../deck/store';
import { starterDeck } from '../deck/starter';
import { runDeckAction, type DeckActionDeps } from '../deck/actions';
import DeckButtonView from '../deck/DeckButtonView';
import ButtonEditor from '../deck/ButtonEditor';

export default function DeckPage() {
  const navigate = useNavigate();
  const player = usePlayer();
  const sfx = useSfx();

  const [layout, setLayout] = useState<DeckLayout>(starterDeck());
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [editingButton, setEditingButton] = useState<DeckButton | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadDeck().then((loaded) => {
      if (!cancelled) {
        setLayout(loaded);
      }
    });

    const onSyncUpdated = () => {
      void loadDeck().then((loaded) => {
        if (!cancelled) {
          setLayout(loaded);
        }
      });
    };

    window.addEventListener('ttrpg-sync-updated', onSyncUpdated);
    window.addEventListener('ttrpg-local-changed', onSyncUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener('ttrpg-sync-updated', onSyncUpdated);
      window.removeEventListener('ttrpg-local-changed', onSyncUpdated);
    };
  }, []);

  const tracksQuery = useQuery({
    queryKey: ['tracks'],
    queryFn: () => backend().listTracks(),
  });
  const tracks = useMemo(() => tracksQuery.data ?? [], [tracksQuery.data]);

  const sfxQuery = useQuery({
    queryKey: ['sfxClips'],
    queryFn: () => backend().listSfx(),
  });
  const clips = useMemo(() => sfxQuery.data ?? [], [sfxQuery.data]);

  const knownTrackSigs = useMemo(
    () => new Set(tracks.map((t) => trackSignature(t.path, t.durationSec))),
    [tracks],
  );
  const knownClipSigs = useMemo(
    () => new Set(clips.map((c) => trackSignature(c.path, c.durationSec))),
    [clips],
  );

  const activePage: DeckPageType = layout.pages[activePageIndex] ??
    layout.pages[0] ?? { id: 'default', name: 'Main', buttons: [] };

  const updateLayout = (nextLayout: DeckLayout) => {
    setLayout(nextLayout);
    saveDeck(nextLayout);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = activePage.buttons.findIndex((b) => b.id === active.id);
      const newIndex = activePage.buttons.findIndex((b) => b.id === over.id);
      if (oldIndex >= 0 && newIndex >= 0) {
        const nextButtons = arrayMove(activePage.buttons, oldIndex, newIndex);
        const nextPages = [...layout.pages];
        nextPages[activePageIndex] = { ...activePage, buttons: nextButtons };
        updateLayout({ ...layout, pages: nextPages });
      }
    }
  };

  const deps: DeckActionDeps = useMemo(
    () => ({
      tracks,
      clips,
      player,
      sfx,
      navigate,
    }),
    [tracks, clips, player, sfx, navigate],
  );

  const handlePressButton = (btn: DeckButton) => {
    runDeckAction(btn.action, deps);
  };

  const handleAddButton = () => {
    const newBtn: DeckButton = {
      id: `btn-${Date.now()}`,
      label: 'New Button',
      icon: '⚡',
      color: 'slate',
      size: '1x1',
      action: { kind: 'navigate', to: '/' },
    };
    const nextPages = [...layout.pages];
    const current = nextPages[activePageIndex] ?? { id: 'p1', name: 'Page 1', buttons: [] };
    nextPages[activePageIndex] = { ...current, buttons: [...current.buttons, newBtn] };
    updateLayout({ ...layout, pages: nextPages });
    setEditingButton(newBtn);
  };

  const handleSaveButton = (updated: DeckButton) => {
    const nextPages = [...layout.pages];
    const current = nextPages[activePageIndex];
    if (current) {
      const idx = current.buttons.findIndex((b) => b.id === updated.id);
      const nextBtns = [...current.buttons];
      if (idx >= 0) {
        nextBtns[idx] = updated;
      } else {
        nextBtns.push(updated);
      }
      nextPages[activePageIndex] = { ...current, buttons: nextBtns };
      updateLayout({ ...layout, pages: nextPages });
    }
    setEditingButton(null);
  };

  const handleDeleteButton = (id: string) => {
    const nextPages = [...layout.pages];
    const current = nextPages[activePageIndex];
    if (current) {
      nextPages[activePageIndex] = {
        ...current,
        buttons: current.buttons.filter((b) => b.id !== id),
      };
      updateLayout({ ...layout, pages: nextPages });
    }
    setEditingButton(null);
  };

  const handleAddPage = () => {
    const newPage: DeckPageType = {
      id: `page-${Date.now()}`,
      name: `Page ${layout.pages.length + 1}`,
      buttons: [],
    };
    const nextLayout = { ...layout, pages: [...layout.pages, newPage] };
    updateLayout(nextLayout);
    setActivePageIndex(nextLayout.pages.length - 1);
  };

  const handleRenamePage = () => {
    const name = window.prompt('Rename Page:', activePage.name);
    if (name && name.trim()) {
      const nextPages = [...layout.pages];
      nextPages[activePageIndex] = { ...activePage, name: name.trim() };
      updateLayout({ ...layout, pages: nextPages });
    }
  };

  const handleDeletePage = () => {
    if (layout.pages.length <= 1) {
      window.alert('Cannot delete the only page.');
      return;
    }
    if (window.confirm(`Delete page "${activePage.name}"?`)) {
      const nextPages = layout.pages.filter((_, i) => i !== activePageIndex);
      updateLayout({ ...layout, pages: nextPages });
      setActivePageIndex(Math.max(0, activePageIndex - 1));
    }
  };

  const checkIsLit = (btn: DeckButton): boolean => {
    if (btn.action.kind === 'sfxLoop') {
      return sfx.activeLoops.includes(btn.action.sig);
    }
    if (btn.action.kind === 'macro') {
      return btn.action.actions.some(
        (a) => a.kind === 'sfxLoop' && sfx.activeLoops.includes(a.sig),
      );
    }
    return false;
  };

  const checkIsMissing = (btn: DeckButton): boolean => {
    const checkLeaf = (a: DeckButton['action']): boolean => {
      if (a.kind === 'musicTrack') return !knownTrackSigs.has(a.sig);
      if (a.kind === 'sfxOneShot' || a.kind === 'sfxLoop') return !knownClipSigs.has(a.sig);
      return false;
    };
    if (btn.action.kind === 'macro') {
      return btn.action.actions.some(checkLeaf);
    }
    return checkLeaf(btn.action);
  };

  return (
    <div className="page deck-page">
      <div className="page-header">
        <h1>Stream Deck</h1>
        <div className="header-actions">
          <button
            className={`chip ${editMode ? 'chip-on' : ''}`}
            onClick={() => setEditMode(!editMode)}
          >
            {editMode ? '✓ Done' : '✎ Edit'}
          </button>
        </div>
      </div>

      <div className="deck-tabs">
        {layout.pages.map((p, i) => (
          <button
            key={p.id}
            className={`deck-tab ${i === activePageIndex ? 'active' : ''}`}
            onClick={() => setActivePageIndex(i)}
          >
            {p.name}
          </button>
        ))}

        {editMode && (
          <>
            <button className="chip" onClick={handleAddPage} title="Add new page">
              + Page
            </button>
            <button className="chip" onClick={handleRenamePage} title="Rename active page">
              ✏️ Rename
            </button>
            <button className="chip danger" onClick={handleDeletePage} title="Delete active page">
              🗑️ Delete
            </button>
          </>
        )}
      </div>

      <div className="deck-grid-container" style={{ marginTop: '16px' }}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={activePage.buttons.map((b) => b.id)}
            strategy={rectSortingStrategy}
          >
            <div className="deck-grid">
              {activePage.buttons.map((btn) => (
                <DeckButtonView
                  key={btn.id}
                  button={btn}
                  editMode={editMode}
                  isLit={checkIsLit(btn)}
                  isMissing={checkIsMissing(btn)}
                  onPress={handlePressButton}
                  onEdit={setEditingButton}
                />
              ))}

              {editMode && (
                <button
                  type="button"
                  className="deck-btn deck-btn-add"
                  onClick={handleAddButton}
                >
                  <div className="deck-btn-icon">+</div>
                  <div className="deck-btn-label">Add Button</div>
                </button>
              )}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {editingButton && (
        <ButtonEditor
          button={editingButton}
          onSave={handleSaveButton}
          onDelete={handleDeleteButton}
          onClose={() => setEditingButton(null)}
        />
      )}
    </div>
  );
}
