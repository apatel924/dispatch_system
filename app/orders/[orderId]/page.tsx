import { OrderDetailPage } from '@/components/dash/pages/order-detail-page'
import { AdminAuthGuard } from '@/components/dash/auth/auth-guard'

export default async function Page({
  params,
}: {
  params: Promise<{ orderId: string }>
}) {
  const { orderId } = await params
  return (
    <AdminAuthGuard>
      <OrderDetailPage orderId={orderId} />
    </AdminAuthGuard>
  )
}
