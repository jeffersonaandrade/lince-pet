"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import styles from "./custom-select.module.css";

export type SelectOption = {
  value: string;
  label: string;
};

interface CustomSelectProps {
  options: Array<SelectOption | string>;
  value?: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
}

export default function CustomSelect({
  options,
  value,
  onChange,
  placeholder = "Selecione",
  disabled = false,
  ariaLabel,
}: CustomSelectProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);

  const normalized = useMemo<SelectOption[]>(
    () =>
      options.map((opt) =>
        typeof opt === "string" ? { value: opt, label: opt } : opt
      ),
    [options]
  );

  const selected = useMemo(
    () => normalized.find((o) => o.value === value) || null,
    [normalized, value]
  );

  // Fecha quando clica fora
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Navegação por teclado
  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (
      !open &&
      (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")
    ) {
      e.preventDefault();
      setOpen(true);
      setActiveIndex(
        Math.max(
          0,
          normalized.findIndex((o) => o.value === value)
        )
      );
      return;
    }
    if (!open) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % normalized.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + normalized.length) % normalized.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = normalized[activeIndex];
      if (opt) {
        onChange(opt.value);
        setOpen(false);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div
      ref={rootRef}
      className={`${styles.container} ${open ? styles.open : ""}`}
    >
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((s) => !s)}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel || placeholder}
        disabled={disabled}
      >
        <span className={`${styles.triggerLabel} ${!selected ? styles.placeholder : ""}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={16} className={styles.chevron} />
      </button>

      {open && (
        <div className={styles.dropdown} role="listbox">
          {normalized.map((opt, idx) => {
            const isSelected = value === opt.value;
            const isActive = activeIndex === idx;
            return (
              <div
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                className={`${styles.option} ${
                  isSelected ? styles.selected : ""
                } ${isActive ? styles.active : ""}`}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                onMouseEnter={() => setActiveIndex(idx)}
              >
                <span>{opt.label}</span>
                {isSelected && <Check size={16} className={styles.check} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
