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
  const base = "rounded-xl font-medium transition-colors";
  
  const sizeClasses = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2",
    lg: "px-6 py-3 text-lg"
  };
  
  const variantClasses = {
    primary: "bg-primary-500 text-white hover:bg-primary-600",
    ghost: "bg-transparent border hover:bg-slate-50 dark:hover:bg-slate-800",
    outline: "bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
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
