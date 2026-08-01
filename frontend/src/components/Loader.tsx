import React from 'react';

interface LoaderProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  className?: string;
}

export const Loader: React.FC<LoaderProps> = ({
  size = 'md',
  color = 'text-rose-600',
  className = '',
}) => {
  const sizeClasses = {
    sm: 'h-5 w-5 border-2',
    md: 'h-8 w-8 border-[3px]',
    lg: 'h-12 w-12 border-4',
  };

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div
        className={`${sizeClasses[size]} animate-spin rounded-full border-t-transparent border-current ${color}`}
        role="status"
        aria-label="loading"
      >
        <span className="sr-only">Loading...</span>
      </div>
    </div>
  );
};

export const CardSkeleton: React.FC = () => (
  <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-6 space-y-4 animate-pulse">
    <div className="flex justify-between items-center">
      <div className="h-4 bg-slate-800/60 rounded w-1/3"></div>
      <div className="h-8 bg-slate-800/60 rounded-full w-8"></div>
    </div>
    <div className="h-8 bg-slate-800/60 rounded w-1/2"></div>
    <div className="h-3 bg-slate-800/60 rounded w-2/3"></div>
  </div>
);

export const TableSkeleton: React.FC = () => (
  <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-6 space-y-4 animate-pulse">
    <div className="flex justify-between">
      <div className="h-5 bg-slate-800/60 rounded w-1/4"></div>
      <div className="h-5 bg-slate-800/60 rounded w-12"></div>
    </div>
    <div className="space-y-4 pt-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex space-x-4 items-center">
          <div className="h-4 bg-slate-800/60 rounded flex-1"></div>
          <div className="h-4 bg-slate-800/60 rounded w-24"></div>
          <div className="h-4 bg-slate-800/60 rounded w-20"></div>
        </div>
      ))}
    </div>
  </div>
);
