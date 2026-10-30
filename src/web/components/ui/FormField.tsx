import type { ReactNode } from 'react';
import { useId } from 'react';

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