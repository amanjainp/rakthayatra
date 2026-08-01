import React from 'react';
import { AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'success' | 'danger' | 'warning' | 'info';
  title?: string;
}

export const Alert: React.FC<AlertProps> = ({ children, variant = 'info', title, className = '', ...props }) => {
  const icons = {
    success: <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />,
    danger: <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />,
    info: <Info className="w-5 h-5 text-blue-500 shrink-0" />,
  };

  const variants = {
    success: 'bg-emerald-500/5 border-emerald-500/10 text-slate-800 dark:text-emerald-200/90',
    danger: 'bg-red-500/5 border-red-500/10 text-slate-800 dark:text-red-200/90',
    warning: 'bg-amber-500/5 border-amber-500/10 text-slate-800 dark:text-amber-200/90',
    info: 'bg-blue-500/5 border-blue-500/10 text-slate-800 dark:text-blue-200/90',
  };

  return (
    <div
      className={`border rounded-2xl p-4 flex gap-3 text-sm ${variants[variant]} ${className}`}
      {...props}
    >
      {icons[variant]}
      <div className="space-y-1">
        {title && <h5 className="font-bold leading-tight">{title}</h5>}
        <div className="leading-relaxed opacity-90">{children}</div>
      </div>
    </div>
  );
};
export default Alert;
