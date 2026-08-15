import { useEffect, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { DeckButton, LeafDeckAction } from '@ttrpgapp/shared';
import { getCounter } from './counterStore';
import { triggerHaptic } from '../util/haptics';

interface DeckButtonViewProps {
  button: DeckButton;
  editMode: boolean;
  isLit?: boolean;
  isMissing?: boolean;
  onPress: (button: DeckButton) => void;
  onEdit: (button: DeckButton) => void;
}

function getCounterAction(btn: DeckButton): Extract<LeafDeckAction, { kind: 'counter' }> | null {
  if (btn.action.kind === 'counter') return btn.action;
  if (btn.action.kind === 'macro') {
    const found = btn.action.actions.find((a) => a.kind === 'counter');
    if (found && found.kind === 'counter') return found;
  }
  return null;
}

export default function DeckButtonView({
  button,
  editMode,
  isLit = false,
  isMissing = false,
  onPress,
  onEdit,
}: DeckButtonViewProps) {
  const counterAction = getCounterAction(button);
  const [counterVal, setCounterVal] = useState<number>(() =>
    counterAction ? getCounter(counterAction.counterId) : 0,
  );

  useEffect(() => {
    if (!counterAction) return;
    const update = () => setCounterVal(getCounter(counterAction.counterId));
    update();
    window.addEventListener('ttrpg-counters-changed', update);
    return () => window.removeEventListener('ttrpg-counters-changed', update);
  }, [counterAction]);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: button.id,
    disabled: !editMode,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleClick = () => {
    if (editMode) {
      onEdit(button);
    } else if (!isMissing) {
      void triggerHaptic();
      onPress(button);
    }
  };

  const classes = [
    'deck-btn',
    `deck-btn-${button.color}`,
    `deck-btn-${button.size}`,
    isLit ? 'deck-btn-on' : '',
    isMissing ? 'deck-btn-missing' : '',
    editMode ? 'deck-btn-editing' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const renderBadge = () => {
    if (!counterAction) return null;
    const max = counterAction.max;
    if (max && max <= 8) {
      const filled = '▰'.repeat(Math.min(counterVal, max));
      const empty = '▱'.repeat(Math.max(0, max - counterVal));
      return <div className="deck-btn-badge clock-badge">{filled}{empty}</div>;
    }
    return <div className="deck-btn-badge">{max ? `${counterVal}/${max}` : counterVal}</div>;
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={classes}
      onClick={handleClick}
      {...(editMode ? attributes : {})}
      {...(editMode ? listeners : {})}
    >
      {renderBadge()}
      <div className="deck-btn-icon">{button.icon || '🔘'}</div>
      <div className="deck-btn-label">{button.label}</div>
      {isMissing && <div className="deck-btn-warning" title="Audio file missing on this device">⚠</div>}
    </div>
  );
}
