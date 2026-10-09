"use client";
import { useRef } from "react";
import { LucideIcon } from "lucide-react";
import styles from "./searchsection.module.css";
import { CityDropdown } from "./Dropdown";

interface CitySearchSectionProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  icon: LucideIcon;
  showRightBorder?: boolean;
  onDropdownStateChange?: (isOpen: boolean) => void;
}

export default function CitySearchSection({
  value,
  onChange,
  placeholder,
  label,
  showRightBorder = false,
  onDropdownStateChange,
}: CitySearchSectionProps) {
  const sectionRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={sectionRef}
      className={`${styles.searchSection} ${
        showRightBorder ? styles.withRightBorder : ""
      }`}
    >
      <div className={styles.sectionLabel}>{label}</div>
      <div className={styles.sectionInputRow}>
        <CityDropdown
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          parentRef={sectionRef}
          onDropdownStateChange={onDropdownStateChange}
        />
      </div>
    </div>
  );
}
