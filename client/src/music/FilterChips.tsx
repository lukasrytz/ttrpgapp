import type { TagDimension } from '@ttrpgapp/shared';
import { TAG_DIMENSIONS } from '@ttrpgapp/shared';
import type { Filter } from './filter';

interface FilterChipsProps {
  filter: Filter;
  vocab: Record<TagDimension, string[]>;
  onToggleTag: (dim: TagDimension, value: string) => void;
  onReset?: () => void;
}

export default function FilterChips({ filter, vocab, onToggleTag, onReset }: FilterChipsProps) {
  return (
    <>
      {onReset && (
        <div className="filter-row" style={{ justifyContent: 'space-between', marginBottom: '4px' }}>
          <span className="filter-label">filters</span>
          <button className="chip" onClick={onReset}>
            Reset filters
          </button>
        </div>
      )}
      {TAG_DIMENSIONS.map((dim) => (
        <div className="filter-row" key={dim}>
          <span className="filter-label">{dim}</span>
          <div className="chip-row">
            {(vocab[dim] ?? []).map((v) => (
              <button
                key={v}
                className={`chip ${filter.dims[dim]?.has(v) ? 'chip-on' : ''}`}
                onClick={() => onToggleTag(dim, v)}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
