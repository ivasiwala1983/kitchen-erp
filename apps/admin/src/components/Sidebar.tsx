'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import type { UserPublic } from '@kitchen-erp/types';
import { Role } from '@kitchen-erp/types';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles: Role[];
}

const navGroups = [
  {
    label: 'Main',
    items: [
      {
        label: 'Dashboard',
        href: '/dashboard',
        roles: [Role.SUPER_ADMIN, Role.TENANT_ADMIN],
        icon: (
          <svg
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
        ),
      },
    ],
  },
  {
    label: 'Platform',
    items: [
      {
        label: 'Tenants',
        href: '/dashboard/tenants',
        roles: [Role.SUPER_ADMIN],
        icon: (
          <svg
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            <polyline points="9,22 9,12 15,12 15,22" />
          </svg>
        ),
      },
    ],
  },
  {
    label: 'Management',
    items: [
      {
        label: 'Users',
        href: '/dashboard/users',
        roles: [Role.TENANT_ADMIN],
        icon: (
          <svg
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
          </svg>
        ),
      },
      {
        label: 'Category Master',
        href: '/dashboard/categories',
        roles: [Role.TENANT_ADMIN],
        icon: (
          <svg
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
        ),
      },
      {
        label: 'Vendor Master',
        href: '/dashboard/vendors',
        roles: [Role.TENANT_ADMIN],
        icon: (
          <svg
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z" />
            <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
          </svg>
        ),
      },
      {
        label: 'Product Master',
        href: '/dashboard/products',
        roles: [Role.TENANT_ADMIN],
        icon: (
          <svg
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <polygon points="12,2 2,7 12,12 22,7" />
            <polyline points="2,17 12,22 22,17" />
            <polyline points="2,12 12,17 22,12" />
          </svg>
        ),
      },
    ],
  },
  {
    label: 'Operations',
    items: [
      {
        label: 'Purchases',
        href: '/dashboard/purchases',
        roles: [Role.TENANT_ADMIN],
        icon: (
          <svg
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 01-8 0" />
          </svg>
        ),
      },
      {
        label: 'Reports',
        href: '/dashboard/reports',
        roles: [Role.SUPER_ADMIN, Role.TENANT_ADMIN],
        icon: (
          <svg
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
        ),
      },
    ],
  },
  {
    label: 'System',
    items: [
      {
        label: 'Audit Logs',
        href: '/dashboard/audit-logs',
        roles: [Role.SUPER_ADMIN, Role.TENANT_ADMIN],
        icon: (
          <svg
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14,2 14,8 20,8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10,9 9,9 8,9" />
          </svg>
        ),
      },
    ],
  },
];

export default function Sidebar({ user }: { user: UserPublic }) {
  const pathname = usePathname();
  const { logout } = useAuth();

  const getRoleLabel = (role: Role) => {
    return {
      SUPER_ADMIN: 'Super Admin',
      TENANT_ADMIN: 'Tenant Admin',
      INVENTORY_MANAGER: 'Inventory Manager',
    }[role];
  };

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.5rem 0.875rem',
          marginBottom: '0.5rem',
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            flexShrink: 0,
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M3 2h18M3 22h18M6 2v20M18 2v20M3 12h18" />
          </svg>
        </div>
        <div>
          <div
            style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--color-text-primary)' }}
          >
            Kitchen ERP
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
            Admin Portal
          </div>
        </div>
      </div>

      <div style={{ borderBottom: '1px solid var(--color-border)', margin: '0.5rem 0' }} />

      {/* Nav groups */}
      {navGroups.map((group) => {
        const visibleItems = group.items.filter((item) => item.roles.includes(user.role));
        if (visibleItems.length === 0) return null;

        return (
          <div key={group.label}>
            <div className="nav-group-label">{group.label}</div>
            {visibleItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item ${pathname === item.href ? 'active' : ''}`}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
          </div>
        );
      })}

      {/* User section */}
      <div style={{ marginTop: 'auto' }}>
        <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
          <div style={{ padding: '0.5rem 0.875rem', marginBottom: '0.5rem' }}>
            <div
              style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)' }}
            >
              {user.name}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              {user.email}
            </div>
            <div style={{ marginTop: '0.25rem' }}>
              <span className="badge badge-purple">{getRoleLabel(user.role)}</span>
            </div>
          </div>
          <button
            onClick={logout}
            className="nav-item"
            style={{
              width: '100%',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: 'var(--color-text-muted)',
            }}
          >
            <svg
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline points="16,17 21,12 16,7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Logout
          </button>
        </div>
      </div>
    </aside>
  );
}
