import { GridEditor } from "@/components/grid-editor";

export default function NewGridPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-3xl font-bold">New price grid</h1>
      <GridEditor />
    </div>
  );
}
