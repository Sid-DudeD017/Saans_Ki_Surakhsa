import React from 'react';

export interface CardProps {
  children: React.ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  bordered?: boolean;
  style?: React.CSSProperties;
  className?: string;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({
  children,
  padding = 'md',
  bordered = true,
  style,
  className = '',
  onClick,
}) => {
  const getPadding = () => {
    switch (padding) {
      case 'none':
        return '0';
      case 'sm':
        return '0.75rem';
      case 'lg':
        return '1.5rem';
      default:
        return '1rem';
    }
  };

  return (
    <div
      className={className}
      onClick={onClick}
      style={{
        backgroundColor: '#ffffff',
        borderRadius: '0.75rem',
        padding: getPadding(),
        border: bordered ? '1px solid #e2e8f0' : 'none',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
        cursor: onClick ? 'pointer' : 'default',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export default Card;
