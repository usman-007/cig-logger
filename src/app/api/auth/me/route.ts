import { getUser } from "@/lib/api/session";
import { handle } from "@/lib/api/http";

/** Cheap "am I signed in?" probe. Returns `{ user: null }` rather than a 401. */
export async function GET() {
  return handle(async () => {
    const user = await getUser();
    return {
      user: user ? { id: user.id, email: user.email } : null,
    };
  });
}
