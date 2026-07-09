import { LiveIntakePage } from '@/components/dash/pages/live-intake-page'
import { AdminAuthGuard } from '@/components/dash/auth/auth-guard'

export default function Page() {
  return (
    <AdminAuthGuard>
      <LiveIntakePage />
    </AdminAuthGuard>
  )
}
