import Image from "next/image";

import { LoginForm } from "@/components/login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--brand-charcoal)] p-8">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <Image
            src="/logo.png"
            alt="DZ Custom Products"
            width={88}
            height={88}
            className="mx-auto mb-4 rounded-full"
            priority
          />
          <h1 className="text-2xl font-bold text-white">DZ Custom Products</h1>
          <p className="text-white/60">Sign in to continue</p>
        </div>
        <LoginForm next={next ?? "/"} />
      </div>
    </main>
  );
}
