import React from 'react';
import { ChevronRight, Home } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ items, className = '' }) => {
  return (
    <nav className={`flex items-center text-xs font-semibold text-slate-500 dark:text-slate-400 ${className}`} aria-label="Breadcrumb">
      <ol className="flex items-center space-x-2">
        <li className="flex items-center">
          <Link to="/" className="hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
            <Home className="w-3.5 h-3.5" />
          </Link>
        </li>
        {items.map((item, idx) => (
          <li key={idx} className="flex items-center space-x-2">
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600 shrink-0" />
            {item.href ? (
              <Link
                to={item.href}
                className="hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span className="text-slate-800 dark:text-slate-200 font-bold">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};
export default Breadcrumb;
