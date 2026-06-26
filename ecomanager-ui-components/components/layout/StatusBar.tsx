// components/layout/StatusBar.tsx
'use client';
import { colors } from '@/lib/tokens';

interface StatusCounts {
  enConfirmation: number;
  enPreparation:  number;
  enDispatch:     number;
  enLivraison:    number;
  livrees:        number;
  enRetour:       number;
}

interface StatusBarProps {
  counts?: StatusCounts;
  onStatusClick?: (status: string) => void;
}

const defaultCounts: StatusCounts = {
  enConfirmation: 0, enPreparation: 0, enDispatch: 0,
  enLivraison: 0, livrees: 0, enRetour: 0,
};

export default function StatusBar({ counts = defaultCounts, onStatusClick }: StatusBarProps) {
  const statuses = [
    { key: 'enConfirmation', label: 'En confirmation', count: counts.enConfirmation },
    { key: 'enPreparation',  label: 'En préparation',  count: counts.enPreparation },
    { key: 'enDispatch',     label: 'En dispatch',     count: counts.enDispatch },
    { key: 'enLivraison',    label: 'En livraison',    count: counts.enLivraison },
    { key: 'livrees',        label: 'Livrées',          count: counts.livrees },
    { key: 'enRetour',       label: 'En retour',        count: counts.enRetour },
  ];

  const badge = (count: number) => (
    <span style={{
      background: count > 0 ? colors.primaryLt : '#eee',
      color: count > 0 ? colors.primary : '#777',
      borderRadius: 10, padding: '1px 6px',
      fontSize: 10.5, fontWeight: 600,
    }}>
      {count}
    </span>
  );

  const divider = <div style={{ width:1, height:18, background:colors.border, margin:'0 3px', flexShrink:0 }} />;

  const iconBtn = (content: React.ReactNode, color: string, title: string) => (
    <button title={title} style={{
      width:26, height:26, display:'flex', alignItems:'center', justifyContent:'center',
      borderRadius:3, cursor:'pointer', border:'none', background:'transparent',
      fontSize:13, color, fontFamily:'inherit',
    }}>
      {content}
    </button>
  );

  return (
    <div style={{
      height: 36, background: '#fff',
      borderBottom: `1px solid ${colors.border}`,
      display: 'flex', alignItems: 'center',
      padding: '0 8px', gap: 2, flexShrink: 0,
      overflowX: 'auto', fontFamily: "'Inter', sans-serif",
    }}>
      {/* Add button */}
      <button style={{
        display:'flex', alignItems:'center', gap:4,
        padding:'4px 8px', borderRadius:3, border:'none',
        background: colors.primary, color:'#fff',
        fontSize:11.5, fontWeight:500, cursor:'pointer', fontFamily:'inherit',
      }}>
        + Ajouter
        <span style={{ background:'#F59800', color:'#fff', borderRadius:3, padding:'0 4px', fontSize:9, fontWeight:700 }}>
          new
        </span>
        <span style={{ fontSize:9 }}>▾</span>
      </button>

      {divider}

      {/* Status tabs */}
      {statuses.map(({ key, label, count }) => (
        <button
          key={key}
          onClick={() => onStatusClick?.(key)}
          style={{
            display:'flex', alignItems:'center', gap:4,
            padding:'4px 8px', borderRadius:3, border:'none',
            background:'transparent', color:colors.textMd,
            fontSize:11.5, cursor:'pointer', whiteSpace:'nowrap',
            fontFamily:'inherit',
          }}>
          {label} {badge(count)}
        </button>
      ))}

      {divider}

      {/* Action icons */}
      {iconBtn(<b>$</b>,  '#28a745', 'Encaisser')}
      {iconBtn('↩',       '#F59800', 'Retour')}
      {iconBtn('✕',       '#dc3545', 'Annuler')}
      {iconBtn('🗑',      '#999',    'Supprimer')}

      <button style={{
        background:'#2196F3', color:'#fff', borderRadius:4,
        padding:'3px 9px', fontSize:11.5, fontWeight:500,
        cursor:'pointer', border:'none', fontFamily:'inherit',
        display:'flex', alignItems:'center', gap:3,
      }}>
        ✈ SAV ▾
      </button>

      {divider}
      {iconBtn('🔍', '#666', 'Rechercher')}
    </div>
  );
}
