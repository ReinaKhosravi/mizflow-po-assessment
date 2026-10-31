import { AppShell } from "@/components/app-shell";
import { requireContext } from "@/features/auth/context";
export const dynamic = "force-dynamic";
export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { restaurantName, branchName, membership, panelRole } =
    await requireContext();
  return (
    <AppShell
      restaurantName={restaurantName}
      branchName={branchName}
      role={panelRole}
      canSwitchPanel={membership.role === "owner"}
    >
      {children}
    </AppShell>
  );
}
