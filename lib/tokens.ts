// ─── ECOMANAGER Design Tokens ───────────────────────────────
// Use these everywhere — never hardcode colors in components

export const colors = {
  primary:    '#BF4C98',  // brand purple-pink — topbar, buttons, active states
  primaryDk:  '#A03A80',  // hover/pressed
  primaryLt:  '#F5E0EF',  // badges, active sidebar bg, hover bg
  bg:         '#FFF7F2',  // main background
  sidebar:    '#FFFFFF',  // sidebar + topbar-card white
  border:     '#E2D8E2',
  text:       '#2D2D2D',
  textMd:     '#555555',
  textLt:     '#999999',
  chartBlue:  '#4472C4',
  chartOrange:'#F5A623',
  donut: {
    enConfirmation: '#4472C4',
    enPreparation:  '#9966CC',
    enDispatch:     '#E6B800',
    enLivraison:    '#888888',
    livrees:        '#00B0A0',
    enRetour:       '#E84B6A',
  },
  green:   '#28a745',
  red:     '#dc3545',
  orange:  '#F59800',
  blue:    '#2196F3',
} as const

export const fonts = {
  sans: "'Inter', sans-serif",
} as const

export const spacing = {
  topbarH:    42,   // px
  statusbarH: 36,   // px
  sidebarW:   210,  // px
} as const
