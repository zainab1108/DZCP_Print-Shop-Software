import { notFound } from "next/navigation";

import { SupplierForm } from "@/components/supplier-form";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function EditSupplierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supplier = await prisma.supplier.findUnique({ where: { id } });
  if (!supplier) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold">Edit {supplier.name}</h1>
      <SupplierForm
        supplierId={supplier.id}
        initial={{
          name: supplier.name,
          email: supplier.email ?? "",
          phone: supplier.phone ?? "",
          website: supplier.website ?? "",
          account: supplier.account ?? "",
          notes: supplier.notes ?? "",
        }}
      />
    </div>
  );
}
