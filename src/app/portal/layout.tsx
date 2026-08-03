import Image from "next/image";

export default function PortalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <header className="bg-[var(--brand-charcoal)] text-white">
        <div className="mx-auto flex h-16 max-w-4xl items-center gap-3 px-4">
          <Image
            src="/logo.png"
            alt="DZ Custom Products"
            width={40}
            height={40}
            className="rounded-full"
            priority
          />
          <span className="text-lg font-semibold">
            DZ Custom Products
            <span className="font-normal text-white/60">
              {" "}
              · Customer Portal
            </span>
          </span>
        </div>
      </header>
      <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
        {children}
      </div>
    </>
  );
}
