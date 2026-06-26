// components/layout/Sidebar.tsx
'use client';
import { useState } from 'react';
import { colors, spacing } from '@/lib/tokens';

const NAV_ITEMS = [
  { icon: '👥', label: 'Clients' },
  { icon: '📦', label: 'Produits' },
  { icon: '🏭', label: 'Gestion de stock' },
  { icon: '🏷️', label: 'Marques' },
  { icon: '🚚', label: 'Livraison' },
  { icon: '📊', label: 'Statistiques V2', badge: 'new' },
  { icon: '💰', label: 'Comptabilité' },
  { icon: '📋', label: 'Données' },
  { icon: '🔧', label: 'Gestion des statuts' },
  { icon: '🔔', label: 'Webhooks' },
  { icon: '👮', label: 'Modérateurs' },
  { icon: '🏪', label: 'Boutiques' },
  { icon: '⚙️', label: 'Paramètres avancées' },
];

interface SidebarProps {
  active?: string;
  onChange?: (label: string) => void;
}

export default function Sidebar({ active = 'Clients', onChange }: SidebarProps) {
  const [current, setCurrent] = useState(active);

  const handleClick = (label: string) => {
    setCurrent(label);
    onChange?.(label);
  };

  return (
    <nav style={{
      width: spacing.sidebarW,
      background: '#fff',
      borderRight: `1px solid ${colors.border}`,
      flexShrink: 0,
      overflowY: 'auto',
      padding: '6px 0',
      fontFamily: "'Inter', sans-serif",
    }}>
      {NAV_ITEMS.map(({ icon, label, badge }) => {
        const isActive = current === label;
        return (
          <div
            key={label}
            onClick={() => handleClick(label)}
            role="button"
            tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && handleClick(label)}
            style={{
              display: 'flex', alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 13px', cursor: 'pointer',
              fontSize: 12.5,
              color: isActive ? colors.primary : colors.textMd,
              fontWeight: isActive ? 500 : 400,
              background: isActive ? colors.primaryLt : 'transparent',
              borderLeft: `3px solid ${isActive ? colors.primary : 'transparent'}`,
              transition: 'background .12s',
            }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 16, textAlign: 'center', fontSize: 13 }}>{icon}</span>
              <span>{label}</span>
              {badge && (
                <span style={{
                  background: '#F59800', color: '#fff',
                  borderRadius: 3, padding: '0 4px',
                  fontSize: 9, fontWeight: 700,
                }}>
                  {badge}
                </span>
              )}
            </div>
            <span style={{ fontSize: 9, color: colors.textLt }}>▾</span>
          </div>
        );
      })}
    </nav>
  );
}
