"use client";
import { useRef } from "react";
import { LucideIcon } from "lucide-react";
import styles from "./searchsection.module.css";
import Dropdown from "./Dropdown";

interface SearchSectionProps {
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  icon: LucideIcon;
  searchable?: boolean;
  showRightBorder?: boolean;
  onDropdownStateChange?: (isOpen: boolean) => void;
  parentRef?: React.RefObject<HTMLDivElement | null>;
  isPlainInput?: boolean;
}

export default function SearchSection({
  options,
  value,
  onChange,
  placeholder,
  label,
  searchable = true,
  showRightBorder = false,
  onDropdownStateChange,
  parentRef: externalParentRef,
  isPlainInput = false,
}: SearchSectionProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);

  // No celular a faixa inteira parece o campo: tocar no rótulo ou no espaço em volta foca o input.
  const focarCampo = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget && e.target !== labelRef.current) return;
    sectionRef.current?.querySelector("input")?.focus();
  };

  return (
    <div
      ref={sectionRef}
      onClick={focarCampo}
      className={`${styles.searchSection} ${showRightBorder ? styles.withRightBorder : ""
        }`}
    >
      <div ref={labelRef} className={styles.sectionLabel}>{label}</div>
      <div className={styles.sectionInputRow}>
        {isPlainInput ? (
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            aria-label={label}
            className={`${styles.input} min-h-6`}
          />
        ) : (
          <Dropdown
            options={options}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            searchable={searchable}
            parentRef={externalParentRef || sectionRef}
            onDropdownStateChange={onDropdownStateChange}
          />
        )}
      </div>
    </div>
  );
}
