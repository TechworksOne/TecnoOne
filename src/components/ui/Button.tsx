import React from "react";

export default function Button({
  children,
  onClick,
  className = "",
  variant = "primary",
  size = "md",
  ...rest
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  variant?: "primary" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
  [k: string]: any;
}) {
  const base = "rounded-lg font-medium transition-colors focus:outline-none focus:ring-4 focus:ring-[rgba(var(--tenant-primary-rgb),0.16)] disabled:cursor-not-allowed disabled:opacity-60";
  
  const sizeClasses = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2",
    lg: "px-6 py-3 text-lg"
  };
  
  const variantClasses = {
    primary: "bg-[var(--tenant-primary-color)] text-white shadow-sm hover:bg-[var(--tenant-primary-dark)]",
    ghost: "bg-transparent border border-transparent text-[var(--color-text-sec)] hover:bg-[var(--color-row-hover)]",
    outline: "bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] shadow-sm hover:bg-[var(--color-surface-soft)]"
  };
  
  return (
    <button 
      onClick={onClick} 
      className={`${base} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`} 
      {...rest}
    >
      {children}
    </button>
  );
}
