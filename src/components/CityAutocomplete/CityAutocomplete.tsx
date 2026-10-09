'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { City, State } from 'country-state-city';

interface CityAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
}

interface CityOption {
  name: string;
  stateCode: string;
  stateName: string;
}

export default function CityAutocomplete({
  value,
  onChange,
  placeholder = "Digite sua cidade...",
  className = "",
  id
}: CityAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filteredCities, setFilteredCities] = useState<CityOption[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const brazilianStates = useMemo(() => State.getStatesOfCountry('BR') || [], []);
  const stateMap = useMemo(() => new Map(brazilianStates.map(state => [state.isoCode, state.name])), [brazilianStates]);
  
  const brazilianCities = useMemo(() => (City.getCitiesOfCountry('BR') || []).map(city => ({
    name: city.name,
    stateCode: city.stateCode,
    stateName: stateMap.get(city.stateCode) || ''
  })), [stateMap]);

  useEffect(() => {
    if (value.length >= 2) {
      const filtered = brazilianCities
        .filter(city => city.name.toLowerCase().includes(value.toLowerCase()))
        .slice(0, 10);
      setFilteredCities(filtered);
      setIsOpen(filtered.length > 0);
    } else {
      setFilteredCities([]);
      setIsOpen(false);
    }
    setSelectedIndex(-1);
  }, [value, brazilianCities]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const handleCitySelect = (city: CityOption) => {
    onChange(`${city.name}, ${city.stateCode}`);
    setIsOpen(false);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || filteredCities.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < filteredCities.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          handleCitySelect(filteredCities[selectedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const handleClickOutside = (e: MouseEvent) => {
    if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
      setIsOpen(false);
      setSelectedIndex(-1);
    }
  };

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <input
        ref={inputRef}
        type="text"
        id={id}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      
      {isOpen && filteredCities.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            backgroundColor: 'white',
            border: '1px solid #ddd',
            borderRadius: '4px',
            maxHeight: '200px',
            overflowY: 'auto',
            zIndex: 1000,
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}
        >
          {filteredCities.map((city, index) => (
            <div
              key={`${city.name}-${city.stateCode}`}
              onClick={() => handleCitySelect(city)}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                backgroundColor: index === selectedIndex ? '#f0f0f0' : 'white',
                borderBottom: index < filteredCities.length - 1 ? '1px solid #eee' : 'none'
              }}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div style={{ fontWeight: 500 }}>{city.name}</div>
              <div style={{ fontSize: '12px', color: '#666' }}>
                {city.stateName} ({city.stateCode})
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}