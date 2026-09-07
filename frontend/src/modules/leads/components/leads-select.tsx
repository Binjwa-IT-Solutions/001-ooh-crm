'use client';

import { useEffect, useId, useRef, useState } from 'react';
import styles from '../leads-select.module.css';

type Option = { value: string; label: string };

interface LeadsSelectProps {
  label: string;
  options: readonly Option[];
  placeholder?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  error?: string;
  onValueChange?: (value: string) => void;
}

export function LeadsSelect({
  label,
  options,
  placeholder,
  name,
  value,
  defaultValue = '',
  error,
  onValueChange,
}: LeadsSelectProps) {
  const selectId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(defaultValue);
  const selectedValue = value ?? internalValue;
  const selectedIndex = options.findIndex((option) => option.value === selectedValue);
  const [activeIndex, setActiveIndex] = useState(Math.max(selectedIndex, 0));

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

  const choose = (nextValue: string) => {
    if (value === undefined) setInternalValue(nextValue);
    onValueChange?.(nextValue);
    setIsOpen(false);
  };

  const open = (direction: 1 | -1 = 1) => {
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : direction === 1 ? 0 : options.length - 1);
    setIsOpen(true);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!isOpen) return open(event.key === 'ArrowDown' ? 1 : -1);
      setActiveIndex((current) => (current + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (isOpen) choose(options[activeIndex]?.value ?? '');
      else open();
    } else if (event.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const selectedOption = options.find((option) => option.value === selectedValue);

  return (
    <div ref={containerRef} className={styles.container}>
      <label htmlFor={selectId} className={styles.label}>{label}</label>
      {name && <input type="hidden" name={name} value={selectedValue} />}
      <button
        id={selectId}
        type="button"
        className={`${styles.trigger} ${error ? styles.triggerError : ''}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={`${selectId}-listbox`}
        onClick={() => (isOpen ? setIsOpen(false) : open())}
        onKeyDown={handleKeyDown}
      >
        <span className={selectedOption ? '' : styles.placeholder}>{selectedOption?.label ?? placeholder}</span>
        <span className={styles.chevron} aria-hidden="true">▾</span>
      </button>
      {isOpen && (
        <div id={`${selectId}-listbox`} role="listbox" aria-labelledby={selectId} className={styles.menu}>
          {options.map((option, index) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === selectedValue}
              className={`${styles.option} ${index === activeIndex ? styles.optionActive : ''} ${option.value === selectedValue ? styles.optionSelected : ''}`}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
