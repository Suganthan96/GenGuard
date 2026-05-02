import { DashboardShell } from "@/components/dashboard-shell"

export default function HomeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <DashboardShell>{children}</DashboardShell>
}
