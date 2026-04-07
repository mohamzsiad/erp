import React from 'react';
import { clsx } from 'clsx';

interface FormFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}

/** Wraps any input/select/textarea with a label, error message and hint */
export const FormField: React.FC<FormFieldProps> = ({
  label,
  error,
  required,
  hint,
  className,
  children,
}) => {
  return (
    <div className={clsx('flex flex-col gap-1', className)}>
      <label className="erp-label">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-red-500 text-xs">{error}</p>}
      {hint && !error && <p className="text-gray-400 text-xs">{hint}</p>}
    </div>
  );
};

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input: React.FC<InputProps> = ({ error, className, ...props }) => (
  <input
    className={clsx('erp-input', error && 'border-red-400 focus:ring-red-300', className)}
    {...props}
  />
);

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const Select: React.FC<SelectProps> = ({ error, className, options, placeholder, ...props }) => (
  <select
    className={clsx('erp-input', error && 'border-red-400 focus:ring-red-300', className)}
    {...props}
  >
    {placeholder && <option value="">{placeholder}</option>}
    {options.map((o) => (
      <option key={o.value} value={o.value}>
        {o.label}
      </option>
    ))}
  </select>
);

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea: React.FC<TextareaProps> = ({ error, className, ...props }) => (
  <textarea
    rows={3}
    className={clsx('erp-input resize-none', error && 'border-red-400 focus:ring-red-300', className)}
    {...props}
  />
);
