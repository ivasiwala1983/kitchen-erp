import React, { useState, useEffect, useRef, useCallback } from 'react';

export interface SmartSelectOption<T = string> {
  value: T;
  label: string;
  sublabel?: string;
  icon?: string;
  data?: any;
}

export interface SmartSelectProps<T = string> {
  id?: string;
  name?: string;
  label?: string;
  placeholder?: string;
  options?: SmartSelectOption<T>[];
  value?: T | null;
  onChange: (value: T | null, option?: SmartSelectOption<T> | null) => void;

  // Threshold & Search Configuration
  simpleListThreshold?: number; // default: 5
  minSearchCharacters?: number; // default: 2
  debounceMs?: number; // default: 300

  // Server-side / Dynamic Search
  onSearch?: (term: string) => Promise<SmartSelectOption<T>[]> | SmartSelectOption<T>[];
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  onRetry?: () => void;

  // Recent items & Inline Quick Add
  recentOptions?: SmartSelectOption<T>[];
  onQuickAdd?: () => void;
  quickAddLabel?: string;

  // States & Layout
  disabled?: boolean;
  required?: boolean;
  clearable?: boolean;
  className?: string;
  variant?: 'auto' | 'admin' | 'pwa';
  title?: string;
}

export function SmartSelect<T = string>({
  id,
  name,
  label,
  placeholder = 'Select an option...',
  options = [],
  value,
  onChange,
  simpleListThreshold = 5,
  minSearchCharacters = 2,
  debounceMs = 300,
  onSearch,
  isLoading: externalLoading = false,
  isError: externalError = false,
  errorMessage = "Couldn't load options right now.",
  onRetry,
  recentOptions = [],
  onQuickAdd,
  quickAddLabel,
  disabled = false,
  required = false,
  clearable = true,
  className = '',
  variant = 'auto',
  title = 'Select Option',
}: SmartSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [showBrowseAll, setShowBrowseAll] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [internalOptions, setInternalOptions] = useState<SmartSelectOption<T>[]>(options);
  const [internalLoading, setInternalLoading] = useState(false);
  const [internalError, setInternalError] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentRequestRef = useRef<number>(0);

  // Sync internal options with props if no active search
  useEffect(() => {
    if (!searchTerm) {
      setInternalOptions(options);
    }
  }, [options, searchTerm]);

  // Determine selection mode: simple dropdown vs searchable
  const totalOptionsCount = options.length;
  const isSimple = !onSearch && totalOptionsCount <= simpleListThreshold;

  // Detect mobile / PWA variant
  const isPWA =
    variant === 'pwa' ||
    (variant === 'auto' &&
      typeof window !== 'undefined' &&
      (window.innerWidth <= 768 || navigator.maxTouchPoints > 0));

  // Filter client-side options when no server onSearch is provided
  const displayOptions = useCallback(() => {
    if (onSearch) return internalOptions;
    if (!searchTerm || searchTerm.length < minSearchCharacters) return options;
    const term = searchTerm.toLowerCase().trim();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(term) ||
        (opt.sublabel && opt.sublabel.toLowerCase().includes(term))
    );
  }, [onSearch, internalOptions, searchTerm, minSearchCharacters, options]);

  const activeOptions = displayOptions();
  const selectedOption =
    options.find((o) => o.value === value) ||
    internalOptions.find((o) => o.value === value) ||
    (value !== null && value !== undefined ? { value, label: String(value) } : null);

  // Execute debounced search when user types
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    setSearchTerm(term);
    setHighlightedIndex(0);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!onSearch) return;

    if (term.trim().length < minSearchCharacters) {
      setInternalOptions(options);
      setInternalLoading(false);
      setInternalError(false);
      return;
    }

    const requestId = ++currentRequestRef.current;
    setInternalLoading(true);
    setInternalError(false);

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await onSearch(term.trim());
        if (requestId === currentRequestRef.current) {
          setInternalOptions(res || []);
          setInternalLoading(false);
        }
      } catch {
        if (requestId === currentRequestRef.current) {
          setInternalError(true);
          setInternalLoading(false);
        }
      }
    }, debounceMs);
  };

  // Close popover when clicking outside (Desktop)
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen && !isPWA) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, isPWA]);

  // Focus search input when popover or drawer opens
  useEffect(() => {
    if (isOpen || showBrowseAll) {
      setTimeout(() => searchInputRef.current?.focus(), 80);
    }
  }, [isOpen, showBrowseAll]);

  // Keyboard navigation for Admin / Desktop
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled || isSimple) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) setIsOpen(true);
      else setHighlightedIndex((prev) => (prev + 1) % Math.max(1, activeOptions.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) setIsOpen(true);
      else
        setHighlightedIndex((prev) =>
          prev <= 0 ? Math.max(0, activeOptions.length - 1) : prev - 1
        );
    } else if (e.key === 'Enter') {
      if (isOpen && activeOptions[highlightedIndex]) {
        e.preventDefault();
        const opt = activeOptions[highlightedIndex];
        onChange(opt.value, opt);
        setIsOpen(false);
      }
    } else if (e.key === 'Escape') {
      if (isOpen) {
        e.preventDefault();
        setIsOpen(false);
      }
    }
  };

  // Render Simple HTML Dropdown (options <= 5 and no server search)
  if (isSimple) {
    return (
      <div className={`smart-select-wrapper ${className}`}>
        {label && (
          <label htmlFor={id} className="smart-select-label">
            {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
          </label>
        )}
        <select
          id={id}
          name={name}
          className="smart-select-simple"
          value={value !== null && value !== undefined ? String(value) : ''}
          onChange={(e) => {
            const val = e.target.value;
            if (!val) {
              onChange(null, null);
            } else {
              const matched = options.find((o) => String(o.value) === val);
              onChange(matched ? matched.value : (val as unknown as T), matched || null);
            }
          }}
          disabled={disabled}
          required={required}
        >
          <option value="">{placeholder}</option>
          {options.map((opt) => (
            <option key={String(opt.value)} value={String(opt.value)}>
              {opt.icon ? `${opt.icon} ` : ''}
              {opt.label}
              {opt.sublabel ? ` (${opt.sublabel})` : ''}
            </option>
          ))}
        </select>
      </div>
    );
  }

  // Handle selection action
  const handleSelectOption = (opt: SmartSelectOption<T>) => {
    onChange(opt.value, opt);
    setIsOpen(false);
    setShowBrowseAll(false);
    setSearchTerm('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null, null);
    setSearchTerm('');
  };

  const isLoadingState = externalLoading || internalLoading;
  const isErrorState = externalError || internalError;

  return (
    <div
      ref={containerRef}
      className={`smart-select-container ${className}`}
      onKeyDown={handleKeyDown}
      style={{ position: 'relative', width: '100%' }}
    >
      {label && (
        <label htmlFor={id} className="smart-select-label">
          {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
        </label>
      )}

      {/* Main Trigger Input/Button */}
      <div
        id={id}
        tabIndex={disabled ? -1 : 0}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className={`smart-select-trigger ${disabled ? 'disabled' : ''} ${isOpen ? 'active' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.5rem 0.75rem',
          background: disabled ? '#f1f5f9' : '#ffffff',
          border: '1.5px solid #cbd5e1',
          borderRadius: '10px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          minHeight: '42px',
          fontSize: '0.875rem',
          color: selectedOption ? '#0f172a' : '#64748b',
          userSelect: 'none',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
          {selectedOption ? (
            <>
              {selectedOption.icon && <span>{selectedOption.icon}</span>}
              <span style={{ fontWeight: 600, color: '#0f172a' }}>{selectedOption.label}</span>
              {selectedOption.sublabel && (
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  ({selectedOption.sublabel})
                </span>
              )}
            </>
          ) : (
            <span>{placeholder}</span>
          )}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          {clearable && selectedOption && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              title="Clear selection"
              style={{
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                fontSize: '1rem',
                cursor: 'pointer',
                padding: '0 0.25rem',
              }}
            >
              ✕
            </button>
          )}
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>▼</span>
        </div>
      </div>

      {/* Admin Desktop Overlay Dropdown */}
      {isOpen && !isPWA && (
        <div
          role="listbox"
          className="smart-select-popover"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 999,
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden',
          }}
        >
          {/* Search Box */}
          <div style={{ padding: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>
            <input
              ref={searchInputRef}
              type="text"
              className="smart-select-input"
              placeholder={`🔍 Search ${label || 'options'}...`}
              value={searchTerm}
              onChange={handleSearchChange}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                fontSize: '0.8125rem',
                border: '1.5px solid #cbd5e1',
                borderRadius: '8px',
                outline: 'none',
              }}
            />
            {searchTerm.length === 1 && minSearchCharacters >= 2 && (
              <div
                style={{
                  fontSize: '0.71875rem',
                  color: '#64748b',
                  marginTop: '0.25rem',
                  paddingLeft: '0.25rem',
                }}
              >
                Type at least {minSearchCharacters} characters to search
              </div>
            )}
          </div>

          {/* Quick Add Link if available */}
          {onQuickAdd && (
            <div
              style={{
                padding: '0.375rem 0.5rem',
                background: '#f8fafc',
                borderBottom: '1px solid #f1f5f9',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onQuickAdd();
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#059669',
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  width: '100%',
                  textAlign: 'left',
                }}
              >
                {quickAddLabel || '+ Add New Option'}
              </button>
            </div>
          )}

          {/* List Options */}
          <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
            {isLoadingState ? (
              <div
                style={{
                  padding: '1rem',
                  textAlign: 'center',
                  fontSize: '0.8125rem',
                  color: '#64748b',
                }}
              >
                Searching...
              </div>
            ) : isErrorState ? (
              <div
                style={{
                  padding: '1rem',
                  textAlign: 'center',
                  fontSize: '0.8125rem',
                  color: '#ef4444',
                }}
              >
                <div>{errorMessage}</div>
                {onRetry && (
                  <button
                    type="button"
                    onClick={onRetry}
                    style={{
                      marginTop: '0.5rem',
                      fontSize: '0.75rem',
                      color: '#0284c7',
                      background: 'none',
                      border: 'none',
                      textDecoration: 'underline',
                      cursor: 'pointer',
                    }}
                  >
                    Try Again
                  </button>
                )}
              </div>
            ) : activeOptions.length === 0 ? (
              <div
                style={{
                  padding: '1rem',
                  textAlign: 'center',
                  fontSize: '0.8125rem',
                  color: '#64748b',
                }}
              >
                {searchTerm ? `No options found for '${searchTerm}'` : 'No options available'}
              </div>
            ) : (
              activeOptions.map((opt, index) => {
                const isSelected = selectedOption?.value === opt.value;
                const isHighlighted = index === highlightedIndex;
                return (
                  <div
                    key={String(opt.value)}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelectOption(opt)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    style={{
                      padding: '0.5rem 0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      background: isSelected
                        ? '#ecfdf5'
                        : isHighlighted
                          ? '#f8fafc'
                          : 'transparent',
                      color: isSelected ? '#047857' : '#0f172a',
                      fontSize: '0.875rem',
                      fontWeight: isSelected ? 700 : 500,
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {opt.icon && <span>{opt.icon}</span>}
                      <span>{opt.label}</span>
                      {opt.sublabel && (
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          ({opt.sublabel})
                        </span>
                      )}
                    </span>
                    {isSelected && <span>✓</span>}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* PWA Mobile Bottom Sheet Modal */}
      {(isOpen || showBrowseAll) && isPWA && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsOpen(false);
              setShowBrowseAll(false);
            }
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderTopLeftRadius: '20px',
              borderTopRightRadius: '20px',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              padding: '1.25rem',
              animation: 'slideUp 0.2s ease-out',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1rem',
              }}
            >
              <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                {title || label || 'Select Option'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setShowBrowseAll(false);
                }}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1rem',
                  color: '#64748b',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            {/* Mobile Search Input */}
            <div style={{ marginBottom: '1rem' }}>
              <input
                ref={searchInputRef}
                type="text"
                className="pwa-input"
                placeholder={`🔍 Search ${label || 'options'}...`}
                value={searchTerm}
                onChange={handleSearchChange}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  fontSize: '0.9375rem',
                  borderRadius: '12px',
                  border: '1.5px solid #cbd5e1',
                  outline: 'none',
                }}
              />
              {searchTerm.length === 1 && minSearchCharacters >= 2 && (
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.375rem' }}>
                  Type at least {minSearchCharacters} characters to search
                </div>
              )}
            </div>

            {/* Quick Add Button on Mobile */}
            {onQuickAdd && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setShowBrowseAll(false);
                  onQuickAdd();
                }}
                style={{
                  padding: '0.625rem',
                  marginBottom: '0.875rem',
                  background: '#ecfdf5',
                  border: '1px dashed #059669',
                  borderRadius: '10px',
                  color: '#047857',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                {quickAddLabel || '+ Add New Option'}
              </button>
            )}

            {/* Scrollable Content Area */}
            <div style={{ overflowY: 'auto', flex: 1, paddingRight: '0.25rem' }}>
              {/* Recently Used Items */}
              {!searchTerm && recentOptions.length > 0 && !showBrowseAll && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      color: '#64748b',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '0.5rem',
                    }}
                  >
                    Recently Used
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {recentOptions.map((opt) => (
                      <button
                        key={`recent-${String(opt.value)}`}
                        type="button"
                        onClick={() => handleSelectOption(opt)}
                        style={{
                          padding: '0.4rem 0.75rem',
                          background: '#f8fafc',
                          border: '1px solid #cbd5e1',
                          borderRadius: '20px',
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                          color: '#0f172a',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.375rem',
                        }}
                      >
                        {opt.icon && <span>{opt.icon}</span>}
                        <span>{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Options List */}
              {isLoadingState ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                  Searching...
                </div>
              ) : isErrorState ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: '#ef4444' }}>
                  <div>{errorMessage}</div>
                  {onRetry && (
                    <button
                      type="button"
                      onClick={onRetry}
                      style={{
                        marginTop: '0.5rem',
                        padding: '0.375rem 0.75rem',
                        background: '#0284c7',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                      }}
                    >
                      Try Again
                    </button>
                  )}
                </div>
              ) : activeOptions.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                  {searchTerm ? `No results for '${searchTerm}'` : 'No items found'}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  {activeOptions.map((opt) => {
                    const isSelected = selectedOption?.value === opt.value;
                    return (
                      <div
                        key={String(opt.value)}
                        onClick={() => handleSelectOption(opt)}
                        style={{
                          padding: '0.875rem 1rem',
                          background: isSelected ? '#ecfdf5' : '#f8fafc',
                          border: isSelected ? '1.5px solid #059669' : '1px solid #e2e8f0',
                          borderRadius: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                          {opt.icon && <span style={{ fontSize: '1.125rem' }}>{opt.icon}</span>}
                          <div>
                            <div
                              style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0f172a' }}
                            >
                              {opt.label}
                            </div>
                            {opt.sublabel && (
                              <div
                                style={{
                                  fontSize: '0.75rem',
                                  color: '#64748b',
                                  marginTop: '0.125rem',
                                }}
                              >
                                {opt.sublabel}
                              </div>
                            )}
                          </div>
                        </div>
                        {isSelected && <span style={{ color: '#059669', fontWeight: 800 }}>✓</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Browse All Mobile Action */}
            {!showBrowseAll && !searchTerm && (
              <div
                style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9' }}
              >
                <button
                  type="button"
                  onClick={() => setShowBrowseAll(true)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: '#f8fafc',
                    border: '1.5px solid #cbd5e1',
                    borderRadius: '12px',
                    fontSize: '0.875rem',
                    fontWeight: 700,
                    color: '#0f172a',
                    cursor: 'pointer',
                  }}
                >
                  📋 Browse All {label || 'Items'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
