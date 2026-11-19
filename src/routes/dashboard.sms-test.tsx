import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/dashboard/ProtectedRoute";
import SmsTestPage from "@/views/dashboard/SmsTest";

export const Route = createFileRoute("/dashboard/sms-test")({
  head: () => ({
    meta: [
      { title: "SMS Test | Green Medical Diagnostics" },
      { name: "description", content: "Green Medical Diagnostics staff area." },
      { property: "og:title", content: "SMS Test | Green Medical Diagnostics" },
      { property: "og:description", content: "Green Medical Diagnostics staff area." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <ProtectedRoute>
      <SmsTestPage />
    </ProtectedRoute>
  ),
});
