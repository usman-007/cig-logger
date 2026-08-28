import { handle } from "@/lib/api/http";
import { getUser } from "@/lib/api/session";
import { loadAppData } from "@/lib/api/queries";

/**
 * Everything the client store needs, in one round trip: profile, settings,
 * logs and purchases. Mirrors the single localStorage read that AshStore.hydrate()
 * used to do, so the store keeps its shape.
 *
 * Answers 200 with `user: null` for a signed-out visitor rather than 401 —
 * "not signed in" is a normal state here, not an error.
 */
export async function GET() {
  return handle(async () => {
    const user = await getUser();
    if (!user) return { user: null, data: null };

    const { profile, ...data } = await loadAppData(user.id);

    return {
      user: {
        id: user.id,
        email: profile.email || user.email || "",
        name: profile.name,
      },
      data,
    };
  });
}
