import React from "react";

interface BadgeProps {
  children: React.ReactNode;
  color?: string;
  className?: string;
}

export default function Badge({ children, color = "gray", className = "" }: BadgeProps) {
  const getColorClasses = (color: string) => {
    switch (color) {
      case "red":
        return "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/35 dark:text-red-300 dark:border-red-900/60";
      case "green":
        return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/35 dark:text-emerald-300 dark:border-emerald-900/60";
      case "yellow":
        return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/35 dark:text-amber-300 dark:border-amber-900/60";
      case "blue":
        return "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/35 dark:text-sky-300 dark:border-sky-900/60";
      case "purple":
        return "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/35 dark:text-violet-300 dark:border-violet-900/60";
      case "gray":
      default:
        return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
    }
  };

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${getColorClasses(color)} ${className}`}>
      {children}
    </span>
  );
}
