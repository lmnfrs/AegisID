import type { ButtonHTMLAttributes } from 'react';
import { Spinner } from './Spinner';

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