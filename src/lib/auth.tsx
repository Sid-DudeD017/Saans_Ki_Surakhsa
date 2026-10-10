'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export type UserRole =
  | 'student'
  | 'parent'
  | 'teacher'
  | 'principal'
  | 'citizen'
  | 'official';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  schoolId?: string;
  schoolName?: string;
}

export interface AuthContextValue {
  user: User | null;
  role: UserRole;
  setRole: (role: UserRole) => void;
  getCurrentRole: () => UserRole;
  getCurrentUser: () => User | null;
}

const STORAGE_KEY_ROLE = 'saans_user_role';

const DEFAULT_USER: User = {
  id: 'usr_demo_01',
  name: 'Aarav Sharma',
  role: 'student',
  schoolId: 'school_demo_001',
  schoolName: 'Government Senior Secondary School — Sangrur Campus',
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const VALID_ROLES: UserRole[] = [
  'student',
  'parent',
  'teacher',
  'principal',
  'citizen',
  'official',
];

const roleListeners = new Set<() => void>();

function subscribeRole(callback: () => void) {
  roleListeners.add(callback);
  const handleStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY_ROLE) callback();
  };
  window.addEventListener('storage', handleStorage);
  return () => {
    roleListeners.delete(callback);
    window.removeEventListener('storage', handleStorage);
  };
}

function getRoleSnapshot(): UserRole {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_ROLE);
    if (saved && VALID_ROLES.includes(saved as UserRole)) {
      return saved as UserRole;
    }
  } catch {
    // LocalStorage not available
  }
  return 'student';
}

function getServerRoleSnapshot(): UserRole {
  return 'student';
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const role = React.useSyncExternalStore(
    subscribeRole,
    getRoleSnapshot,
    getServerRoleSnapshot
  );

  const setRole = (newRole: UserRole) => {
    try {
      localStorage.setItem(STORAGE_KEY_ROLE, newRole);
    } catch {
      // ignore
    }
    roleListeners.forEach((l) => l());
  };

  const user: User | null = {
    ...DEFAULT_USER,
    role,
  };

  const getCurrentRole = () => role;
  const getCurrentUser = () => user;

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        setRole,
        getCurrentRole,
        getCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
