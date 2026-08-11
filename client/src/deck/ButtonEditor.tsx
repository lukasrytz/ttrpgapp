import { useState } from 'react';
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
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { DeckButton, DeckColor, DeckSize, LeafDeckAction } from '@ttrpgapp/shared';
import { DECK_COLORS, DECK_SIZES } from '@ttrpgapp/shared';
import ActionForm, { defaultLeafAction } from './ActionForm';

interface ButtonEditorProps {
  button: DeckButton;
  onSave: (button: DeckButton) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

function SortableMacroRow({
  id,
  action,
  onChange,
  onRemove,
  disabledKinds,
}: {
  id: string;
  action: LeafDeckAction;
  onChange: (a: LeafDeckAction) => void;
  onRemove: () => void;
  disabledKinds?: Set<LeafDeckAction['kind']>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="macro-sortable-row">
      <div className="drag-handle" {...attributes} {...listeners} title="Drag to reorder">
        ⋮⋮
      </div>
      <div style={{ flex: 1 }}>
        <ActionForm
          value={action}
          onChange={onChange}
          isMacroRow={true}
          onRemove={onRemove}
          disabledKinds={disabledKinds}
        />
      </div>
    </div>
  );
}

export default function ButtonEditor({ button, onSave, onDelete, onClose }: ButtonEditorProps) {
  const [label, setLabel] = useState(button.label);
  const [icon, setIcon] = useState(button.icon);
  const [color, setColor] = useState<DeckColor>(button.color);
  const [size, setSize] = useState<DeckSize>(button.size);

  const [isMacro, setIsMacro] = useState(button.action.kind === 'macro');
  const [singleAction, setSingleAction] = useState<LeafDeckAction>(
    button.action.kind === 'macro'
      ? defaultLeafAction('musicFilter')
      : button.action,
  );
  const [macroActions, setMacroActions] = useState<LeafDeckAction[]>(
    button.action.kind === 'macro'
      ? button.action.actions
      : [button.action],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = Number((active.id as string).replace('macro-', ''));
      const newIndex = Number((over.id as string).replace('macro-', ''));
      setMacroActions((items) => arrayMove(items, oldIndex, newIndex));
    }
  };

  const handleAddMacroRow = () => {
    if (macroActions.length >= 8) return;
    setMacroActions([...macroActions, defaultLeafAction('sfxOneShot', true)]);
  };

  const handleRemoveMacroRow = (index: number) => {
    setMacroActions(macroActions.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    const finalAction = isMacro
      ? { kind: 'macro' as const, actions: macroActions }
      : singleAction;
    onSave({
      ...button,
      label,
      icon: icon || '🔘',
      color,
      size,
      action: finalAction,
    });
  };

  const getDisabledKinds = (index: number) => {
    const disabled = new Set<LeafDeckAction['kind']>();
    const currentKind = macroActions[index]?.kind;
    const hasMusic = macroActions.some(
      (a, i) => i !== index && (a.kind === 'musicFilter' || a.kind === 'musicTrack'),
    );
    const hasNav = macroActions.some(
      (a, i) => i !== index && (a.kind === 'navigate' || a.kind === 'openNote'),
    );

    if (hasMusic && currentKind !== 'musicFilter' && currentKind !== 'musicTrack') {
      disabled.add('musicFilter');
      disabled.add('musicTrack');
    }
    if (hasNav && currentKind !== 'navigate' && currentKind !== 'openNote') {
      disabled.add('navigate');
      disabled.add('openNote');
    }
    return disabled;
  };

  return (
    <div className="palette-backdrop" onClick={onClose}>
      <div className="palette-modal button-editor-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Edit Button</h2>
          <button type="button" className="icon-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label className="small muted">Label</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Button Title"
            />
          </div>

          <div className="form-row" style={{ display: 'flex', gap: '12px' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="small muted">Icon (Emoji)</label>
              <input
                type="text"
                value={icon}
                maxLength={4}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="⚔️"
              />
            </div>

            <div className="form-group" style={{ flex: 1 }}>
              <label className="small muted">Size</label>
              <div className="chip-row">
                {DECK_SIZES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`chip ${size === s ? 'chip-on' : ''}`}
                    onClick={() => setSize(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="small muted">Color</label>
            <div className="color-swatches" style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              {DECK_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`color-swatch swatch-${c} ${color === c ? 'selected' : ''}`}
                  onClick={() => setColor(c)}
                  title={c}
                />
              ))}
            </div>
          </div>

          <hr style={{ borderColor: 'var(--border)', margin: '16px 0' }} />

          <div className="form-group">
            <label className="small muted">Action Type</label>
            <div className="chip-row">
              <button
                type="button"
                className={`chip ${!isMacro ? 'chip-on' : ''}`}
                onClick={() => setIsMacro(false)}
              >
                Single Action
              </button>
              <button
                type="button"
                className={`chip ${isMacro ? 'chip-on' : ''}`}
                onClick={() => setIsMacro(true)}
              >
                Macro (Multiple)
              </button>
            </div>
          </div>

          {!isMacro ? (
            <ActionForm value={singleAction} onChange={setSingleAction} />
          ) : (
            <div className="macro-editor-section">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={macroActions.map((_, i) => `macro-${i}`)}
                  strategy={verticalListSortingStrategy}
                >
                  {macroActions.map((act, i) => (
                    <SortableMacroRow
                      key={`macro-${i}`}
                      id={`macro-${i}`}
                      action={act}
                      onChange={(updated) => {
                        const next = [...macroActions];
                        next[i] = updated;
                        setMacroActions(next);
                      }}
                      onRemove={() => handleRemoveMacroRow(i)}
                      disabledKinds={getDisabledKinds(i)}
                    />
                  ))}
                </SortableContext>
              </DndContext>

              {macroActions.length < 8 && (
                <button
                  type="button"
                  className="chip"
                  style={{ marginTop: '8px' }}
                  onClick={handleAddMacroRow}
                >
                  + Add Action
                </button>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
          <button type="button" className="danger" onClick={() => onDelete(button.id)}>
            Delete Button
          </button>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="primary" onClick={handleSave}>
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
