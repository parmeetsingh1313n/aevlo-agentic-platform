import type { User } from "next-auth";
import { db, users } from "@/db";

/** One application profile per email, even when OAuth callbacks overlap. */
export async function saveOAuthUser(
  user: Pick<User, "name"> & { email: string },
  database: Pick<typeof db, "insert"> = db,
) {
  const email = user.email.trim().toLowerCase();
  const name = user.name?.trim() || null;

  await database
    .insert(users)
    .values({ email, name })
    .onConflictDoUpdate({
      target: users.email,
      // A provider without a display name must not erase an existing name.
      set: name === null ? { email } : { name },
    });
}
