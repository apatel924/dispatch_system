import { ReportsPage } from '@/components/dash/pages/reports-page'
import { AdminAuthGuard } from '@/components/dash/auth/auth-guard'

export default function Page() {
  return (
    <AdminAuthGuard>
      <ReportsPage />
    </AdminAuthGuard>
  )
}
