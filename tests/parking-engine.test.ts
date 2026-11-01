import { describe, expect, test } from "bun:test";
import {
  build,
  claimContract,
  createGame,
  findPath,
  infrastructure,
  openParking,
  openingStatus,
  parkingAccess,
  rotatePlaced,
  setBarrierKind,
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

describe("opening diagnostics", () => {
  test("all placed bays are detected independently of entry and exit equipment", () => {
    let state = builtLot(0, 6);
    state = place(state, "erase", 6, 9);
    state = place(state, "erase", 8, 9);
    const info = infrastructure(state.grid);
    expect(info.spots).toHaveLength(6);
    expect(info.usable).toHaveLength(6);
    expect(openingStatus(info).missing.map((check) => check.id)).toEqual([
      "entry",
      "exit",
    ]);
    expect(openParking(state)).toBe(state);
  });
  test("two exit barriers do not count as an entrance, and adding an entrance unlocks opening", () => {
    let state = builtLot(0, 6);
    state = place(state, "erase", 6, 9);
    state = place(state, "gate", 6, 9);
    const info = infrastructure(state.grid);
    expect(info.spots).toHaveLength(6);
    expect(info.usable).toHaveLength(6);
    expect(info.gates).toHaveLength(2);
    expect(openingStatus(info).missing.map((check) => check.id)).toEqual([
      "entry",
    ]);
    expect(openParking(state)).toBe(state);
    state = place(state, "entry", 9, 9);
    expect(openingStatus(infrastructure(state.grid)).ready).toBe(true);
    expect(simulate(150, openParking(state)).served).toBeGreaterThan(0);
  });
  test.each([0, 1, 2, 3])(
    "driving access matches the bay opening at rotation %i",
    (rotation) => {
      let state = place(createGame(), "parking", 20, 15, rotation);
      const spot = { x: 20, y: 15 };
      const access = parkingAccess(spot, rotation);
      state = place(state, "road", access.x, access.y);
      expect(infrastructure(state.grid).spotConnections[0]?.roadAccess).toBe(
        true,
      );
      expect(findPath(state.grid, access, spot)).toEqual([access, spot]);
      const rotated = rotatePlaced(state, spot).state;
      expect(infrastructure(rotated.grid).spotConnections[0]?.issue).toBe(
        "orientation",
      );
      expect(findPath(rotated.grid, access, spot)).toBeNull();
    },
  );
  test("reports wrong orientation, absent road, disconnected road and missing shop access separately", () => {
    const good = builtLot(0, 1);
    const wrongWay = rotatePlaced(good, { x: 10, y: 10 }).state;
    expect(infrastructure(wrongWay.grid).spotConnections[0]?.issue).toBe(
      "orientation",
    );
    const noRoad = place(createGame(), "parking", 10, 10);
    expect(infrastructure(noRoad.grid).spotConnections[0]?.issue).toBe("road");
    const island = place(noRoad, "road", 10, 9);
    expect(infrastructure(island.grid).spotConnections[0]?.issue).toBe(
      "street",
    );
    const noStore = place(good, "erase", 24, 8);
    expect(infrastructure(noStore.grid).spotConnections[0]).toMatchObject({
      roadAccess: true,
      streetConnected: true,
      storeConnected: false,
      issue: "store",
    });
    expect(
      openingStatus(infrastructure(noStore.grid)).missing.map(
        (check) => check.id,
      ),
    ).toEqual(["store"]);
    expect(openParking(noStore)).toBe(noStore);
  });
  test("placed but disconnected entry and exit do not satisfy opening checks", () => {
    let state = builtLot(0, 1);
    state = place(state, "erase", 6, 9);
    state = place(state, "erase", 8, 9);
    state = place(state, "road", 15, 18);
    state = place(state, "road", 16, 18);
    state = place(state, "entry", 15, 18);
    state = place(state, "gate", 16, 18);
    const info = infrastructure(state.grid);
    expect(info.placedEntries).toHaveLength(1);
    expect(info.placedGates).toHaveLength(1);
    expect(info.entries).toHaveLength(0);
    expect(info.gates).toHaveLength(0);
    expect(openingStatus(info).missing.map((check) => check.id)).toEqual([
      "entry",
      "exit",
    ]);
    expect(openParking(state)).toBe(state);
  });
  test("street and shop must connect to the same usable bay", () => {
    let state = builtLot(0, 1);
    state = place(state, "erase", 24, 8);
    state = place(state, "erase", 25, 9);
    state = place(state, "erase", 26, 9);
    state = place(state, "road", 26, 8);
    state = place(state, "parking", 25, 8, 1);
    const info = infrastructure(state.grid);
    expect(info.spotConnections.some((p) => p.streetConnected)).toBe(true);
    expect(info.spotConnections.some((p) => p.storeConnected)).toBe(true);
    expect(info.usable).toHaveLength(0);
    expect(openingStatus(info).ready).toBe(false);
    expect(openParking(state)).toBe(state);
  });
  test("one usable bay permits opening even when other bays still need connections", () => {
    const state = place(builtLot(0, 1), "parking", 14, 14);
    const info = infrastructure(state.grid);
    expect(info.spots).toHaveLength(2);
    expect(info.usable).toHaveLength(1);
    expect(openingStatus(info).ready).toBe(true);
    expect(openParking(state).opened).toBe(true);
  });
});

describe("construction and selection", () => {
  test.each([
    ["entry", "gate", 6],
    ["gate", "entry", 8],
  ] as const)(
    "a selected %s can become a %s for free and the change can be undone",
    (from, to, x) => {
      const state = builtLot(0, 1);
      const point = { x, y: 9 };
      const result = setBarrierKind(state, point, to);
      expect(result.error).toBeUndefined();
      expect(result.state.grid[9]![x]).toEqual({
        ...state.grid[9]![x],
        kind: to,
      });
      expect(state.grid[9]![x]!.kind).toBe(from);
      expect(result.state.balance).toBe(state.balance);
      expect(result.state.expenses).toBe(state.expenses);
      expect(result.state.cars).toBe(state.cars);
      expect(result.undo).toEqual({
        grid: state.grid,
        delta: 0,
        expenseDelta: 0,
      });
      expect(
        parseParkingSave(JSON.stringify(result.state))?.grid[9]![x]!.kind,
      ).toBe(to);
      const restored = { ...result.state, grid: result.undo!.grid };
      expect(restored).toEqual(state);
    },
  );
  test("converting one of two exits to an entrance immediately permits opening and billing", () => {
    let state = builtLot(0, 6);
    state = place(state, "erase", 6, 9);
    state = place(state, "gate", 6, 9);
    expect(
      openingStatus(infrastructure(state.grid)).missing.map(
        (check) => check.id,
      ),
    ).toEqual(["entry"]);
    const converted = setBarrierKind(state, { x: 6, y: 9 }, "entry");
    expect(openingStatus(infrastructure(converted.state.grid)).ready).toBe(
      true,
    );
    expect(infrastructure(converted.state.grid).gates).toHaveLength(1);
    const served = simulate(150, openParking(converted.state));
    expect(served.served).toBeGreaterThan(0);
    expect(served.income).toBe(served.served * state.price);
  });
  test("clients already routed through a barrier must pass before its function changes", () => {
    const state: ParkingState = {
      ...builtLot(0, 1),
      opened: true,
      nextCarId: 1,
      cars: [
        {
          id: 0,
          color: "#dc9a65",
          spot: { x: 10, y: 10 },
          path: Array.from({ length: 6 }, (_, i) => ({ x: i + 4, y: 9 })),
          progress: 0,
          phase: "leaving",
          wait: 0,
          shoppingTime: 20,
          paid: false,
          fee: 3,
        },
      ],
    };
    const blocked = setBarrierKind(state, { x: 8, y: 9 }, "entry");
    expect(blocked.error).toContain("client");
    expect(blocked.state).toBe(state);
    expect(blocked.undo).toBeUndefined();
    const passed: ParkingState = {
      ...state,
      cars: [{ ...state.cars[0]!, progress: 5, paid: true }],
    };
    expect(
      setBarrierKind(passed, { x: 8, y: 9 }, "entry").state.grid[9]![8]!.kind,
    ).toBe("entry");
  });
  test("conversion rejects non-barriers, protected barriers and finished contracts, with no history for an unchanged role", () => {
    const state = builtLot(0, 1);
    expect(
      setBarrierKind(state, { x: 10, y: 10 }, "entry").error,
    ).toBeDefined();
    const grid = state.grid.map((row) => row.slice());
    grid[9]![8] = { ...grid[9]![8]!, fixed: true };
    expect(
      setBarrierKind({ ...state, grid }, { x: 8, y: 9 }, "entry").error,
    ).toBeDefined();
    expect(
      setBarrierKind({ ...state, status: "lost" }, { x: 8, y: 9 }, "entry")
        .error,
    ).toBeDefined();
    expect(setBarrierKind(state, { x: 8, y: 9 }, "gate")).toEqual({ state });
    expect(setBarrierKind(state, { x: -1, y: 9 }, "gate")).toEqual({ state });
  });
  test("tracing across existing roads preserves equipment and does not charge again", () => {
    const state = builtLot(0, 1);
    for (const point of [
      { x: 3, y: 9 },
      { x: 5, y: 9 },
      { x: 6, y: 9 },
      { x: 8, y: 9 },
      { x: 24, y: 9 },
    ]) {
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
