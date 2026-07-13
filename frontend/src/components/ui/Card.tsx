import { clsx } from 'clsx';
import type { HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingMap = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export default function Card({ hover, padding = 'md', className, children, ...props }: CardProps) {
  return (
    <div
      className={clsx(
        'glass transition-all duration-200',
        hover && 'hover:bg-surface-1 hover:border-white/10 hover:-translate-y-0.5 cursor-pointer',
        paddingMap[padding],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
