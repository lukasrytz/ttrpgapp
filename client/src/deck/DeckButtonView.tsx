import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { DeckButton } from '@ttrpgapp/shared';

interface DeckButtonViewProps {
  button: DeckButton;
  editMode: boolean;
  isLit?: boolean;
  isMissing?: boolean;
  onPress: (button: DeckButton) => void;
  onEdit: (button: DeckButton) => void;
}

export default function DeckButtonView({
  button,
  editMode,
  isLit = false,
  isMissing = false,
  onPress,
  onEdit,
}: DeckButtonViewProps) {
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={classes}
      onClick={handleClick}
      {...(editMode ? attributes : {})}
      {...(editMode ? listeners : {})}
    >
      <div className="deck-btn-icon">{button.icon || '🔘'}</div>
      <div className="deck-btn-label">{button.label}</div>
      {isMissing && <div className="deck-btn-warning" title="Audio file missing on this device">⚠</div>}
    </div>
  );
}
