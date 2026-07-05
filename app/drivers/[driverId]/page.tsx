import { DriverProfilePage } from '@/components/dash/pages/driver-profile-page'

export default async function Page({
  params,
}: {
  params: Promise<{ driverId: string }>
}) {
  const { driverId } = await params
  return <DriverProfilePage driverId={driverId} />
}
