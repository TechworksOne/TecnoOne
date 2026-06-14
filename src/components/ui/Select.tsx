export default function Select({ onValueChange, className, ...props }: any) {
  return (
    <select
      className={`w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text)] shadow-sm outline-none transition disabled:cursor-not-allowed disabled:opacity-60 focus:border-[var(--tenant-primary-color)] focus:ring-4 focus:ring-[rgba(var(--tenant-primary-rgb),0.14)]${className ? ' ' + className : ''}`}
      onChange={(e) => onValueChange?.(e.target.value)}
      {...props} 
    />
  );
}
