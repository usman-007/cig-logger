import { handle } from "@/lib/api/http";
import { requireUser } from "@/lib/api/session";
import { loadAppData } from "@/lib/api/queries";

/** Same JSON shape the Settings page has always downloaded. */
export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    const { profile, ...data } = await loadAppData(user.id);

    return {
      version: 1,
      exportedAt: Date.now(),
      email: profile.email,
      ...data,
    };
  });
}
