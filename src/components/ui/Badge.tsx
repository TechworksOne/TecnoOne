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
        return "bg-red-50 text-red-700 border-red-200 dark:bg-[#202124] dark:text-red-300 dark:border-[#303134]";
      case "green":
        return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-[#202124] dark:text-emerald-300 dark:border-[#303134]";
      case "yellow":
        return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-[#202124] dark:text-amber-300 dark:border-[#303134]";
      case "blue":
        return "bg-sky-50 text-sky-700 border-sky-200 dark:bg-[#202124] dark:text-blue-300 dark:border-[#303134]";
      case "purple":
        return "bg-violet-50 text-violet-700 border-violet-200 dark:bg-[#202124] dark:text-[#9AA0A6] dark:border-[#303134]";
      case "gray":
      default:
        return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-[#202124] dark:text-[#9AA0A6] dark:border-[#303134]";
    }
  };

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${getColorClasses(color)} ${className}`}>
      {children}
    </span>
  );
}
