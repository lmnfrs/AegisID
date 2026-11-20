import { forwardRef, useId } from 'react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

// ===== Spinner =====
interface SpinnerProps {
  size?: 'sm' | 'lg';
}

export function Spinner({ size = 'sm' }: SpinnerProps) {
  const sizeClass = size === 'lg' ? 'spinner--lg' : '';

  return (
    <span className={`spinner ${sizeClass}`} role="status" aria-label="Loading"></span>
  );
}

// ===== Button =====
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  isLoading?: boolean;
  isBlock?: boolean;
}

export function Button({ variant = 'secondary', isLoading, isBlock, children, disabled, ...props }: ButtonProps) {
  const variantClass = variant !== 'secondary' ? `btn--${variant}` : '';
  const blockClass = isBlock ? 'btn--block' : '';

  return (
    <button
      className={`btn ${variantClass} ${blockClass}`}
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      {...props}
    >
      {isLoading && <Spinner />}
      {children}
    </button>
  );
}

// ===== Input =====
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>((props, ref) => {
  return <input ref={ref} className="input" {...props} />;
});

// ===== Select =====
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>((props, ref) => {
  return <select ref={ref} className="input" {...props} />;
});

// ===== FormField =====
interface FormFieldProps {
  label: string;
  hint?: string;
  error?: string;
  children: (props: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }) => ReactNode;
}

export function FormField({ label, hint, error, children }: FormFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  const describedBy = error ? errorId : (hint ? hintId : undefined);

  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>{label}</label>

      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': !!error })}

      {hint && !error && <span className="field__hint" id={hintId}>{hint}</span>}

      {error && <span className="field__error" id={errorId} role="alert">{error}</span>}
    </div>
  );
}

// ===== Alert =====
interface AlertProps {
  variant: 'info' | 'success' | 'error' | 'warning';
  title?: string;
  children: ReactNode;
}

export function Alert({ variant, title, children }: AlertProps) {
  // Accessibility: errors use role 'alert', everything else uses 'status'
  const role = variant === 'error' ? 'alert' : 'status';

  return (
    <div className={`alert alert--${variant}`} role={role}>
      <div>
        {title && <div className="alert__title">{title}</div>}
        {children}
      </div>
    </div>
  );
}

// ===== Card =====
interface CardProps {
  title: string;
  desc?: string;
  className?: string;
  children: ReactNode;
}

export function Card({ title, desc, className = '', children }: CardProps) {
  return (
    <div className={`card ${className}`.trim()}>
      <h3 className="card__title">{title}</h3>
      {desc && <p className="card__desc">{desc}</p>}
      {children}
    </div>
  );
}
