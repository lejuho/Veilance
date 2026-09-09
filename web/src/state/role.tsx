import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { PartyName, Role } from '@/api/types';

const KEY = 'veilance.role';
const VALID: Role[] = ['admin', 'mine', 'refiner', 'batteryMfr', 'verifier'];

interface RoleCtx {
  role: Role;
  /** The active party, or null for the verifier (no wallet). */
  party: PartyName | null;
  setRole: (r: Role) => void;
}

const Ctx = createContext<RoleCtx | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>(() => {
    try {
      const v = localStorage.getItem(KEY) as Role | null;
      if (v && VALID.includes(v)) return v;
    } catch {
      /* ignore */
    }
    return 'admin';
  });
  const setRole = useCallback((r: Role) => {
    setRoleState(r);
    try {
      localStorage.setItem(KEY, r);
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY && e.newValue && VALID.includes(e.newValue as Role)) setRoleState(e.newValue as Role);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  const value = useMemo<RoleCtx>(() => ({ role, party: role === 'verifier' ? null : role, setRole }), [role, setRole]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRole(): RoleCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useRole outside RoleProvider');
  return v;
}
