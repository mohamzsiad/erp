import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';

export interface LookupOption {
  value: string;
  label: string;
  subLabel?: string;
  meta?: Record<string, unknown>;
}

interface LookupFieldProps {
  value?: LookupOption | null;
  onChange: (option: LookupOption | null) => void;
  onSearch: (query: string) => Promise<LookupOption[]>;
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  className?: string;
  minChars?: number;
}

export const LookupField: React.FC<LookupFieldProps> = ({
  value,
  onChange,
  onSearch,
  placeholder = 'Search…',
  disabled,
  error,
  className,
  minChars = 1,
}) => {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<LookupOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateDropdownPosition = () => {
    const el = wrapperRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setDropdownStyle({
      position: 'fixed',
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      zIndex: 9999,
    });
  };

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (q.length < minChars) {
      setOptions([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      updateDropdownPosition();
      try {
        const results = await onSearch(q);
        setOptions(results);
        setOpen(true);
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 250);
  };

  const handleSelect = (opt: LookupOption) => {
    onChange(opt);
    setQuery('');
    setOpen(false);
  };

  const handleClear = () => {
    onChange(null);
    setQuery('');
    setOpen(false);
    inputRef.current?.focus();
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div ref={wrapperRef} className={clsx('relative', className)}>
      {value ? (
        <div className={clsx(
          'erp-input flex items-center justify-between gap-2',
          disabled && 'opacity-60 cursor-not-allowed bg-gray-50'
        )}>
          <div className="flex-1 min-w-0">
            <span className="text-sm text-gray-800 truncate block">{value.label}</span>
            {value.subLabel && (
              <span className="text-xs text-gray-400 truncate block">{value.subLabel}</span>
            )}
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="shrink-0 p-0.5 rounded hover:bg-gray-200 transition-colors"
            >
              <X size={13} className="text-gray-400" />
            </button>
          )}
        </div>
      ) : (
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleQueryChange}
            onFocus={() => { if (query.length >= minChars && options.length > 0) { updateDropdownPosition(); setOpen(true); } }}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder={placeholder}
            disabled={disabled}
            className={clsx(
              'erp-input pl-8',
              error && 'border-red-400 focus:ring-red-300',
              disabled && 'opacity-60 cursor-not-allowed'
            )}
          />
          {loading && (
            <Loader2 size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />
          )}
        </div>
      )}

      {/* Dropdown rendered in a portal to escape overflow:auto clipping */}
      {open && options.length > 0 && createPortal(
        <div style={dropdownStyle} className="bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onMouseDown={() => handleSelect(opt)}
              className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors"
            >
              <p className="text-sm text-gray-800">{opt.label}</p>
              {opt.subLabel && <p className="text-xs text-gray-400">{opt.subLabel}</p>}
            </button>
          ))}
        </div>,
        document.body
      )}

      {open && !loading && options.length === 0 && query.length >= minChars && createPortal(
        <div style={dropdownStyle} className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2">
          <p className="text-sm text-gray-400">No results found</p>
        </div>,
        document.body
      )}
    </div>
  );
};
