import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";
import { parseParkingSave } from "./lib/parkingState";

export const load = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return null;
    const save = await ctx.db
      .query("parkingSaves")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    return save?.snapshot ?? null;
  },
});

export const save = mutation({
  args: { snapshot: v.string() },
  handler: async (ctx, { snapshot }) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user)
      throw new ConvexError(
        "Une connexion est nécessaire pour sauvegarder en ligne.",
      );
    const state = parseParkingSave(snapshot);
    if (!state)
      throw new ConvexError("Cette sauvegarde de parking est invalide.");
    const existing = await ctx.db
      .query("parkingSaves")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (existing && existing.updatedAt > state.savedAt) return;
    const data = {
      userId: user._id,
      snapshot: JSON.stringify(state),
      updatedAt: state.savedAt,
    };
    if (existing) await ctx.db.patch(existing._id, data);
    else await ctx.db.insert("parkingSaves", data);
  },
});
