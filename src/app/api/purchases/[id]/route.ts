import type { NextRequest } from "next/server";
import { ApiError, assertOk, handle } from "@/lib/api/http";
import { requireUser } from "@/lib/api/session";
import { createClient } from "@/lib/supabase/server";
import { parsePurchasePatch } from "@/lib/api/schemas";
import { jsonBody, uuid } from "@/lib/api/validate";
import { rowToPurchase, type PurchaseRow } from "@/lib/api/mappers";

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/purchases/[id]">,
) {
  return handle(async () => {
    const user = await requireUser();
    const id = uuid((await ctx.params).id, "id");
    const patch = parsePurchasePatch(await jsonBody(request));

    const update: Record<string, unknown> = {};
    if (patch.ts !== undefined)
      update.purchased_at = new Date(patch.ts).toISOString();
    if (patch.category !== undefined) update.category = patch.category;
    if (patch.name !== undefined) update.name = patch.name;
    if (patch.cost !== undefined) update.cost = patch.cost;
    if (patch.quantity !== undefined) update.quantity = patch.quantity;
    if (patch.unitsPerItem !== undefined)
      update.units_per_item = patch.unitsPerItem;
    if (patch.note !== undefined) update.note = patch.note;

    if (Object.keys(update).length === 0)
      throw new ApiError("Nothing to update.");

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("purchases")
      .update(update)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .maybeSingle();

    assertOk(error, "Couldn't update that purchase.");
    if (!data) throw new ApiError("That purchase no longer exists.", 404);

    return { purchase: rowToPurchase(data as PurchaseRow) };
  });
}

export async function DELETE(
  _request: NextRequest,
  ctx: RouteContext<"/api/purchases/[id]">,
) {
  return handle(async () => {
    const user = await requireUser();
    const id = uuid((await ctx.params).id, "id");

    const supabase = await createClient();
    const { error } = await supabase
      .from("purchases")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    assertOk(error, "Couldn't delete that purchase.");
    return { ok: true };
  });
}
