import { SupplierForm } from "@/components/supplier-form";

export default function NewSupplierPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">New supplier</h1>
      <SupplierForm />
    </div>
  );
}
