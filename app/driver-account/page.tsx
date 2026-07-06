import { DriverAccountPage } from '@/components/dash/pages/driver-account-page'
import { DriverAuthGuard } from '@/components/dash/auth/auth-guard'

export default function Page() {
  return (
    <DriverAuthGuard>
      <DriverAccountPage />
    </DriverAuthGuard>
  )
}
