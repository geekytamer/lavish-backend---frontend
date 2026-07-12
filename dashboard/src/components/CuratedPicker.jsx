import { ChevronUp, ChevronDown, X } from 'lucide-react';

/**
 * Ordered multi-select: pick items from `options` into an ordered `value` list.
 * options: [{ id, ... }]; value: array of ids (ordered); onChange(nextIds).
 */
export function CuratedPicker({ options, value, onChange, getLabel = (o) => o.name, emptyHint }) {
  const selected = value || [];
  const selectedSet = new Set(selected);
  const available = options.filter((o) => !selectedSet.has(o.id));
  const byId = (id) => options.find((o) => o.id === id);

  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= selected.length) return;
    const next = [...selected];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const remove = (id) => onChange(selected.filter((x) => x !== id));
  const add = (id) => {
    if (id && !selectedSet.has(id)) onChange([...selected, id]);
  };

  return (
    <div className="stack gap-sm">
      {selected.length === 0 ? (
        <p className="muted xs">{emptyHint || 'Nothing selected yet.'}</p>
      ) : (
        <div className="stack gap-sm">
          {selected.map((id, i) => {
            const item = byId(id);
            return (
              <div key={id} className="curated-row">
                <span className="curated-index">{i + 1}</span>
                <span className="curated-name">{item ? getLabel(item) : id}</span>
                <div className="inline gap-sm">
                  <button className="icon-btn" onClick={() => move(i, -1)} disabled={i === 0} title="Move up">
                    <ChevronUp size={14} />
                  </button>
                  <button
                    className="icon-btn"
                    onClick={() => move(i, 1)}
                    disabled={i === selected.length - 1}
                    title="Move down"
                  >
                    <ChevronDown size={14} />
                  </button>
                  <button className="icon-btn danger" onClick={() => remove(id)} title="Remove">
                    <X size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <select
        className="input"
        value=""
        onChange={(e) => {
          add(e.target.value);
          e.target.value = '';
        }}
      >
        <option value="" disabled>
          {available.length ? 'Add…' : 'All added'}
        </option>
        {available.map((o) => (
          <option key={o.id} value={o.id}>
            {getLabel(o)}
          </option>
        ))}
      </select>
    </div>
  );
}
