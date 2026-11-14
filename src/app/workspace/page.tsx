import type { Metadata } from "next";
import { DashboardList } from "@/components/workspace/dashboard-list";

export const metadata: Metadata = { title: "Your dashboards" };

export default function WorkspacePage() {
  return <DashboardList />;
}
