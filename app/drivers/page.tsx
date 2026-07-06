import { DriversPage } from '@/components/dash/pages/drivers-page'
import { AdminAuthGuard } from '@/components/dash/auth/auth-guard'

export default function Page() {
  return (
    <AdminAuthGuard>
      <DriversPage />
    </AdminAuthGuard>
  )
}
