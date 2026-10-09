import React from 'react';
import styles from './Skeleton.module.css';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  shape?: 'rect' | 'circle';
  className?: string;
  style?: React.CSSProperties;
}

const Skeleton: React.FC<SkeletonProps> = ({
  width,
  height,
  borderRadius,
  shape = 'rect',
  className = '',
  style,
}) => {
  const inlineStyle: React.CSSProperties = {
    width: width || (shape === 'circle' ? '50px' : '100%'),
    height: height || (shape === 'circle' ? '50px' : '100%'),
    borderRadius: shape === 'circle' ? '50%' : borderRadius || '8px',
    ...style,
  };

  return (
    <div
      className={`${styles.skeleton} ${className}`}
      style={inlineStyle}
      aria-hidden="true"
    />
  );
};

export default Skeleton;
