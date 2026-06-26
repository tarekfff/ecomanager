// components/dashboard/DashboardCharts.tsx
'use client';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { colors } from '@/lib/tokens';

const DAYS = ['19-Jun','20-Jun','21-Jun','22-Jun','23-Jun','24-Jun','25-Jun'];

const chartData = DAYS.map((day, i) => ({
  day,
  Créées:      [4,1,0,2,0,0,0][i],
  Confirmées:  [0,3,2,2,0,2,0][i],
  Annulées:    [0,2,2,2,0,0,0][i],
  Livrées:     [0,1,1,0,2,0,1][i],
  'En retour': [0,1,0,1,0,0,0][i],
  Encaissées:  [0,0,0,0,0,1,0][i],
  Retournées:  [0,0,0,0,0,0,0][i],
}));

const donutData = [
  { name:'En confirmation', value:7,  color:'#4472C4' },
  { name:'En préparation',  value:1,  color:'#9966CC' },
  { name:'En dispatch',     value:1,  color:'#E6B800' },
  { name:'En livraison',    value:3,  color:'#888888' },
  { name:'Livrées',         value:12, color:'#00B0A0' },
  { name:'En retour',       value:7,  color:'#E84B6A' },
];

// Shared axis config
const axisProps = {
  tick: { fontSize: 9, fill: '#888', fontFamily: 'Inter' },
  tickLine: false,
  axisLine: false,
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background:'rgba(0,0,0,.75)', color:'#fff',
      borderRadius:4, padding:'5px 9px', fontSize:11,
    }}>
      <div style={{ marginBottom:2, fontWeight:500 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.name}>{p.name}: <b>{p.value}</b></div>
      ))}
    </div>
  );
};

function MiniBarChart({ keys }: { keys: { dataKey:string; color:string }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top:2, right:4, left:-28, bottom:0 }} barSize={7}>
        <CartesianGrid strokeDasharray="2 2" stroke="#f0f0f0" vertical={false} />
        <XAxis dataKey="day" {...axisProps} />
        <YAxis {...axisProps} allowDecimals={false} />
        <Tooltip content={<CustomTooltip />} />
        {keys.map(({ dataKey, color }) => (
          <Bar key={dataKey} dataKey={dataKey} fill={color} radius={[2,2,0,0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

// Panel wrapper
function ChartPanel({ header, dark, children }: {
  header: string; dark?: boolean; children: React.ReactNode;
}) {
  return (
    <div style={{
      background:'#fff', border:`1px solid ${colors.border}`,
      borderRadius:4, display:'flex', flexDirection:'column',
      overflow:'hidden', minHeight:0, flex:1,
    }}>
      <div style={{
        background: dark ? '#5a5a5a' : '#efefef',
        color: dark ? '#fff' : colors.text,
        borderBottom: dark ? 'none' : `1px solid ${colors.border}`,
        fontSize:13, fontWeight:500, padding:'7px 12px',
        textAlign:'center', flexShrink:0,
      }}>
        {header}
      </div>
      {children}
    </div>
  );
}

// Mini chart row inside a panel
function MiniRow({ title, keys }: {
  title: string; keys: { dataKey:string; color:string }[];
}) {
  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', minHeight:0 }}>
      <div style={{ fontSize:10, color:colors.textMd, textAlign:'center', flexShrink:0, marginBottom:2 }}>
        {title}
        {keys.map(k => (
          <span key={k.dataKey} style={{ marginLeft:6 }}>
            <span style={{ color:k.color }}>■</span>{' '}{k.dataKey}
          </span>
        ))}
      </div>
      <div style={{ flex:1, minHeight:0 }}>
        <MiniBarChart keys={keys} />
      </div>
    </div>
  );
}

export default function DashboardCharts() {
  return (
    <div style={{
      display:'grid', gridTemplateColumns:'1fr 1fr 1fr',
      gap:10, flex:1, minHeight:0, fontFamily:"'Inter',sans-serif",
    }}>

      {/* ── COL 1: Performance ── */}
      <ChartPanel header="Performance" dark>
        <div style={{ flex:1, display:'flex', flexDirection:'column', padding:'8px 6px 6px', gap:6, minHeight:0 }}>
          <MiniRow title="Commandes créés" keys={[{ dataKey:'Créées', color:colors.chartBlue }]} />
          <MiniRow title="Livrées / En retour" keys={[
            { dataKey:'Livrées',     color:colors.chartBlue },
            { dataKey:'En retour',   color:colors.chartOrange },
          ]} />
        </div>
      </ChartPanel>

      {/* ── COL 2: Analyse ── */}
      <ChartPanel header="Analyse">
        <div style={{ flex:1, display:'flex', flexDirection:'column', padding:'8px 6px 6px', gap:6, minHeight:0 }}>
          <MiniRow title="Confirmées / Annulées" keys={[
            { dataKey:'Confirmées', color:colors.chartBlue },
            { dataKey:'Annulées',   color:colors.chartOrange },
          ]} />
          <MiniRow title="Encaissées / Retournées" keys={[
            { dataKey:'Encaissées',  color:colors.chartBlue },
            { dataKey:'Retournées',  color:colors.chartOrange },
          ]} />
        </div>
      </ChartPanel>

      {/* ── COL 3: Anomalie (Donut) ── */}
      <ChartPanel header="Anomalie">
        <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:8, minHeight:0 }}>
          {/* Donut */}
          <div style={{ flex:1, width:'100%', minHeight:0, maxHeight:240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutData} dataKey="value"
                  cx="50%" cy="50%"
                  innerRadius="52%" outerRadius="80%"
                  paddingAngle={2}
                >
                  {donutData.map(entry => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={({ active, payload }) =>
                  active && payload?.length ? (
                    <div style={{ background:'rgba(0,0,0,.75)', color:'#fff', borderRadius:4, padding:'5px 9px', fontSize:11 }}>
                      {payload[0].name}: <b>{payload[0].value}</b>
                    </div>
                  ) : null
                } />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {/* Legend */}
          <div style={{ display:'flex', flexWrap:'wrap', gap:'5px 12px', justifyContent:'center', padding:'6px 10px 8px' }}>
            {donutData.map(d => (
              <div key={d.name} style={{ display:'flex', alignItems:'center', gap:4, fontSize:10.5, color:colors.textMd }}>
                <div style={{ width:10, height:10, borderRadius:2, background:d.color, flexShrink:0 }} />
                {d.name}
              </div>
            ))}
          </div>
        </div>
      </ChartPanel>

    </div>
  );
}
