"use client";

import { locationOptions } from "@/lib/locations";

// Place dropdown: known locations grouped by system. Keeps a value that is not in the list.
export function LocationSelect({
  value,
  onChange,
  ariaLabel,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
  className?: string;
}) {
  const { extra, groups } = locationOptions(value);
  const missing = !value;
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
      title={value || "Choose the place"}
      className={`rounded bg-ink border px-1.5 py-1 text-xs focus:outline-none focus:border-gold ${
        missing ? "border-red-400/70 text-red-300" : "border-elevated text-accent/80"
      } ${className}`}
    >
      {missing && <option value="">Choose place…</option>}
      {extra && <option value={extra}>{extra} (as read)</option>}
      {groups.map((g) => (
        <optgroup key={g.system} label={g.system}>
          {g.options.map((o) => (
            <option key={o.name} value={o.name}>
              {o.name}
              {o.externalPort ? " (ext)" : ""}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
