'use client';

import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from 'react';
import { useId } from 'react';

/**
 * The start of the shared design system. Every module builds its screens from
 * these instead of hand-rolling Tailwind classes — that is what keeps the app
 * looking like one product once six people are working on it in parallel.
 *
 * Need a component that is not here (table, modal, date picker, file upload)?
 * Add it here, not inside your module.
 */

export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

// ---------------------------------------------------------------- Button

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-white hover:bg-primary-600 disabled:bg-slate-400 dark:bg-primary-100 dark:text-primary dark:hover:bg-white dark:disabled:bg-slate-700',
  secondary:
    'border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800',
  ghost:
    'text-slate-700 hover:bg-slate-100 disabled:text-slate-400 dark:text-slate-300 dark:hover:bg-slate-800',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  isLoading?: boolean;
  fullWidth?: boolean;
}

export function Button({
  variant = 'primary',
  isLoading = false,
  fullWidth = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || isLoading}
      className={cx(
        'inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:focus-visible:outline-primary-100',
        'disabled:cursor-not-allowed',
        BUTTON_VARIANTS[variant],
        fullWidth && 'w-full',
        className,
      )}
    >
      {isLoading && (
        <span
          aria-hidden
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
}

// ----------------------------------------------------------------- Field

export interface FieldWrapperProps {
  label: string;
  error?: string;
  hint?: ReactNode;
  id?: string;
  className?: string;
  children?: ReactNode;
  required?: boolean;
}

export function FieldWrapper({ label, error, hint, className, id, children }: FieldWrapperProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={inputId}
        className="block text-sm font-medium text-slate-700 dark:text-slate-300"
      >
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${inputId}-error`} className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-xs text-slate-500 dark:text-slate-400">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

// React 19 passes `ref` through as an ordinary prop, so ComponentProps is enough here.
export interface FieldProps extends ComponentProps<'input'> {
  label: string;
  error?: string;
  hint?: ReactNode;
}

export function Field({ label, error, hint, className, id, ...props }: FieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={inputId}
        className="block text-sm font-medium text-slate-700 dark:text-slate-300"
      >
        {label}
      </label>
      <input
        {...props}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cx(
          'h-11 w-full rounded-lg border bg-white px-3 text-sm text-slate-900 outline-none transition-colors',
          'placeholder:text-slate-400 focus:border-primary',
          'dark:bg-slate-900 dark:text-slate-100 dark:focus:border-slate-300',
          error ? 'border-red-400 focus:border-red-500' : 'border-slate-300 dark:border-slate-700',
          'disabled:bg-slate-100 disabled:text-slate-500 dark:disabled:bg-slate-800',
          className,
        )}
      />
      {error ? (
        <p id={`${inputId}-error`} className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-xs text-slate-500 dark:text-slate-400">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

// ----------------------------------------------------------------- Alert

type AlertTone = 'error' | 'info' | 'success' | 'warning';

const ALERT_TONES: Record<AlertTone, string> = {
  error:
    'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200',
  info: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300',
  success:
    'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  warning:
    'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200',
};

export function Alert({
  tone = 'info',
  title,
  children,
}: {
  tone?: AlertTone;
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cx('rounded-lg border px-3.5 py-3 text-sm', ALERT_TONES[tone])}
    >
      {title && <p className="font-medium">{title}</p>}
      {children && <div className={cx(title && 'mt-1')}>{children}</div>}
    </div>
  );
}

// ------------------------------------------------------------------ Card

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        'rounded-lg border border-[#E6E8EC] bg-white p-4 sm:p-5 shadow-sm',
        className,
      )}
    >
      {children}
    </div>
  );
}

// --------------------------------------------------------------- Spinner

export function Spinner({ label, className }: { label?: string; className?: string }) {
  return (
    <div className="inline-flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
      <span
        aria-hidden
        className={`h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-primary dark:border-slate-700 dark:border-t-primary-100 ${className ?? ''}`}
      />
      {label !== undefined ? (label ? <span>{label}</span> : null) : (className ? null : <span>Loading…</span>)}
    </div>
  );
}

// ----------------------------------------------------------------- Badge

export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
      {children}
    </span>
  );
}

// ---------------------------------------------------------------- Select

export interface SelectFieldProps extends ComponentProps<'select'> {
  label: string;
  error?: string;
  hint?: ReactNode;
  options: ReadonlyArray<{ value: string; label: string }>;
  placeholder?: string;
}

export function SelectField({
  label,
  error,
  hint,
  options,
  placeholder,
  className,
  id,
  ...props
}: SelectFieldProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const describedBy = error ? `${selectId}-error` : hint ? `${selectId}-hint` : undefined;

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={selectId}
        className="block text-sm font-medium text-slate-700 dark:text-slate-300"
      >
        {label}
      </label>
      <select
        {...props}
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cx(
          'h-11 w-full rounded-lg border bg-white px-3 text-sm text-slate-900 outline-none transition-colors',
          'focus:border-primary dark:bg-slate-900 dark:text-slate-100 dark:focus:border-slate-300',
          error ? 'border-red-400' : 'border-slate-300 dark:border-slate-700',
          className,
        )}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? (
        <p id={`${selectId}-error`} className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : hint ? (
        <p id={`${selectId}-hint`} className="text-xs text-slate-500 dark:text-slate-400">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

// -------------------------------------------------------------- Textarea

export interface TextAreaFieldProps extends ComponentProps<'textarea'> {
  label: string;
  error?: string;
}

export function TextAreaField({ label, error, className, id, ...props }: TextAreaFieldProps) {
  const generatedId = useId();
  const areaId = id ?? generatedId;

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={areaId}
        className="block text-sm font-medium text-slate-700 dark:text-slate-300"
      >
        {label}
      </label>
      <textarea
        {...props}
        id={areaId}
        aria-invalid={error ? true : undefined}
        className={cx(
          'w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors',
          'focus:border-primary dark:bg-slate-900 dark:text-slate-100 dark:focus:border-slate-300',
          error ? 'border-red-400' : 'border-slate-300 dark:border-slate-700',
          className,
        )}
      />
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

// ----------------------------------------------------------- StatusPill

const STATUS_TONES: Record<string, string> = {
  Active:
    'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-400/20',
  'On Notice':
    'bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-400/20',
  Inactive:
    'bg-slate-100 text-slate-600 ring-slate-500/20 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-400/20',
  Resigned:
    'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-950 dark:text-red-300 dark:ring-red-400/20',
};

/** Colour-coded status badge. Add your module's statuses to STATUS_TONES. */
export function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        STATUS_TONES[status] ?? STATUS_TONES.Inactive,
      )}
    >
      {status}
    </span>
  );
}

// ------------------------------------------------------------ EmptyState

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 px-6 py-12 text-center dark:border-slate-700">
      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{title}</p>
      {description && (
        <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// --------------------------------------------------------------- Modal

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        {title && (
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg leading-none"
            >
              ✕
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

