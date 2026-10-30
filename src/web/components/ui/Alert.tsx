import type { ReactNode } from 'react';

interface AlertProps {
  variant: 'info' | 'success' | 'error';
  title?: string;
  children: ReactNode;
}

export function Alert({ variant, title, children }: AlertProps) {
  // Tiêu chuẩn trợ năng (Accessibility): Lỗi thì báo 'alert', bình thường thì báo 'status'
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