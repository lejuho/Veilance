import type { ReactNode } from 'react';
import type { Role } from '@/api/types';
import { ROLES } from '@/lib/registry';
import { useRole } from '@/state/role';
import { Button, Card } from './ui';

/** Shows the page only for the allowed roles; otherwise a one-click switch. */
export function RoleGate({ allow, children, why }: { allow: Role[]; children: ReactNode; why?: string }) {
  const { role, setRole } = useRole();
  if (allow.includes(role)) return <>{children}</>;
  return (
    <Card title="Switch party" subtitle={why ?? 'This page belongs to a different party.'}>
      <div className="flex flex-wrap gap-2">
        {allow.map((r) => {
          const def = ROLES.find((x) => x.id === r)!;
          return (
            <Button key={r} variant="secondary" onClick={() => setRole(r)}>
              Act as {def.label}
            </Button>
          );
        })}
      </div>
    </Card>
  );
}

export function PageTitle({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-300">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
