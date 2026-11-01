import { describe, expect, test } from "bun:test";
import {
  build,
  claimContract,
  createGame,
  findPath,
  infrastructure,
  openParking,
  rotatePlaced,
  step,
  storeDoor,
  type ParkingState,
} from "../apps/web/src/game/engine";
import {
  COLS,
  ROWS,
  parseParkingSave,
} from "../packages/backend/convex/lib/parkingState";

function place(
  state: ParkingState,
  tool: Parameters<typeof build>[1],
  x: number,
  y: number,
  rotation = 0,
) {
  const result = build(state, tool, { x, y }, rotation);
  expect(result.error).toBeUndefined();
  return result.state;
}
function builtLot(level = 0, count = 24) {
  let state = createGame(level, level);
  for (let x = 4; x <= 36; x++) state = place(state, "road", x, 9);
  state = place(state, "road", 24, 8);
  state = place(state, "entry", 6, 9, 1);
  state = place(state, "gate", 8, 9, 1);
  state = place(state, "crossing", 24, 9);
  state = place(state, "crossing", 20, 9);
  for (let x = 10; x < 10 + Math.min(24, count); x++)
    state = place(state, "parking", x, 10);
  if (count > 24) {
    state = place(state, "road", 9, 10);
    for (let x = 9; x <= 36; x++) state = place(state, "road", x, 11);
    for (let x = 10; x < 10 + count - 24; x++)
      state = place(state, "parking", x, 12);
  }
  return state;
}
function simulate(seconds: number, state: ParkingState) {
  for (let i = 0; i < seconds * 4; i++) state = step(state, 0.25, () => 0.45);
  return state;
}

describe("empty construction site", () => {
  test("new games contain only the shop, its forecourt and protected public roads", () => {
    const state = createGame();
    expect(state.grid).toHaveLength(ROWS);
    expect(state.grid[0]).toHaveLength(COLS);
    expect(
      state.grid.flat().filter((tile) => !tile.fixed && tile.kind !== "grass"),
    ).toHaveLength(0);
    expect(state.cars).toHaveLength(0);
    expect(infrastructure(state.grid).usable).toHaveLength(0);
    expect(state.opened).toBe(false);
  });
  test("construction has no maintenance bills or unhappy clients before opening", () => {
    const state = createGame();
    expect(simulate(300, state)).toEqual(state);
    expect(openParking(state)).toBe(state);
  });
  test("the enlarged plot connects directly to the public road", () => {
    const state = place(createGame(), "road", 4, 9);
    expect(findPath(state.grid, { x: 3, y: 0 }, { x: 4, y: 9 })).not.toBeNull();
    expect(build(state, "erase", { x: 3, y: 9 }, 0).error).toBeDefined();
  });
});

describe("construction and selection", () => {
  test("tracing across existing roads preserves equipment and does not charge again", () => {
    const state = builtLot(0, 1);
    for (const point of [{ x: 3, y: 9 }, { x: 5, y: 9 }, { x: 6, y: 9 }, { x: 8, y: 9 }, { x: 24, y: 9 }]) {
      const result = build(state, "road", point, 0);
      expect(result.error).toBeUndefined();
      expect(result.state).toBe(state);
      expect(result.undo).toBeUndefined();
    }
  });
  test("bay rotation changes accessibility without charging money and is undoable", () => {
    const state = builtLot(0, 1);
    expect(infrastructure(state.grid).usable).toHaveLength(1);
    const result = rotatePlaced(state, { x: 10, y: 10 });
    expect(result.error).toBeUndefined();
    expect(result.state.grid[10]![10]!.rotation).toBe(1);
    expect(result.state.balance).toBe(state.balance);
    expect(infrastructure(result.state.grid).usable).toHaveLength(0);
    expect(result.undo?.grid).toBe(state.grid);
  });
  test("occupied bays and protected buildings cannot be rotated or deleted", () => {
    let state = builtLot(0, 1);
    state = {
      ...state,
      cars: [
        {
          id: 0,
          color: "#dc9a65",
          spot: { x: 10, y: 10 },
          path: [{ x: 10, y: 10 }],
          progress: 0,
          phase: "shopping",
          wait: 0,
          shoppingTime: 20,
          paid: false,
          fee: 3,
        },
      ],
      nextCarId: 1,
    };
    expect(rotatePlaced(state, { x: 10, y: 10 }).error).toBeDefined();
    expect(build(state, "erase", { x: 10, y: 10 }, 0).error).toBeDefined();
    expect(rotatePlaced(state, { x: 24, y: 3 }).error).toBeDefined();
  });
  test.each(["tree", "lamp", "bench", "flowers"] as const)(
    "roads clear %s props and undo restores the original prop",
    (kind) => {
      const decorated = place(createGame(), kind, 14, 14, 1);
      const result = build(decorated, "road", { x: 14, y: 14 }, 0);
      expect(result.error).toBeUndefined();
      expect(result.state.grid[14]![14]!.kind).toBe("road");
      expect(result.state.balance).toBe(decorated.balance - 35);
      expect(result.undo?.grid[14]![14]!.kind).toBe(kind);
      expect(result.undo?.grid[14]![14]!.rotation).toBe(1);
    },
  );
  test("lamp posts and benches can rotate after placement", () => {
    for (const kind of ["lamp", "bench"] as const) {
      const state = place(createGame(), kind, 14, 14);
      expect(
        rotatePlaced(state, { x: 14, y: 14 }).state.grid[14]![14]!.rotation,
      ).toBe(1);
    }
  });
  test("deleting a gate, entrance or crossing preserves its underlying road", () => {
    for (const kind of ["gate", "entry", "crossing"] as const) {
      let state = place(createGame(), "road", 14, 14);
      state = place(state, kind, 14, 14);
      expect(place(state, "erase", 14, 14).grid[14]![14]!.kind).toBe("road");
    }
  });
  test("roundabouts reserve nine tiles and any selected part deletes the whole group", () => {
    const state = place(createGame(), "roundabout", 17, 17);
    expect(state.grid.flat().filter((tile) => tile.group)).toHaveLength(9);
    const removed = place(state, "erase", 16, 16);
    expect(removed.grid.flat().filter((tile) => tile.group)).toHaveLength(0);
    expect(removed.balance).toBe(4820 - 280 + 112);
    expect(
      build(createGame(), "roundabout", { x: 4, y: 15 }, 0).error,
    ).toBeDefined();
  });
  test("insufficient funds and occupied cells cannot be overwritten", () => {
    expect(
      build({ ...createGame(), balance: 10 }, "parking", { x: 14, y: 14 }, 0)
        .error,
    ).toBeDefined();
    const state = place(createGame(), "parking", 14, 14);
    expect(build(state, "road", { x: 14, y: 14 }, 0).error).toBeDefined();
    expect(
      build(createGame(), "crossing", { x: 14, y: 14 }, 0).error,
    ).toBeDefined();
  });
});

