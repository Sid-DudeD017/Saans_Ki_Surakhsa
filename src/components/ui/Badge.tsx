import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md';
  style?: React.CSSProperties;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  style,
  className = '',
}) => {
  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: '#e0f2fe',
          color: '#0369a1',
          border: '1px solid #bae6fd',
        };
      case 'success':
        return {
          backgroundColor: '#f0fdf4',
          color: '#15803d',
          border: '1px solid #bbf7d0',
        };
      case 'warning':
        return {
          backgroundColor: '#fffbeb',
          color: '#b45309',
          border: '1px solid #fde68a',
        };
      case 'danger':
        return {
          backgroundColor: '#fef2f2',
          color: '#b91c1c',
          border: '1px solid #fecaca',
        };
      default:
        return {
          backgroundColor: '#f1f5f9',
          color: '#334155',
          border: '1px solid #cbd5e1',
        };
    }
  };

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem',
        padding: size === 'sm' ? '0.125rem 0.375rem' : '0.25rem 0.625rem',
        fontSize: size === 'sm' ? '0.6875rem' : '0.75rem',
        fontWeight: 600,
        borderRadius: '9999px',
        lineHeight: 1,
        ...getVariantStyles(),
        ...style,
      }}
    >
      {children}
    </span>
  );
};

export default Badge;
