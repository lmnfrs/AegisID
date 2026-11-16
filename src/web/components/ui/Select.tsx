import type { SelectHTMLAttributes } from 'react';
import { forwardRef } from 'react';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>((props, ref) => {
  return <select ref={ref} className="input" {...props} />;
});
