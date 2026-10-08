import React from 'react';

export interface ContainerProps {
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  style?: React.CSSProperties;
  className?: string;
}

export const Container: React.FC<ContainerProps> = ({
  children,
  maxWidth = 'md',
  style,
  className = '',
}) => {
  const getMaxWidth = () => {
    switch (maxWidth) {
      case 'sm':
        return '640px';
      case 'lg':
        return '1024px';
      case 'xl':
        return '1200px';
      case 'full':
        return '100%';
      default:
        return '840px';
    }
  };

  return (
    <div
      className={className}
      style={{
        width: '100%',
        maxWidth: getMaxWidth(),
        margin: '0 auto',
        paddingLeft: '1rem',
        paddingRight: '1rem',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export interface StackProps {
  children: React.ReactNode;
  direction?: 'row' | 'column';
  gap?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  align?: 'flex-start' | 'center' | 'flex-end' | 'stretch';
  justify?: 'flex-start' | 'center' | 'flex-end' | 'space-between';
  wrap?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

export const Stack: React.FC<StackProps> = ({
  children,
  direction = 'column',
  gap = 'md',
  align,
  justify,
  wrap = false,
  style,
  className = '',
}) => {
  const getGap = () => {
    switch (gap) {
      case 'xs':
        return '0.25rem';
      case 'sm':
        return '0.5rem';
      case 'lg':
        return '1.5rem';
      case 'xl':
        return '2rem';
      default:
        return '1rem';
    }
  };

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: direction,
        gap: getGap(),
        alignItems: align,
        justifyContent: justify,
        flexWrap: wrap ? 'wrap' : 'nowrap',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export default Container;
