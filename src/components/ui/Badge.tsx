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
        return "bg-red-100 text-red-700";
      case "green":
        return "bg-green-100 text-green-700";
      case "yellow":
        return "bg-yellow-100 text-yellow-700";
      case "blue":
        return "bg-blue-100 text-blue-700";
      case "purple":
        return "bg-purple-100 text-purple-700";
      case "gray":
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs ${getColorClasses(color)} ${className}`}>
      {children}
    </span>
  );
}
