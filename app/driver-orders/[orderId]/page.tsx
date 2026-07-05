import { DriverOrderDetail } from '@/components/dash/pages/driver-order-detail-page'

export default async function Page({
  params,
}: {
  params: Promise<{ orderId: string }>
}) {
  const { orderId } = await params
  return <DriverOrderDetail orderId={orderId} />
}
