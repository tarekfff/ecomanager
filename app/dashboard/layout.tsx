import { BoutiqueProvider } from '@/contexts/BoutiqueContext'
import DashboardShell from '@/components/layout/DashboardShell'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <BoutiqueProvider>
      <DashboardShell>{children}</DashboardShell>
    </BoutiqueProvider>
  )
}
