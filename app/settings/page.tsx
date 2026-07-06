import { SettingsPage } from '@/components/dash/pages/settings-page'
import { AdminAuthGuard } from '@/components/dash/auth/auth-guard'

export default function Page() {
  return (
    <AdminAuthGuard>
      <SettingsPage />
    </AdminAuthGuard>
  )
}