describe("customers and contracts", () => {
  test("a parking built entirely from an empty site operates and bills at the exit", () => {
    const lot = builtLot();
    expect(infrastructure(lot.grid).usable).toHaveLength(24);
    const state = simulate(300, openParking(lot));
    expect(state.served).toBeGreaterThanOrEqual(30);
    expect(state.income).toBe(state.served * 3);
    expect(state.expenses).toBeGreaterThan(lot.expenses);
    expect(state.happiness).toBeGreaterThan(80);
    const claimed = claimContract(state);
    expect(claimed.unlocked).toBe(1);
    expect(claimed.balance).toBe(state.balance + 1800);
    expect(claimContract(claimed)).toBe(claimed);
  });
  test("missing gates prevent revenue and opening an incomplete lot", () => {
    let state = builtLot();
    state = place(state, "erase", 8, 9);
    expect(openParking(state).opened).toBe(false);
    expect(simulate(70, { ...state, opened: true }).income).toBe(0);
  });
  test("the largest contract remains achievable on the enlarged empty site", () => {
    let state = builtLot(2, 50);
    state = place(state, "crossing", 16, 11);
    state = place(state, "crossing", 30, 11);
    expect(infrastructure(state.grid).usable).toHaveLength(50);
    state = simulate(400, openParking(state));
    expect(state.served).toBeGreaterThanOrEqual(100);
    expect(state.happiness).toBeGreaterThanOrEqual(85);
    expect(claimContract(state).completed).toBe(true);
  });
  test("debt and poor service retain their recovery period once the parking opens", () => {
    const state = { ...createGame(), opened: true };
    expect(step({ ...state, balance: -100, debtTime: 44.9 }, 0.25).status).toBe(
      "lost",
    );
    expect(
      step({ ...state, happiness: 10, unhappyTime: 44.9 }, 0.25).status,
    ).toBe("lost");
    expect(step({ ...state, debtTime: 30 }, 0.25).debtTime).toBe(0);
  });
});

describe("saved games", () => {
  test("empty and decorated saves round-trip", () => {
    for (const state of [createGame(), place(createGame(), "lamp", 14, 14, 3)])
      expect(parseParkingSave(JSON.stringify(state))).toEqual(state);
  });
  test("version one saves expand without losing buildings, progress or money", () => {
    const state = createGame();
    const grid = state.grid.slice(0, 22).map((row) => row.slice(0, 30));
    grid[10]![10] = { kind: "parking", rotation: 2 };
    const legacy = {
      ...state,
      version: 1,
      opened: undefined,
      grid,
      balance: 5321,
      served: 17,
    };
    const migrated = parseParkingSave(JSON.stringify(legacy));
    expect(migrated?.version).toBe(2);
    expect(migrated?.grid).toHaveLength(ROWS);
    expect(migrated?.grid[0]).toHaveLength(COLS);
    expect(migrated?.grid[10]![10]).toEqual(grid[10]![10]);
    expect(migrated?.balance).toBe(5321);
    expect(migrated?.served).toBe(17);
    expect(migrated?.opened).toBe(true);
    expect(migrated && storeDoor(migrated.grid)).toEqual({ x: 24, y: 7 });
  });
  test("corrupt, incompatible and oversized saves are rejected", () => {
    expect(parseParkingSave("not json")).toBeNull();
    expect(
      parseParkingSave(JSON.stringify({ ...createGame(), version: 99 })),
    ).toBeNull();
    expect(
      parseParkingSave(JSON.stringify({ ...createGame(), grid: [] })),
    ).toBeNull();
    expect(parseParkingSave(" ".repeat(750001))).toBeNull();
  });
});
