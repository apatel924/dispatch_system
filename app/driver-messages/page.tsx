import { DriverMessagesPage } from '@/components/dash/pages/driver-messages-page'
import { DriverAuthGuard } from '@/components/dash/auth/auth-guard'

export default function Page() {
  return (
    <DriverAuthGuard>
      <DriverMessagesPage />
    </DriverAuthGuard>
  )
}
