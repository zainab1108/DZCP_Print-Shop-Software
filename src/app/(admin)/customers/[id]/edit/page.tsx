import { notFound } from "next/navigation";

import { CustomerForm, type AddressValues } from "@/components/customer-form";
import { prisma } from "@/lib/prisma";
import type { Address } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

function toAddressValues(address: Address | undefined): AddressValues {
  return {
    line1: address?.line1 ?? "",
    line2: address?.line2 ?? "",
    city: address?.city ?? "",
    state: address?.state ?? "",
    postalCode: address?.postalCode ?? "",
    country: address?.country ?? "US",
  };
}

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: { addresses: true },
  });
  if (!customer) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Edit {customer.name}</h1>
      <CustomerForm
        customerId={id}
        initial={{
          name: customer.name,
          email: customer.email ?? "",
          phone: customer.phone ?? "",
          website: customer.website ?? "",
          taxExempt: customer.taxExempt,
          notes: customer.notes ?? "",
          billingAddress: toAddressValues(
            customer.addresses.find((a) => a.type === "BILLING"),
          ),
          shippingAddress: toAddressValues(
            customer.addresses.find((a) => a.type === "SHIPPING"),
          ),
        }}
      />
    </div>
  );
}
