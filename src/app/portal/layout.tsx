export default function PortalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <header className="border-b bg-white dark:bg-zinc-900">
        <div className="mx-auto flex h-14 max-w-4xl items-center px-4">
          <span className="font-semibold">Print Shop — Customer Portal</span>
        </div>
      </header>
      <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
        {children}
      </div>
    </>
  );
}
