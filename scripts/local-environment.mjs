import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const target = resolve(".env.local");
const contents = [
  "# Local development only. Do not commit this file or copy its secret into docs.",
  "NEXTAUTH_URL=http://localhost:3000",
  `NEXTAUTH_SECRET=${randomBytes(32).toString("hex")}`,
  "NEXT_PUBLIC_APP_URL=http://localhost:3000",
  "",
].join("\n");

try {
  await writeFile(target, contents, { flag: "wx", mode: 0o600 });
  console.log("Created ignored local development settings with a random secret. Secret value was not printed.");
} catch (error) {
  if (error.code === "EEXIST") {
    console.log("Preserved the existing .env.local file.");
  } else {
    throw error;
  }
}
