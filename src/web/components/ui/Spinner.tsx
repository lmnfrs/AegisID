interface SpinnerProps {
  size?: 'sm' | 'lg';
}

export function Spinner({ size = 'sm' }: SpinnerProps) {
  const sizeClass = size === 'lg' ? 'spinner--lg' : '';
  
  return (
    <span className={`spinner ${sizeClass}`} role="status" aria-label="Loading"></span>
  );
}