import { clsx } from 'clsx';
import { forwardRef, type ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

const variantStyles = {
  primary:
    'bg-brand hover:bg-brand-light text-white shadow-lg shadow-brand/25 hover:shadow-brand/40',
  ghost:
    'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10',
  danger:
    'bg-fail/20 hover:bg-fail/30 text-fail border border-fail/30',
};

const sizeStyles = {
  sm: 'px-3 py-1.5 text-sm rounded-lg',
  md: 'px-5 py-2.5 text-sm rounded-xl',
  lg: 'px-7 py-3.5 text-base rounded-xl',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, className, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={clsx(
          'inline-flex items-center justify-center gap-2 font-semibold',
          'transition-all duration-150 active:scale-[0.97]',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {loading && (
          <span className="w-4 h-4 rounded-full border-2 border-current/30 border-t-current animate-spin" />
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
export default Button;
