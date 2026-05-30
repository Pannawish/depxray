interface SearchBoxProps {
  value: string;
  onChange: (nextValue: string) => void;
  onClear: () => void;
}

export function SearchBox({ value, onChange, onClear }: SearchBoxProps) {
  return (
    <label className="toolbar-search">
      <span>Search</span>
      <div className="search-input-shell">
        <input
          type="search"
          value={value}
          placeholder="components/Button"
          onChange={(event) => onChange(event.target.value)}
        />
        {value ? (
          <button
            className="search-clear-button"
            onClick={onClear}
            type="button"
          >
            Clear
          </button>
        ) : null}
      </div>
    </label>
  );
}
