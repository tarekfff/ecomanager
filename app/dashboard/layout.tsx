import { BoutiqueProvider } from '@/contexts/BoutiqueContext'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <BoutiqueProvider>{children}</BoutiqueProvider>
}
