import { DriverOrdersList } from '@/components/dash/pages/driver-orders-list-page'
import { DriverAuthGuard } from '@/components/dash/auth/auth-guard'

export default function Page() {
  return (
    <DriverAuthGuard>
      <DriverOrdersList />
    </DriverAuthGuard>
  )
}
