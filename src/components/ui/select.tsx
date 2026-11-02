"use client";

import { useId, useMemo, type ReactNode } from "react";
import ReactSelect, { type ClassNamesConfig, type GroupBase } from "react-select";
import AsyncSelect from "react-select/async";
import { cn } from "@/lib/utils";

/*
 * The app's one dropdown, built on react-select. `Select` covers plain
 * value/label lists; `EntitySelect` covers {id, name} records, either from a
 * static list or an async search.
 */

export type SelectOption = { value: string; label: string };

type Look = {
  invalid?: boolean;
  /** Soft "still needed" highlight used by the employee form. */
  nudged?: boolean;
  size?: "sm" | "md";
};

function classNames<O>({ invalid, nudged, size = "md" }: Look): ClassNamesConfig<O, false, GroupBase<O>> {
  return {
    control: ({ isFocused, isDisabled }) =>
      cn(
        "rounded-xl border bg-surface text-[15px] text-ink transition sm:text-sm",
        size === "sm" ? "!min-h-8 rounded-lg px-1 text-[13px] sm:text-[13px]" : "!min-h-11 px-1.5",
        isFocused ? "border-ink ring-4 ring-accent/40" : invalid ? "border-bad" : "border-line hover:border-line-strong",
        nudged && !isFocused && "border-warn/60 bg-warn-soft/40",
        isDisabled && "opacity-50",
      ),
    valueContainer: () => "gap-1 px-2",
    placeholder: () => "text-ink-3",
    singleValue: () => "text-ink",
    input: () => "text-ink",
    indicatorsContainer: () => "gap-0.5 pr-1",
    dropdownIndicator: ({ isFocused }) => cn("rounded-md p-1 text-ink-3", isFocused && "text-ink"),
    clearIndicator: () => "rounded-md p-1 text-ink-3 hover:bg-surface-3 hover:text-ink",
    indicatorSeparator: () => "hidden",
    loadingIndicator: () => "px-1 text-ink-3",
    menu: () => "mt-1.5 animate-fade rounded-xl border border-line bg-surface p-1 shadow-pop",
    menuList: () => "max-h-64",
    menuPortal: () => "!z-[80]",
    option: ({ isFocused, isSelected }) =>
      cn("cursor-pointer rounded-lg px-3 py-2 text-[13px]", isSelected ? "bg-ink font-medium text-canvas" : isFocused ? "bg-surface-3 text-ink" : "text-ink-2"),
    noOptionsMessage: () => "px-3 py-2.5 text-[13px] text-ink-3",
    loadingMessage: () => "px-3 py-2.5 text-[13px] text-ink-3",
  };
}

/** Menus render in <body> so cards, drawers and overflow containers can't clip them. */
const portal = () => (typeof document === "undefined" ? null : document.body);

type Common = Look & {
  inputId?: string;
  placeholder?: string;
  disabled?: boolean;
  clearable?: boolean;
  searchable?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  noOptionsText?: string;
};

/** Single select over string values; "" means nothing selected. */
export function Select({
  value,
  onChange,
  options,
  placeholder = "Select…",
  disabled,
  clearable,
  searchable,
  className,
  inputId,
  noOptionsText = "No options",
  ...look
}: Common & { value: string; onChange: (v: string) => void; options: SelectOption[] }) {
  const instanceId = useId();
  const selected = options.find((o) => o.value === value) ?? null;
  return (
    <ReactSelect<SelectOption, false>
      instanceId={instanceId}
      inputId={inputId}
      unstyled
      classNames={classNames<SelectOption>(look)}
      className={className}
      value={selected}
      options={options}
      onChange={(o) => onChange(o?.value ?? "")}
      placeholder={placeholder}
      isDisabled={disabled}
      isClearable={clearable}
      // Short lists don't need a search box; long ones do.
      isSearchable={searchable ?? options.length > 8}
      menuPortalTarget={portal()}
      menuPlacement="auto"
      noOptionsMessage={() => noOptionsText}
      aria-label={look["aria-label"]}
      aria-describedby={look["aria-describedby"]}
      aria-invalid={look.invalid || undefined}
    />
  );
}

type Entity = { id: number; name: string };

/**
 * Select over {id, name} records. Pass `options` for a static list, or
 * `load` for an async search (debounced; `cacheKey` resets results when the
 * source changes, e.g. cities of another state).
 */
export function EntitySelect<T extends Entity>({
  value,
  onChange,
  options,
  load,
  cacheKey,
  loading,
  renderOption,
  renderValue,
  placeholder = "Search…",
  disabled,
  clearable = true,
  className,
  inputId,
  noOptionsText = "No matches",
  ...look
}: Common & {
  /** Only id and name are read for display, so a lighter ref than T is fine. */
  value: Entity | null;
  onChange: (v: T | null) => void;
  options?: T[];
  load?: (term: string) => Promise<T[]>;
  cacheKey?: string;
  loading?: boolean;
  renderOption?: (item: T) => ReactNode;
  /** Shown before the selected value's name (e.g. an avatar). */
  renderValue?: ReactNode;
}) {
  const instanceId = useId();
  const debounced = useMemo(() => {
    if (!load) return undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    return (term: string) =>
      new Promise<T[]>((resolve, reject) => {
        clearTimeout(timer);
        timer = setTimeout(() => load(term).then(resolve, reject), 250);
      });
  }, [load]);

  const shared = {
    instanceId,
    inputId,
    unstyled: true,
    classNames: classNames<T>(look),
    className,
    // The form keeps a light {id, name} ref; react-select only reads it through the getters below.
    value: value as T | null,
    onChange: (o: T | null) => onChange(o),
    getOptionValue: (o: T) => String(o.id),
    getOptionLabel: (o: T) => o.name,
    formatOptionLabel: (o: T, { context }: { context: "menu" | "value" }) =>
      context === "menu" ? (renderOption ? renderOption(o) : o.name) : (
        <span className="flex min-w-0 items-center gap-2">
          {renderValue}
          <span className="truncate">{o.name}</span>
        </span>
      ),
    placeholder,
    isDisabled: disabled,
    isClearable: clearable,
    isLoading: loading,
    menuPortalTarget: portal(),
    menuPlacement: "auto" as const,
    noOptionsMessage: () => noOptionsText,
    loadingMessage: () => "Searching…",
    "aria-describedby": look["aria-describedby"],
    "aria-invalid": look.invalid || undefined,
  };

  return debounced ? (
    <AsyncSelect<T, false> key={cacheKey} {...shared} loadOptions={debounced} cacheOptions defaultOptions />
  ) : (
    <ReactSelect<T, false> {...shared} options={options ?? []} />
  );
}
