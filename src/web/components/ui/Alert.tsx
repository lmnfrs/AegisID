import type { ReactNode } from 'react';

interface AlertProps {
  variant: 'info' | 'success' | 'error';
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