'use client';

import React from 'react';
import { useAuth, UserRole } from '../../lib/auth';

export interface RolePickerProps {
  size?: 'sm' | 'md';
  style?: React.CSSProperties;
}

export const RolePicker: React.FC<RolePickerProps> = ({
  size = 'sm',
  style,
}) => {
  const { role, setRole } = useAuth();

  return (
    <select
      value={role}
      onChange={(e) => setRole(e.target.value as UserRole)}
      title="Active Persona / Role"
      aria-label="Active Persona / Role"
      style={{
        fontSize: size === 'sm' ? '0.75rem' : '0.875rem',
        fontWeight: 600,
        padding: size === 'sm' ? '0.25rem 0.5rem' : '0.4rem 0.75rem',
        borderRadius: '0.375rem',
        border: '1px solid #cbd5e1',
        backgroundColor: '#f8fafc',
        color: '#1e293b',
        cursor: 'pointer',
        outline: 'none',
        ...style,
      }}
    >
      <option value="student">🎒 Student</option>
      <option value="parent">🏡 Parent</option>
      <option value="teacher">📚 Teacher</option>
      <option value="principal">🏛️ Principal</option>
      <option value="citizen">👤 Citizen</option>
      <option value="official">🏢 Official</option>
    </select>
  );
};

export default RolePicker;
