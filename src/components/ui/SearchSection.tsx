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
  showCategoryFilters?: boolean;
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
  showCategoryFilters = false,
  parentRef: externalParentRef,
  isPlainInput = false,
}: SearchSectionProps) {
  const sectionRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={sectionRef}
      className={`${styles.searchSection} ${showRightBorder ? styles.withRightBorder : ""
        }`}
    >
      <div className={styles.sectionLabel}>{label}</div>
      <div className={styles.sectionInputRow}>
        {isPlainInput ? (
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={styles.input}
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
