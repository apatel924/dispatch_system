import { DriverProfilePage } from '@/components/dash/pages/driver-profile-page'
import { AdminAuthGuard } from '@/components/dash/auth/auth-guard'

export default async function Page({
  params,
}: {
  params: Promise<{ driverId: string }>
}) {
  const { driverId } = await params
  return (
    <AdminAuthGuard>
      <DriverProfilePage driverId={driverId} />
    </AdminAuthGuard>
  )
}
