import React, { useState } from 'react';

export interface AvatarProps {
  src?: string;
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({ src, name, size = 'md', className = '' }) => {
  const [hasError, setHasError] = useState(false);

  const getInitials = (n: string) => {
    return n
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const sizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-16 h-16 text-xl',
  };

  const ringSizes = {
    sm: 'p-[1.5px]',
    md: 'p-[2px]',
    lg: 'p-[3px]',
  };

  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 rounded-full bg-gradient-to-tr from-rose-600 to-rose-400 ${ringSizes[size]} ${className}`}>
      <div className={`flex items-center justify-center w-full h-full rounded-full bg-slate-900 overflow-hidden`}>
        {src && !hasError ? (
          <img
            src={src}
            alt={name}
            onError={() => setHasError(true)}
            className="w-full h-full object-cover rounded-full"
          />
        ) : (
          <span className={`font-bold tracking-wider text-white ${sizes[size] === 'w-16 h-16 text-xl' ? 'text-lg' : 'text-[10px]' } flex items-center justify-center`}>
            {getInitials(name || 'User')}
          </span>
        )}
      </div>
    </div>
  );
};
export default Avatar;
