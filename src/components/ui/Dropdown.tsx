"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import styles from "./dropdown.module.css";

interface BaseDropdownProps<T = string> {
  options: readonly T[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  searchable?: boolean;
  disabled?: boolean;
  className?: string;
  parentRef?: React.RefObject<HTMLDivElement | null>;
  onDropdownStateChange?: (isOpen: boolean) => void;
  onFocusChange?: (focused: boolean) => void;
  getDisplayText?: (option: T) => string;
  getSearchText?: (option: T) => string;
  getValue?: (option: T) => string;
}

interface SimpleDropdownProps
  extends Omit<
    BaseDropdownProps<{ value: string; label: string }>,
    "getDisplayText" | "getSearchText" | "getValue"
  > {
  variant?: "simple";
  options: readonly { value: string; label: string }[];
}

interface GenericDropdownProps<T> extends BaseDropdownProps<T> {
  variant?: "generic";
}

type DropdownProps<T = string> = T extends { value: string; label: string }
  ? SimpleDropdownProps
  : GenericDropdownProps<T>;

export default function Dropdown<T = string>(props: DropdownProps<T>) {
  const {
    options,
    value,
    onChange,
    placeholder,
    searchable = true,
    disabled = false,
    className = "",
    parentRef,
    onDropdownStateChange,
    onFocusChange,
    getDisplayText = (option: T) => {
      // Auto-detect if this is a simple option object
      if (typeof option === "object" && option !== null && "label" in option) {
        return (option as { label: string }).label;
      }
      return String(option);
    },
    getSearchText = (option: T) => {
      // Auto-detect if this is a simple option object
      if (typeof option === "object" && option !== null && "label" in option) {
        return (option as { label: string }).label;
      }
      return String(option);
    },
    getValue = (option: T) => {
      // Auto-detect if this is a simple option object
      if (typeof option === "object" && option !== null && "value" in option) {
        return (option as { value: string }).value;
      }
      return String(option);
    },
  } = props as BaseDropdownProps<T>;

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(value);
  const [dropdownPosition, setDropdownPosition] = useState({
    top: 0,
    left: 0,
    width: 0,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onDropdownStateChange?.(isOpen);
  }, [isOpen, onDropdownStateChange]);

  useEffect(() => {
    setSearchTerm(value);
  }, [value]);

  const filteredOptions = searchable
    ? options.filter((option) =>
      getSearchText(option).toLowerCase().includes(searchTerm.toLowerCase())
    )
    : options;

  const updateDropdownPosition = useCallback(() => {
    const refToUse = parentRef?.current || containerRef.current;
    if (refToUse) {
      const rect = refToUse.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
  }, [parentRef]);

  useEffect(() => {
    if (isOpen) {
      updateDropdownPosition();

      window.addEventListener("resize", updateDropdownPosition);

      return () => {
        window.removeEventListener("resize", updateDropdownPosition);
      };
    }
  }, [isOpen, updateDropdownPosition]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        dropdownListRef.current &&
        !dropdownListRef.current.contains(target)
      ) {
        setIsOpen(false);
        setSearchTerm(value);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [value]);

  const handleSelect = (option: T) => {
    const selectedValue = getValue(option);
    onChange(selectedValue);
    setIsOpen(false);
    setSearchTerm(selectedValue);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    setSearchTerm(inputValue);
    onChange(inputValue);
    setIsOpen(true);
  };

  const handleFocus = () => {
    setSearchTerm(value);
    setIsOpen(true);
    onFocusChange?.(true);
  };

  const handleBlur = () => {
    onFocusChange?.(false);
  };

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  if (!searchable) {
    const selectedOption = options.find((option) => getValue(option) === value);

    return (
      <div
        ref={containerRef}
        className={`${styles.dropdown} ${className} ${disabled ? styles.disabled : ""
          }`}
      >
        <div
          className={`${styles.inputWrapper} ${isOpen ? styles.open : ""}`}
          onClick={handleToggle}
        >
          <span className={styles.value}>
            {selectedOption ? getDisplayText(selectedOption) : placeholder}
          </span>
          <ChevronDown
            size={16}
            className={`${styles.chevron} ${isOpen ? styles.open : ""}`}
          />
        </div>

        {isOpen && !disabled && (
          <div className={styles.optionsListPortal}>
            {options.map((option, index) => (
              <div
                key={index}
                className={`${styles.option} ${getValue(option) === value ? styles.selected : ""
                  }`}
                onClick={() => handleSelect(option)}
              >
                {getDisplayText(option)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const dropdownContent = isOpen && (
    <div
      ref={dropdownListRef}
      className={styles.optionsListPortal}
      style={{
        position: "absolute",
        top: dropdownPosition.top,
        left: dropdownPosition.left,
        width: dropdownPosition.width,
        zIndex: 999999,
      }}
    >
      {filteredOptions.length > 0 ? (
        filteredOptions.map((option, index) => (
          <div
            key={index}
            className={styles.option}
            onClick={() => handleSelect(option)}
          >
            {getDisplayText(option)}
          </div>
        ))
      ) : (
        <div className={styles.noOptions}>Nenhuma opção encontrada</div>
      )}
    </div>
  );

  return (
    <div className={`${styles.dropdown} ${className}`} ref={containerRef}>
      <div className={styles.inputWrapper}>
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          className={styles.input}
          disabled={disabled}
        />
        <ChevronDown
          size={16}
          className={`${styles.chevron} ${isOpen ? styles.open : ""}`}
          onClick={handleToggle}
        />
      </div>

      {typeof window !== "undefined" &&
        createPortal(dropdownContent, document.body)}
    </div>
  );
}

interface CityOption {
  name: string;
  state: string;
  priority: number;
}

export function CityDropdown({
  value,
  onChange,
  placeholder,
  parentRef,
  onDropdownStateChange,
  onFocusChange,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  parentRef?: React.RefObject<HTMLDivElement | null>;
  onDropdownStateChange?: (isOpen: boolean) => void;
  onFocusChange?: (focused: boolean) => void;
}) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { cidadesFamosasBrasil } = require("../../data/cidades-famosas") as {
    cidadesFamosasBrasil: CityOption[];
  };

  const sortedCities = [...cidadesFamosasBrasil].sort(
    (a: CityOption, b: CityOption) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return a.name.localeCompare(b.name);
    }
  );

  return (
    <Dropdown
      options={sortedCities}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      searchable={true}
      parentRef={parentRef}
      onDropdownStateChange={onDropdownStateChange}
      onFocusChange={onFocusChange}
      getDisplayText={(city: CityOption) => `${city.name}, ${city.state}`}
      getSearchText={(city: CityOption) => `${city.name} ${city.state}`}
      getValue={(city: CityOption) => `${city.name}, ${city.state}`}
    />
  );
}
