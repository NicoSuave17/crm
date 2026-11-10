import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { adminRoleConfig } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export default async function Home() {
  const user = await getCurrentUser();

  if (user) {
    try {
      const [config] = await db
        .select()
        .from(adminRoleConfig)
        .where(eq(adminRoleConfig.role, user.role))
        .limit(1);

      if (config?.landingPage) {
        redirect(config.landingPage);
      }
    } catch {
      // Table may not exist yet — fall through to default redirect
    }
  }

  redirect("/dashboard");
}
