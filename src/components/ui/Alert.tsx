import React from 'react';

export interface AlertProps {
  children: React.ReactNode;
  variant?: 'info' | 'warning' | 'danger' | 'success';
  title?: string;
  icon?: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

export const Alert: React.FC<AlertProps> = ({
  children,
  variant = 'info',
  title,
  icon,
  style,
  className = '',
}) => {
  const getStyles = () => {
    switch (variant) {
      case 'warning':
        return {
          bg: '#fffbeb',
          border: '#fde68a',
          text: '#92400e',
          iconDef: '⚠️',
        };
      case 'danger':
        return {
          bg: '#fef2f2',
          border: '#fecaca',
          text: '#991b1b',
          iconDef: '🚨',
        };
      case 'success':
        return {
          bg: '#f0fdf4',
          border: '#bbf7d0',
          text: '#166534',
          iconDef: '✅',
        };
      default: // info
        return {
          bg: '#f0f9ff',
          border: '#bae6fd',
          text: '#075985',
          iconDef: 'ℹ️',
        };
    }
  };

  const current = getStyles();

  return (
    <div
      role="alert"
      className={className}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        padding: '0.875rem 1rem',
        borderRadius: '0.625rem',
        backgroundColor: current.bg,
        border: `1px solid ${current.border}`,
        color: current.text,
        fontSize: '0.875rem',
        lineHeight: 1.45,
        ...style,
      }}
    >
      <span style={{ fontSize: '1.15rem', lineHeight: 1 }}>{icon || current.iconDef}</span>
      <div style={{ flex: 1 }}>
        {title && (
          <div style={{ fontWeight: 700, marginBottom: '0.25rem', fontSize: '0.9rem' }}>
            {title}
          </div>
        )}
        <div>{children}</div>
      </div>
    </div>
  );
};

export default Alert;
