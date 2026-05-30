interface SearchBoxProps {
  value: string;
  onChange: (nextValue: string) => void;
}

export function SearchBox({ value, onChange }: SearchBoxProps) {
  return (
    <label className="toolbar-search">
      <span>Search</span>
      <input
        type="search"
        value={value}
        placeholder="components/Button"
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
