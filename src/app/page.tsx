import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { prisma } from "@/lib/prisma";

// Always check the database at request time, never at build time.
export const dynamic = "force-dynamic";

async function checkDatabase(): Promise<{ ok: boolean; detail: string }> {
  try {
    const [row] = await prisma.$queryRaw<
      [{ version: string }]
    >`SELECT version()`;
    return { ok: true, detail: row.version };
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

export default async function Home() {
  const db = await checkDatabase();

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-8 dark:bg-zinc-950">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Print Shop Manager</CardTitle>
          <CardDescription>System health check</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Next.js app</span>
            <Badge>Running</Badge>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium">Database</span>
            <Badge variant={db.ok ? "default" : "destructive"}>
              {db.ok ? "Connected" : "Unreachable"}
            </Badge>
          </div>
          <p className="text-muted-foreground text-xs break-words">
            {db.detail}
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
