import React from "react";
import styles from "./CustomCheckbox.module.css";

interface CustomCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  id?: string;
}

export const CustomCheckbox: React.FC<CustomCheckboxProps> = ({
  checked,
  onChange,
  label,
  disabled = false,
  id,
}) => {
  return (
    <label className={styles.container} htmlFor={id}>
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className={styles.input}
      />
      <span
        className={`${styles.checkmark} ${checked ? styles.checked : ""} ${
          disabled ? styles.disabled : ""
        }`}
      >
        {checked && (
          <svg className={styles.checkIcon} viewBox="0 0 16 16" fill="none">
            <path
              d="M13.5 4.5L6 12L2.5 8.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
      <span className={`${styles.label} ${disabled ? styles.disabled : ""}`}>
        {label}
      </span>
    </label>
  );
};
