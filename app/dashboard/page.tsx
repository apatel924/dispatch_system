import { DashboardPage } from '@/components/dash/pages/dashboard-page'
import { AdminAuthGuard } from '@/components/dash/auth/auth-guard'

export default function Page() {
  return (
    <AdminAuthGuard>
      <DashboardPage />
    </AdminAuthGuard>
  )
}
