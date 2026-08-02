import React from 'react';
import { Database } from 'lucide-react';
import { Button } from './Button';

export interface EmptyStateProps {
  title?: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No Records Found',
  description = 'There are no active records in this directory matching your parameters.',
  actionText,
  onAction,
  icon,
  className = '',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center text-center p-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-slate-50/50 dark:bg-slate-900/10 space-y-4 ${className}`}>
      {/* Icon Frame */}
      <div className="w-12 h-12 bg-rose-500/10 dark:bg-rose-500/5 text-rose-500 rounded-2xl flex items-center justify-center shadow-sm">
        {icon || <Database className="w-6 h-6" />}
      </div>

      <div className="space-y-1 max-w-sm">
        <h4 className="text-base font-bold text-slate-800 dark:text-slate-200">{title}</h4>
        <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">{description}</p>
      </div>

      {actionText && onAction && (
        <Button variant="primary" size="sm" onClick={onAction}>
          {actionText}
        </Button>
      )}
    </div>
  );
};
export default EmptyState;
