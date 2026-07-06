import { DriverRoutePage } from '@/components/dash/pages/driver-route-page'
import { DriverAuthGuard } from '@/components/dash/auth/auth-guard'

export default function Page() {
  return (
    <DriverAuthGuard>
      <DriverRoutePage />
    </DriverAuthGuard>
  )
}
