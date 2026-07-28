import { LoginForm } from "@/components/login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-xl font-semibold">Print Shop Manager</h1>
          <p className="text-muted-foreground text-sm">Sign in to continue</p>
        </div>
        <LoginForm next={next ?? "/"} />
      </div>
    </main>
  );
}
