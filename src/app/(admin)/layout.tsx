import { SiteNav } from "@/components/site-nav";
import { getCurrentUser } from "@/lib/auth/current-user";

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // The proxy already guarantees a valid session here; this is for display.
  const user = await getCurrentUser();

  return (
    <>
      <SiteNav userEmail={user?.email} />
      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {children}
      </div>
    </>
  );
}
