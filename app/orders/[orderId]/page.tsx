import { OrderDetailPage } from '@/components/dash/pages/order-detail-page'

export default async function Page({
  params,
}: {
  params: Promise<{ orderId: string }>
}) {
  const { orderId } = await params
  return <OrderDetailPage orderId={orderId} />
}
