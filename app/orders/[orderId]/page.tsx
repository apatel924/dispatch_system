import { Suspense } from 'react'
import { OrderDetailPage } from '@/components/dash/pages/order-detail-page'
import { AdminAuthGuard } from '@/components/dash/auth/auth-guard'
import { OrderDetailSkeleton } from '@/components/dash/ui/skeletons'
import { DashboardLayout } from '@/components/dash/layout/dashboard-layout'

export default async function Page({
  params,
}: {
  params: Promise<{ orderId: string }>
}) {
  const { orderId } = await params
  return (
    <AdminAuthGuard>
      <Suspense
        fallback={
          <DashboardLayout title="Orders">
            <OrderDetailSkeleton />
          </DashboardLayout>
        }
      >
        <OrderDetailPage orderId={orderId} />
      </Suspense>
    </AdminAuthGuard>
  )
}
