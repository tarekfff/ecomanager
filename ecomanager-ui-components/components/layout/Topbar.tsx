// components/layout/Topbar.tsx
'use client';
import { colors, spacing } from '@/lib/tokens';

interface TopbarProps {
  username?: string;
  onLogout?: () => void;
}

export default function Topbar({ username = 'mimi', onLogout }: TopbarProps) {
  return (
    <header style={{
      height: spacing.topbarH,
      background: colors.primary,
      display: 'flex', alignItems: 'center',
      padding: '0 12px', flexShrink: 0, gap: 0,
      fontFamily: "'Inter', sans-serif",
    }}>
      {/* Logo */}
      <div style={{ display:'flex', alignItems:'center', marginRight:'auto', gap:2 }}>
        <span style={{
          display:'inline-block', width:6, height:13,
          border:'2px solid #fff', borderRight:'none',
          borderRadius:'2px 0 0 2px', marginRight:2,
        }}/>
        <span style={{ fontSize:15, fontWeight:700, color:'#fff', letterSpacing:'-0.3px' }}>
          COMANAGER
        </span>
      </div>

      {/* Right actions */}
      <div style={{ display:'flex', alignItems:'center', gap:14 }}>
        {[
          { icon:'🌐', label:'' },
          { icon:'✈', label:'Feedback' },
          { icon:'🔔', label:'Mises à jour' },
          { icon:'📖', label:'Tutoriels' },
        ].map(({ icon, label }) => (
          <span key={label || icon} style={{
            fontSize:11, color:'rgba(255,255,255,.88)',
            cursor:'pointer', display:'flex', alignItems:'center', gap:3,
          }}>
            {icon} {label}
          </span>
        ))}
        <div
          onClick={onLogout}
          style={{
            display:'flex', alignItems:'center', gap:5,
            background:'rgba(255,255,255,.18)', borderRadius:14,
            padding:'3px 10px 3px 7px', fontSize:11,
            color:'#fff', cursor:'pointer',
          }}>
          👤 {username}
        </div>
      </div>
    </header>
  );
}
