import React from 'react';

const Input = React.forwardRef<HTMLInputElement, { placeholder?: string; value?: string; onChange?: any; type?: string; className?: string } & any>(
  ({ className, ...props }, ref) => {
    return <input ref={ref} className={`w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text)] shadow-sm outline-none transition placeholder:text-[var(--color-text-muted)] disabled:cursor-not-allowed disabled:opacity-60 focus:border-[var(--tenant-primary-color)] focus:ring-4 focus:ring-[rgba(var(--tenant-primary-rgb),0.14)]${className ? ' ' + className : ''}`} {...props} />;
  }
);

Input.displayName = 'Input';

export default Input;
