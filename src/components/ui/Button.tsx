import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  leftIcon,
  rightIcon,
  style,
  disabled,
  className = '',
  ...props
}) => {
  const getPadding = () => {
    switch (size) {
      case 'sm':
        return '0.375rem 0.75rem';
      case 'lg':
        return '0.75rem 1.5rem';
      default:
        return '0.5rem 1rem';
    }
  };

  const getFontSize = () => {
    switch (size) {
      case 'sm':
        return '0.8125rem';
      case 'lg':
        return '1rem';
      default:
        return '0.875rem';
    }
  };

  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'secondary':
        return {
          backgroundColor: '#f1f5f9',
          color: '#1e293b',
          border: '1px solid #cbd5e1',
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          color: '#0369a1',
          border: '1.5px solid #0369a1',
        };
      case 'danger':
        return {
          backgroundColor: '#dc2626',
          color: '#ffffff',
          border: 'none',
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
          color: '#334155',
          border: 'none',
        };
      default: // primary
        return {
          backgroundColor: '#0369a1',
          color: '#ffffff',
          border: 'none',
        };
    }
  };

  return (
    <button
      disabled={disabled}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        padding: getPadding(),
        fontSize: getFontSize(),
        fontWeight: 600,
        borderRadius: '0.5rem',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        width: fullWidth ? '100%' : 'auto',
        transition: 'all 0.15s ease-in-out',
        lineHeight: 1.25,
        ...getVariantStyles(),
        ...style,
      }}
      {...props}
    >
      {leftIcon && <span style={{ display: 'inline-flex', alignItems: 'center' }}>{leftIcon}</span>}
      <span>{children}</span>
      {rightIcon && <span style={{ display: 'inline-flex', alignItems: 'center' }}>{rightIcon}</span>}
    </button>
  );
};

export default Button;
