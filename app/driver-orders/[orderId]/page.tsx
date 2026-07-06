import { DriverOrderDetail } from '@/components/dash/pages/driver-order-detail-page'
import { DriverAuthGuard } from '@/components/dash/auth/auth-guard'

export default async function Page({
  params,
}: {
  params: Promise<{ orderId: string }>
}) {
  const { orderId } = await params
  return (
    <DriverAuthGuard>
      <DriverOrderDetail orderId={orderId} />
    </DriverAuthGuard>
  )
}
