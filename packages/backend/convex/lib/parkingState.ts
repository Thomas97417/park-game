import { z } from "zod";

export const COLS = 30;
export const ROWS = 22;
export const SAVE_VERSION = 1;

export const tileKinds = [
  "grass",
  "road",
  "parking",
  "crossing",
  "entry",
  "gate",
  "roundabout",
  "tree",
  "path",
  "store",
] as const;
export const tileSchema = z.object({
  kind: z.enum(tileKinds),
  rotation: z.number().int().min(0).max(3),
  fixed: z.boolean().optional(),
  group: z.string().max(40).optional(),
});
export const pointSchema = z.object({
  x: z
    .number()
    .int()
    .min(0)
    .max(COLS - 1),
  y: z
    .number()
    .int()
    .min(0)
    .max(ROWS - 1),
});
export const carSchema = z.object({
  id: z.number().int().nonnegative(),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  spot: pointSchema,
  path: z.array(pointSchema).max(COLS * ROWS),
  progress: z.number().finite().nonnegative(),
  phase: z.enum(["arriving", "shopping", "leaving"]),
  wait: z.number().finite().nonnegative(),
  shoppingTime: z.number().finite().positive(),
  paid: z.boolean(),
  fee: z.number().finite().min(0).max(100),
});

export const parkingStateSchema = z.object({
  version: z.literal(SAVE_VERSION),
  savedAt: z.number().finite().nonnegative(),
  level: z.number().int().min(0).max(2),
  unlocked: z.number().int().min(0).max(2),
  grid: z.array(z.array(tileSchema).length(COLS)).length(ROWS),
  cars: z.array(carSchema).max(120),
  balance: z.number().finite().min(-1_000_000).max(100_000_000),
  income: z.number().finite().nonnegative(),
  expenses: z.number().finite().min(-1_000_000),
  served: z.number().int().nonnegative(),
  missed: z.number().int().nonnegative(),
  happiness: z.number().finite().min(0).max(100),
  elapsed: z.number().finite().nonnegative(),
  spawnTimer: z.number().finite().nonnegative(),
  upkeepTimer: z.number().finite().nonnegative(),
  price: z.number().finite().min(1).max(8),
  nextCarId: z.number().int().nonnegative(),
  debtTime: z.number().finite().nonnegative(),
  unhappyTime: z.number().finite().nonnegative(),
  status: z.enum(["playing", "lost"]),
  lossReason: z.string().max(200).optional(),
  completed: z.boolean(),
});

export type Tile = z.infer<typeof tileSchema>;
export type TileKind = Tile["kind"];
export type Point = z.infer<typeof pointSchema>;
export type Car = z.infer<typeof carSchema>;
export type ParkingState = z.infer<typeof parkingStateSchema>;

export function parseParkingSave(value: string): ParkingState | null {
  try {
    if (value.length > 250_000) return null;
    const result = parkingStateSchema.safeParse(JSON.parse(value));
    if (!result.success) return null;
    const state = result.data;
    if (
      state.cars.some(
        (car) => car.path.length === 0 || car.progress > car.path.length - 1,
      )
    )
      return null;
    if (new Set(state.cars.map((car) => car.id)).size !== state.cars.length)
      return null;
    if (
      state.cars.some((car) => car.id >= state.nextCarId) ||
      state.level > state.unlocked
    )
      return null;
    return state;
  } catch {
    return null;
  }
}
