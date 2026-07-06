import { CreateOrderPage } from '@/components/dash/pages/create-order-page'
import { AdminAuthGuard } from '@/components/dash/auth/auth-guard'

export default function Page() {
  return (
    <AdminAuthGuard>
      <CreateOrderPage />
    </AdminAuthGuard>
  )
}
