/**
 * Create (or update) the admin staff login.
 *
 *   ADMIN_EMAIL=you@shop.com ADMIN_PASSWORD='choose-a-strong-one' \
 *     npm run create-admin
 *
 * The operator supplies the password — it is hashed with scrypt and only the
 * hash is stored. Re-running with the same email resets that user's password.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/auth/password";

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
const name = process.env.ADMIN_NAME?.trim() || null;

if (!email || !password) {
  console.error(
    "Set ADMIN_EMAIL and ADMIN_PASSWORD, e.g.\n" +
      "  ADMIN_EMAIL=you@shop.com ADMIN_PASSWORD='strong-pass' npm run create-admin",
  );
  process.exit(1);
}

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  const passwordHash = await hashPassword(password!);
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, name, role: "ADMIN" },
    create: { email: email!, passwordHash, name, role: "ADMIN" },
  });
  await prisma.$disconnect();

  console.log(`Admin ready: ${user.email}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
