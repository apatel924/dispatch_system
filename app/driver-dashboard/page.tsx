import { DriverDashboard } from '@/components/dash/pages/driver-dashboard-page'
import { DriverAuthGuard } from '@/components/dash/auth/auth-guard'

export default function Page() {
  return (
    <DriverAuthGuard>
      <DriverDashboard />
    </DriverAuthGuard>
  )
}
