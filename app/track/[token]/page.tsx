import { ConsumerTrackingPage } from "@/components/consumer/consumer-tracking-page";

export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <ConsumerTrackingPage token={token} />;
}
