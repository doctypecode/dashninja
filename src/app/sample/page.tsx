import type { Metadata } from "next";
import { SampleViewer } from "@/components/marketing/sample-viewer";

export const metadata: Metadata = { title: "Sample dashboard", description: "An interactive DashNinja dashboard built from synthetic sales data." };

export default function SamplePage() {
  return <SampleViewer />;
}
