import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { MobileNav, Sidebar } from "@/components/layout/nav";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/login");

  return (
    <div className="flex h-dvh flex-col md:flex-row">
      <Sidebar email={user.email ?? ""} />
      <MobileNav />
      <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
