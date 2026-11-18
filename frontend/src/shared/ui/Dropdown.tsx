'use client';

import React, {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

export interface DropdownOption {
  value: string;
  label: string;
}

export interface DropdownProps {
  label?: string;
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  options: ReadonlyArray<DropdownOption | string>;
  onChange?: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  hint?: ReactNode;
  className?: string;
  triggerClassName?: string;
  menuClassName?: string;
  name?: string;
  id?: string;
  showArrow?: boolean;
}

/**
 * Standardized dropdown matching the Campaigns Status dropdown design:
 * - Trigger: rounded-lg border-gray-300 bg-white px-4 py-2.5 text-gray-900 hover:border-[#8B2424] focus:ring-2 focus:ring-[#F9DADA]
 * - Arrow: centered text-gray-500 ▾ with px-4 right spacing
 * - Menu: rounded-lg border-gray-200 bg-white shadow-lg
 * - Option: px-4 py-2.5 text-sm hover:bg-[#F9DADA] hover:text-[#8B2424]
 * - Selected Option: bg-[#FFF5F5] font-semibold text-[#8B2424]
 */
export function Dropdown({
  label,
  value,
  defaultValue = '',
  placeholder,
  options,
  onChange,
  disabled = false,
  required = false,
  error,
  hint,
  className = '',
  triggerClassName = '',
  menuClassName = '',
  name,
  id,
  showArrow = true,
}: DropdownProps) {
  const generatedId = useId();
  const dropdownId = id ?? generatedId;
  const containerRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [internalValue, setInternalValue] = useState<string>(defaultValue);

  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : internalValue;

  // Normalize options
  const normalizedOptions: DropdownOption[] = options.map((opt) =>
    typeof opt === 'string' ? { value: opt, label: opt } : opt,
  );

  const selectedOption = normalizedOptions.find((opt) => opt.value === currentValue);
  const selectedIndex = normalizedOptions.findIndex((opt) => opt.value === currentValue);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(
    selectedIndex >= 0 ? selectedIndex : 0,
  );

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  const toggleOpen = () => {
    if (disabled) return;
    if (!open) {
      const idx = normalizedOptions.findIndex((opt) => opt.value === currentValue);
      setHighlightedIndex(idx >= 0 ? idx : 0);
      setOpen(true);
    } else {
      setOpen(false);
    }
  };

  const handleSelect = (val: string) => {
    if (!isControlled) {
      setInternalValue(val);
    }
    onChange?.(val);
    setOpen(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) {
        toggleOpen();
      } else {
        setHighlightedIndex((prev) => (prev + 1) % normalizedOptions.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) {
        toggleOpen();
      } else {
        setHighlightedIndex(
          (prev) => (prev - 1 + normalizedOptions.length) % normalizedOptions.length,
        );
      }
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (open) {
        if (normalizedOptions[highlightedIndex]) {
          handleSelect(normalizedOptions[highlightedIndex].value);
        }
      } else {
        toggleOpen();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  };

  const displayLabel = selectedOption
    ? selectedOption.label
    : placeholder !== undefined
      ? placeholder
      : normalizedOptions[0]?.label ?? '';

  const isPlaceholderShown = !selectedOption && placeholder !== undefined;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label
          htmlFor={dropdownId}
          className="mb-1.5 block text-sm font-medium text-gray-900"
        >
          {label}
          {required && <span className="ml-1 text-[#8B2424]">*</span>}
        </label>
      )}

      {name && <input type="hidden" name={name} value={currentValue} />}

      <button
        id={dropdownId}
        type="button"
        disabled={disabled}
        onClick={toggleOpen}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex w-full cursor-pointer items-center ${showArrow ? 'justify-between' : 'justify-start'} rounded-lg border bg-white px-4 py-2.5 text-left text-sm text-gray-900 outline-none transition ${
          error
            ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100'
            : open
              ? 'border-[#8B2424] ring-2 ring-[#F9DADA]'
              : 'border-gray-300 hover:border-[#8B2424] focus:border-[#8B2424] focus:ring-2 focus:ring-[#F9DADA]'
        } ${disabled ? 'cursor-not-allowed opacity-60 bg-gray-50' : ''} ${triggerClassName}`}
      >
        <span className={`truncate ${showArrow ? 'mr-2' : ''} ${isPlaceholderShown ? 'text-gray-400' : 'text-gray-900'}`}>
          {displayLabel}
        </span>

        {showArrow && <span className="text-gray-500 shrink-0 select-none">▾</span>}
      </button>

      {open && (
        <div
          role="listbox"
          className={`absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg ${menuClassName}`}
        >
          {placeholder !== undefined && (
            <button
              type="button"
              role="option"
              aria-selected={currentValue === ''}
              onClick={() => handleSelect('')}
              className={`block w-full cursor-pointer px-4 py-2.5 text-left text-sm transition hover:bg-[#F9DADA] hover:text-[#8B2424] ${
                currentValue === ''
                  ? 'bg-[#FFF5F5] font-semibold text-[#8B2424]'
                  : 'text-gray-900'
              }`}
            >
              {placeholder}
            </button>
          )}

          {normalizedOptions.map((option, index) => {
            const isSelected = option.value === currentValue;
            const isHighlighted = index === highlightedIndex;

            return (
              <button
                key={`${option.value}-${index}`}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(option.value)}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={`block w-full cursor-pointer px-4 py-2.5 text-left text-sm transition hover:bg-[#F9DADA] hover:text-[#8B2424] ${
                  isSelected
                    ? 'bg-[#FFF5F5] font-semibold text-[#8B2424]'
                    : isHighlighted
                      ? 'bg-[#FFF9F9] text-gray-900'
                      : 'text-gray-900'
                }`}
              >
                {option.label}
              </button>
            );
          })}

          {normalizedOptions.length === 0 && (
            <p className="px-4 py-2.5 text-sm text-gray-500">No options available</p>
          )}
        </div>
      )}

      {error ? (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-gray-500">{hint}</p>
      ) : null}
    </div>
  );
}

export default Dropdown;
