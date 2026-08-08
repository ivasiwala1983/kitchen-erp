'use client';

import React from 'react';
import { TenantProvider } from '../../../contexts/TenantContext';

export default function TenantLayout({ children }: { children: React.ReactNode }) {
  return <TenantProvider>{children}</TenantProvider>;
}
