import type { Metadata } from "next";
import "../marketing-theme.css";

export const metadata: Metadata = {
  title: "Track Your Delivery | Quick Run Express",
  description: "Track your Quick Run Express delivery in real time.",
};

export default function TrackLayout({ children }: { children: React.ReactNode }) {
  return <div className="marketing-theme min-h-screen">{children}</div>;
}
