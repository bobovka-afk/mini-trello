import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx nest build && node dist/src/scripts/seed-words.js",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});