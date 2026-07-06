import { OrdersPage } from '@/components/dash/pages/orders-page'
import { AdminAuthGuard } from '@/components/dash/auth/auth-guard'

export default function Page() {
  return (
    <AdminAuthGuard>
      <OrdersPage />
    </AdminAuthGuard>
  )
}
