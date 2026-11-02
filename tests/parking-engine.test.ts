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
  positionOnPath,
  roadWidth,
  parkingUpkeep,
  rotatePlaced,
  setBarrierKind,
  step,
  storeDoor,
  type ParkingState,
  type Car,
  type Point,
  type TollPayment,
  type UpkeepCharge,
} from "../apps/web/src/game/engine";
import {
  COLS,
  ROWS,
  parseParkingSave,
} from "../packages/backend/convex/lib/parkingState";
import { ROAD_TYPES, type RoadType } from "../apps/web/src/game/catalog";

function place(
  state: ParkingState,
  tool: Parameters<typeof build>[1],
  x: number,
  y: number,
  rotation = 0,
  roadType?: RoadType,
) {
  const result = build(state, tool, { x, y }, rotation, roadType);
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

describe("traffic lanes and roundabouts", () => {
  function carOn(path: Point[], progress = 0.5): Car {
    return {
      id: 0,
      color: "#dc9a65",
      spot: path.at(-1)!,
      path,
      progress,
      phase: "arriving",
      wait: 0,
      shoppingTime: 20,
      paid: false,
      fee: 3,
    };
  }
  function junction() {
    let state = place(createGame(), "roundabout", 17, 17);
    for (const p of [
      { x: 17, y: 15 },
      { x: 19, y: 17 },
      { x: 17, y: 19 },
      { x: 15, y: 17 },
    ])
      state = place(state, "road", p.x, p.y);
    return state;
  }
  test("opposing cars use separate right-hand lanes, including the wider public street", () => {
    let state = createGame();
    for (let x = 10; x <= 12; x++) state = place(state, "road", x, 15);
    const east = positionOnPath(
      carOn([
        { x: 10, y: 15 },
        { x: 11, y: 15 },
      ]),
      state.grid,
    );
    const west = positionOnPath(
      carOn([
        { x: 11, y: 15 },
        { x: 10, y: 15 },
      ]),
      state.grid,
    );
    expect(east).toMatchObject({ x: 10.5, y: 15.25, angle: 90 });
    expect(west).toMatchObject({ x: 10.5, y: 14.75, angle: 270 });
    const south = positionOnPath(
      carOn([
        { x: 3, y: 15 },
        { x: 3, y: 16 },
      ]),
      state.grid,
    );
    const north = positionOnPath(
      carOn([
        { x: 3, y: 16 },
        { x: 3, y: 15 },
      ]),
      state.grid,
    );
    expect(south).toMatchObject({ x: 2.625, y: 15.5, angle: 180 });
    expect(north).toMatchObject({ x: 3.375, y: 15.5, angle: 0 });
  });
  test("cars keep continuous lane positions through turns and finish in the center of their bay", () => {
    let state = createGame();
    for (const p of [
      { x: 10, y: 16 },
      { x: 11, y: 16 },
      { x: 11, y: 15 },
    ])
      state = place(state, "road", p.x, p.y);
    state = place(state, "parking", 11, 14, 2);
    const car = carOn([
      { x: 10, y: 16 },
      { x: 11, y: 16 },
      { x: 11, y: 15 },
      { x: 11, y: 14 },
    ]);
    const before = positionOnPath(
      { ...car, progress: 1 - 0.000001 },
      state.grid,
    );
    const after = positionOnPath(
      { ...car, progress: 1 + 0.000001 },
      state.grid,
    );
    expect(Math.hypot(before.x - after.x, before.y - after.y)).toBeLessThan(
      0.00001,
    );
    expect(before.y).toBeGreaterThan(16);
    expect(after.x).toBeGreaterThan(11);
    expect(positionOnPath({ ...car, progress: 3 }, state.grid)).toMatchObject({
      x: 11,
      y: 14,
    });
    expect(findPath(state.grid, car.spot, { x: 11, y: 16 })).toEqual([
      { x: 11, y: 14 },
      { x: 11, y: 15 },
      { x: 11, y: 16 },
    ]);
  });
  test("a west-to-north drive takes the counterclockwise arc while pedestrians may take the shorter route", () => {
    const { grid } = junction();
    const start = { x: 15, y: 17 },
      end = { x: 17, y: 15 };
    expect(findPath(grid, start, end)).toEqual([
      start,
      { x: 16, y: 17 },
      { x: 16, y: 18 },
      { x: 17, y: 18 },
      { x: 18, y: 18 },
      { x: 18, y: 17 },
      { x: 18, y: 16 },
      { x: 17, y: 16 },
      end,
    ]);
    expect(findPath(grid, start, end, true)).toHaveLength(5);
  });
  test("all entrances and exits follow the same circulation direction without crossing the island", () => {
    const { grid } = junction();
    const arms = [
      { x: 17, y: 15 },
      { x: 19, y: 17 },
      { x: 17, y: 19 },
      { x: 15, y: 17 },
    ];
    for (const start of arms)
      for (const end of arms) {
        if (start === end) continue;
        const path = findPath(grid, start, end)!;
        expect(path).not.toBeNull();
        expect(path.some((p) => p.x === 17 && p.y === 17)).toBe(false);
        for (let i = 1; i < path.length; i++) {
          const a = path[i - 1]!,
            b = path[i]!;
          if (grid[a.y]![a.x]!.group && grid[b.y]![b.x]!.group)
            expect(
              (a.x - 17) * (b.y - 17) - (a.y - 17) * (b.x - 17),
            ).toBeLessThan(0);
        }
      }
  });
  test("an old arrival route is corrected without resetting its position or client", () => {
    let state = junction();
    state = place(state, "parking", 17, 14, 2);
    const old = carOn(
      [
        { x: 15, y: 17 },
        { x: 16, y: 17 },
        { x: 16, y: 16 },
        { x: 17, y: 16 },
        { x: 17, y: 15 },
        { x: 17, y: 14 },
      ],
      0.25,
    );
    const next = step({ ...state, opened: true, cars: [old], nextCarId: 1 }, 0);
    expect(next.cars).toHaveLength(1);
    expect(next.cars[0]!.id).toBe(old.id);
    expect(positionOnPath(next.cars[0]!)).toEqual(positionOnPath(old));
    expect(next.cars[0]!.path).toContainEqual({ x: 16, y: 18 });
    expect(next.cars[0]!.path).not.toContainEqual({ x: 16, y: 16 });
    expect(next.balance).toBe(state.balance);
    expect(parseParkingSave(JSON.stringify(next))).not.toBeNull();
  });
  test("repairing an old departure preserves its toll payment and destination", () => {
    let state = place(createGame(), "roundabout", 10, 14);
    state = place(state, "road", 8, 14);
    state = place(state, "parking", 7, 14, 1);
    for (let x = 4; x <= 10; x++) state = place(state, "road", x, 11);
    state = place(state, "road", 10, 12);
    state = place(state, "gate", 10, 12);
    const car: Car = {
      ...carOn(
        [
          { x: 7, y: 14 },
          { x: 8, y: 14 },
          { x: 9, y: 14 },
          { x: 9, y: 13 },
          { x: 10, y: 13 },
          { x: 10, y: 12 },
          ...findPath(state.grid, { x: 10, y: 11 }, { x: 3, y: ROWS - 1 })!,
        ],
        1.4,
      ),
      spot: { x: 7, y: 14 },
      phase: "leaving",
    };
    const next = step({ ...state, opened: true, cars: [car], nextCarId: 1 }, 0);
    expect(next.cars[0]!.paid).toBe(false);
    expect(next.cars[0]!.path).toContainEqual({ x: 9, y: 15 });
    expect(next.cars[0]!.path).toContainEqual({ x: 10, y: 12 });
    const finished = simulate(60, next);
    expect(finished.served).toBe(1);
    expect(finished.income).toBe(3);
    expect(finished.cars).toHaveLength(0);
  });
  test("a lot accessed through a roundabout serves and charges clients in both travel directions", () => {
    let state = place(createGame(), "roundabout", 9, 10);
    for (let x = 4; x <= 7; x++) state = place(state, "road", x, 10);
    for (let x = 11; x <= 24; x++) state = place(state, "road", x, 10);
    state = place(state, "road", 24, 9);
    state = place(state, "road", 24, 8);
    state = place(state, "entry", 5, 10);
    state = place(state, "gate", 12, 10);
    state = place(state, "crossing", 17, 10);
    state = place(state, "crossing", 24, 10);
    for (let x = 13; x <= 18; x++) state = place(state, "parking", x, 11);
    expect(openingStatus(infrastructure(state.grid)).ready).toBe(true);
    const finished = simulate(180, openParking(state));
    expect(finished.served).toBeGreaterThanOrEqual(10);
    expect(finished.income).toBe(finished.served * 3);
    expect(finished.status).toBe("playing");
  });
});

describe("road types", () => {
  test.each(Object.keys(ROAD_TYPES) as RoadType[])(
    "%s construction is paid once, saved and undoable",
    (roadType) => {
      const state = createGame();
      const result = build(state, "road", { x: 14, y: 15 }, 1, roadType);
      expect(result.error).toBeUndefined();
      expect(result.state.balance).toBe(
        state.balance - ROAD_TYPES[roadType].price,
      );
      expect(result.undo?.grid).toBe(state.grid);
      expect(result.state.grid[15]![14]).toMatchObject({
        kind: "road",
        roadType,
        roadDirection: 1,
      });
      expect(
        build(result.state, "road", { x: 14, y: 15 }, 1, roadType).state,
      ).toBe(result.state);
      const saved = parseParkingSave(JSON.stringify(result.state))!;
      expect(saved.grid[15]![14]).toEqual(result.state.grid[15]![14]);
      expect(place(result.state, "erase", 14, 15).balance).toBe(
        result.state.balance + Math.round(ROAD_TYPES[roadType].price * 0.4),
      );
    },
  );
  test("one-way roads permit forward driving and walking in both directions", () => {
    let state = createGame();
    for (let x = 4; x <= 10; x++)
      state = place(state, "road", x, 15, 1, "oneWay");
    expect(
      findPath(state.grid, { x: 3, y: 15 }, { x: 10, y: 15 }),
    ).not.toBeNull();
    expect(findPath(state.grid, { x: 10, y: 15 }, { x: 3, y: 15 })).toBeNull();
    expect(
      findPath(state.grid, { x: 10, y: 15 }, { x: 3, y: 15 }, true),
    ).not.toBeNull();
    const rotated = rotatePlaced(rotatePlaced(state, { x: 7, y: 15 }).state, {
      x: 7,
      y: 15,
    }).state;
    expect(rotated.grid[15]![7]!.roadDirection).toBe(3);
    expect(rotated.balance).toBe(state.balance);
    expect(
      findPath(rotated.grid, { x: 3, y: 15 }, { x: 10, y: 15 }),
    ).toBeNull();
  });
  test("a one-way route can bend and branch onto a normal road without allowing reverse travel", () => {
    let state = createGame();
    for (let x = 4; x <= 7; x++)
      state = place(state, "road", x, 15, x === 7 ? 0 : 1, "oneWay");
    state = place(state, "road", 7, 14, 0, "oneWay");
    expect(
      findPath(state.grid, { x: 4, y: 15 }, { x: 7, y: 14 }),
    ).not.toBeNull();
    expect(findPath(state.grid, { x: 7, y: 14 }, { x: 4, y: 15 })).toBeNull();
    state = place(state, "road", 5, 14);
    expect(
      findPath(state.grid, { x: 4, y: 15 }, { x: 5, y: 14 }),
    ).not.toBeNull();
  });
  test("wide road upgrades retain barriers, directions and the underlying road after demolition", () => {
    let state = place(createGame(), "road", 14, 15, 1, "oneWay");
    state = place(state, "gate", 14, 15, 0);
    expect(state.grid[15]![14]).toMatchObject({
      kind: "gate",
      rotation: 0,
      roadType: "oneWay",
      roadDirection: 1,
    });
    const upgrade = build(state, "road", { x: 14, y: 15 }, 1, "wideOneWay");
    expect(upgrade.state.balance).toBe(state.balance - 25);
    expect(upgrade.state.grid[15]![14]).toMatchObject({
      kind: "gate",
      rotation: 0,
      roadType: "wideOneWay",
      roadDirection: 1,
    });
    expect(roadWidth(upgrade.state.grid[15]![14])).toBe(40);
    const removed = place(upgrade.state, "erase", 14, 15);
    expect(removed.grid[15]![14]).toMatchObject({
      kind: "road",
      roadType: "wideOneWay",
      roadDirection: 1,
    });
    expect(
      parseParkingSave(JSON.stringify(removed))?.grid[15]![14]!.roadType,
    ).toBe("wideOneWay");
  });
  test("two lanes on a wide one-way road are used separately", () => {
    let state = createGame();
    for (let x = 14; x <= 16; x++)
      state = place(state, "road", x, 15, 1, "wideOneWay");
    const car: Car = {
      id: 0,
      color: "#dc9a65",
      spot: { x: 16, y: 15 },
      path: [
        { x: 14, y: 15 },
        { x: 15, y: 15 },
        { x: 16, y: 15 },
      ],
      progress: 0.5,
      phase: "arriving",
      wait: 0,
      shoppingTime: 20,
      paid: false,
      fee: 3,
    };
    const first = positionOnPath(car, state.grid),
      second = positionOnPath({ ...car, id: 1 }, state.grid);
    expect(first.x).toBe(second.x);
    expect(first.angle).toBe(second.angle);
    expect(Math.abs(first.y - second.y) * 32).toBe(20);
    const next = step(
      {
        ...state,
        opened: true,
        cars: [car, { ...car, id: 1, progress: 0.9 }],
        nextCarId: 2,
      },
      0.25,
    );
    expect(next.cars[0]!.progress).toBeGreaterThan(car.progress);
    expect(next.cars[1]!.progress).toBeGreaterThan(0.9);
  });
  test("a place with no legal return route is detected and cannot open the lot", () => {
    let state = builtLot(0, 1);
    state = place(state, "road", 9, 9, 1, "oneWay");
    const info = infrastructure(state.grid);
    expect(info.spots).toHaveLength(1);
    expect(info.spotConnections[0]).toMatchObject({
      streetConnected: true,
      storeConnected: true,
      exitConnected: false,
      issue: "exit",
    });
    expect(info.usable).toHaveLength(0);
    expect(openingStatus(info).missing.map((check) => check.id)).toContain(
      "return",
    );
    expect(openParking(state)).toBe(state);
  });
  test("protected roads and roundabout rings cannot be reprofiled", () => {
    const state = place(createGame(), "roundabout", 17, 17);
    expect(build(state, "road", { x: 3, y: 15 }, 1, "wideOneWay").state).toBe(
      state,
    );
    expect(build(state, "road", { x: 16, y: 17 }, 1, "oneWay").state).toBe(
      state,
    );
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
  test("maintenance explains the exact automatic debit and occurs only once per period", () => {
    const state = { ...builtLot(0, 6), opened: true, upkeepTimer: 29.75 };
    const quote = parkingUpkeep(state);
    expect(quote).toMatchObject({
      base: 8,
      spaces: 6,
      parking: 0.9,
      amount: 8.9,
      interval: 30,
      nextIn: 0.25,
    });
    const charges: UpkeepCharge[] = [];
    const paid = step(
      state,
      0.25,
      () => 0.5,
      undefined,
      (charge) => charges.push(charge),
    );
    expect(paid.balance).toBeCloseTo(state.balance - 8.9, 8);
    expect(paid.expenses).toBeCloseTo(state.expenses + 8.9, 8);
    expect(charges).toEqual([quote]);
    expect(parkingUpkeep(paid).nextIn).toBe(30);
    const next = step(
      paid,
      0.25,
      () => 0.5,
      undefined,
      (charge) => charges.push(charge),
    );
    expect(next.balance).toBe(paid.balance);
    expect(charges).toHaveLength(1);
  });
  test.each([
    [0, 8.45],
    [1, 13.45],
    [2, 19.45],
  ])("contract %i uses its own fixed maintenance fee", (level, amount) => {
    const state = { ...builtLot(level, 3), opened: true, upkeepTimer: 29.75 };
    const next = step(state, 0.25);
    expect(parkingUpkeep(state).amount).toBe(amount);
    expect(state.balance - next.balance).toBeCloseTo(amount, 8);
  });
  test("removing a space lowers the next maintenance bill, while construction remains free of maintenance", () => {
    let state = builtLot(0, 6);
    state = place(state, "erase", 10, 10);
    expect(parkingUpkeep(state)).toMatchObject({ spaces: 5, amount: 8.75 });
    const charges: UpkeepCharge[] = [];
    expect(
      step(
        state,
        60,
        () => 0.5,
        undefined,
        (charge) => charges.push(charge),
      ),
    ).toBe(state);
    expect(charges).toHaveLength(0);
  });
  test("a toll receipt reports the charged fee and gate even when the car exits in the same tick", () => {
    let state = createGame();
    state = place(state, "road", 5, 29);
    state = place(state, "road", 4, 29);
    state = place(state, "gate", 4, 29);
    state = place(state, "parking", 6, 29, 3);
    const car: Car = {
      id: 0,
      color: "#dc9a65",
      spot: { x: 6, y: 29 },
      path: [
        { x: 6, y: 29 },
        { x: 5, y: 29 },
        { x: 4, y: 29 },
        { x: 3, y: 29 },
        { x: 3, y: 30 },
        { x: 3, y: 31 },
      ],
      progress: 1.8,
      phase: "leaving",
      wait: 0,
      shoppingTime: 20,
      paid: false,
      fee: 3.5,
    };
    const receipts: TollPayment[] = [];
    const next = step(
      { ...state, price: 7, opened: true, cars: [car], nextCarId: 1 },
      2,
      () => 0.5,
      (payment) => receipts.push(payment),
    );
    expect(next.cars).toHaveLength(0);
    expect(next.income).toBe(3.5);
    expect(next.balance).toBe(state.balance + 3.5);
    expect(receipts).toEqual([
      { carId: 0, point: { x: 4, y: 29 }, amount: 3.5 },
    ]);
  });
  test("arrivals and already paid clients never emit extra toll receipts", () => {
    let state = builtLot(0, 1);
    state = place(state, "gate", 9, 9);
    const car: Car = {
      id: 0,
      color: "#dc9a65",
      spot: { x: 10, y: 10 },
      path: [
        { x: 10, y: 10 },
        { x: 10, y: 9 },
        { x: 9, y: 9 },
        { x: 8, y: 9 },
        { x: 7, y: 9 },
      ],
      progress: 1.8,
      phase: "leaving",
      wait: 0,
      shoppingTime: 20,
      paid: false,
      fee: 3,
    };
    const receipts: TollPayment[] = [];
    state = { ...state, opened: true, cars: [car], nextCarId: 1 };
    for (let i = 0; i < 4; i++)
      state = step(
        state,
        0.25,
        () => 0.5,
        (payment) => receipts.push(payment),
      );
    expect(state.income).toBe(3);
    expect(receipts).toEqual([{ carId: 0, point: { x: 9, y: 9 }, amount: 3 }]);
    const arrival = {
      ...car,
      phase: "arriving" as const,
      path: [...car.path].reverse(),
      progress: 0.8,
    };
    step(
      { ...state, cars: [arrival] },
      0.25,
      () => 0.5,
      (payment) => receipts.push(payment),
    );
    expect(receipts).toHaveLength(1);
  });
  test("simultaneous toll payments keep their individual amounts and positions", () => {
    let state = builtLot(0, 1);
    for (let x = 12; x <= 14; x++) state = place(state, "road", x, 15);
    state = place(state, "gate", 13, 15);
    const car: Car = {
      id: 0,
      color: "#dc9a65",
      spot: { x: 10, y: 10 },
      path: [
        { x: 9, y: 9 },
        { x: 8, y: 9 },
        { x: 7, y: 9 },
      ],
      progress: 0.8,
      phase: "leaving",
      wait: 0,
      shoppingTime: 20,
      paid: false,
      fee: 2.5,
    };
    const other: Car = {
      ...car,
      id: 1,
      fee: 4,
      path: [
        { x: 14, y: 15 },
        { x: 13, y: 15 },
        { x: 12, y: 15 },
      ],
    };
    const receipts: TollPayment[] = [];
    const next = step(
      { ...state, opened: true, cars: [car, other], nextCarId: 2 },
      0.25,
      () => 0.5,
      (payment) => receipts.push(payment),
    );
    expect(next.income).toBe(6.5);
    expect(next.served).toBe(2);
    expect(receipts).toEqual([
      { carId: 0, point: { x: 8, y: 9 }, amount: 2.5 },
      { carId: 1, point: { x: 13, y: 15 }, amount: 4 },
    ]);
  });
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
