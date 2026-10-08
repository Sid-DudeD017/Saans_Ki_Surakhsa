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
  schoolName: 'Government Model School — Demo Campus',
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [role, setRoleState] = useState<UserRole>('student');
  const [user, setUser] = useState<User | null>(DEFAULT_USER);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ROLE);
      if (
        saved &&
        [
          'student',
          'parent',
          'teacher',
          'principal',
          'citizen',
          'official',
        ].includes(saved)
      ) {
        setRoleState(saved as UserRole);
        setUser((prev) => (prev ? { ...prev, role: saved as UserRole } : null));
      }
    } catch {
      // LocalStorage not available or SSR
    }
  }, []);

  const setRole = (newRole: UserRole) => {
    setRoleState(newRole);
    setUser((prev) => (prev ? { ...prev, role: newRole } : null));
    try {
      localStorage.setItem(STORAGE_KEY_ROLE, newRole);
    } catch {
      // ignore
    }
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
