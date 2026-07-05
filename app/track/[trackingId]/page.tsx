import { TrackPage } from '@/components/dash/pages/track-page'

export default async function Page({
  params,
}: {
  params: Promise<{ trackingId: string }>
}) {
  const { trackingId } = await params
  return <TrackPage trackingId={trackingId} />
}
