import type { InputHTMLAttributes } from 'react';
import { forwardRef } from 'react';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>((props, ref) => {
  return <input ref={ref} className="input" {...props} />;
});