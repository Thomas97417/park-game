import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  parkingSaves: defineTable({
    userId: v.string(),
    snapshot: v.string(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),
});
