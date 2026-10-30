import type { ReactNode } from 'react';

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