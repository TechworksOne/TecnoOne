import { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  action?: ReactNode;
  description?: string;
}

export function EmptyState({ title, subtitle, icon, action, description }: EmptyStateProps) {
  return (
    <div className="text-center p-8">
      <div className="flex justify-center mb-4">
        {icon ? (
          <div className="text-gray-400 dark:text-slate-500">
            {icon}
          </div>
        ) : (
          <div className="text-2xl text-gray-400">—</div>
        )}
      </div>
      <h3 className="mt-2 text-lg font-semibold text-gray-800">{title}</h3>
      {(subtitle || description) && (
        <p className="text-sm text-gray-500 mt-2">
          {subtitle || description}
        </p>
      )}
      {action && (
        <div className="mt-4">
          {action}
        </div>
      )}
    </div>
  );
}

export default EmptyState;
