import { assertOk, handle } from "@/lib/api/http";
import { requireUser } from "@/lib/api/session";
import { createClient } from "@/lib/supabase/server";
import { parsePurchaseCreate } from "@/lib/api/schemas";
import { jsonBody } from "@/lib/api/validate";
import { rowToPurchase, type PurchaseRow } from "@/lib/api/mappers";

export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("purchases")
      .select("*")
      .eq("user_id", user.id)
      .order("purchased_at", { ascending: false });

    assertOk(error, "Couldn't load your purchases.");
    return { purchases: ((data ?? []) as PurchaseRow[]).map(rowToPurchase) };
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    const input = parsePurchaseCreate(await jsonBody(request));
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("purchases")
      .upsert(
        {
          id: input.id,
          user_id: user.id,
          purchased_at: new Date(input.ts).toISOString(),
          category: input.category,
          name: input.name,
          cost: input.cost,
          quantity: input.quantity,
          units_per_item: input.unitsPerItem,
          note: input.note,
        },
        { onConflict: "id" },
      )
      .select()
      .single();

    assertOk(error, "Couldn't save that purchase.");
    return { purchase: rowToPurchase(data as PurchaseRow) };
  });
}
