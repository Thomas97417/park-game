import { describe, expect, test } from "bun:test";
import {
  build,
  claimContract,
  createGame,
  findPath,
  infrastructure,
  objectives,
  step,
} from "../apps/web/src/game/engine";
import { parseParkingSave } from "../packages/backend/convex/lib/parkingState";

function simulate(seconds: number, state = createGame()) {
  for (let i = 0; i < seconds * 4; i++) state = step(state, 0.25, () => 0.45);
  return state;
}

describe("parking infrastructure", () => {
  test("the starter lot has sixteen accessible bays, an entrance and a paying exit", () => {
    const info = infrastructure(createGame().grid);
    expect(info.usable).toHaveLength(16);
    expect(info.entries).toHaveLength(1);
    expect(info.gates).toHaveLength(1);
    expect(info.crossings).toBe(1);
  });

  test("a bay only works when its opening faces a connected road", () => {
    const state = createGame();
    const correct = build(state, "parking", { x: 14, y: 10 }, 0);
    expect(correct.error).toBeUndefined();
    expect(correct.state.balance).toBe(state.balance - 60);
    expect(infrastructure(correct.state.grid).usable).toHaveLength(17);
    const wrong = build(state, "parking", { x: 14, y: 10 }, 2);
    expect(infrastructure(wrong.state.grid).usable).toHaveLength(16);
  });

  test("roads cannot route through grass and public roads cannot be demolished", () => {
    const state = createGame();
    expect(findPath(state.grid, { x: 5, y: 10 }, { x: 10, y: 9 })).toBeNull();
    expect(build(state, "erase", { x: 3, y: 10 }, 0).error).toBeDefined();
    expect(build(state, "road", { x: 0, y: 3 }, 0).error).toBeDefined();
  });

  test("a crossing must be placed on a road and cannot overwrite an access", () => {
    const state = createGame();
    expect(build(state, "crossing", { x: 14, y: 12 }, 0).error).toBeDefined();
    expect(build(state, "crossing", { x: 6, y: 13 }, 0).error).toBeDefined();
    expect(build(state, "crossing", { x: 20, y: 9 }, 0).state.balance).toBe(
      state.balance - 80,
    );
  });

  test("roundabouts reserve nine cells and demolition removes the whole group", () => {
    const state = createGame();
    const placed = build(state, "roundabout", { x: 17, y: 13 }, 0);
    expect(placed.error).toBeUndefined();
    expect(placed.state.grid.flat().filter((tile) => tile.group)).toHaveLength(
      9,
    );
    const removed = build(placed.state, "erase", { x: 16, y: 12 }, 0);
    expect(removed.state.grid.flat().filter((tile) => tile.group)).toHaveLength(
      0,
    );
    expect(removed.state.balance).toBe(state.balance - 280 + 112);
  });

  test("insufficient funds cannot place a tile, and demolition refunds forty percent", () => {
    const state = createGame();
    expect(
      build({ ...state, balance: 10 }, "parking", { x: 14, y: 10 }, 0).error,
    ).toBeDefined();
    const placed = build(state, "tree", { x: 14, y: 12 }, 0);
    const removed = build(placed.state, "erase", { x: 14, y: 12 }, 0);
    expect(removed.state.balance).toBe(state.balance - 40 + 16);
  });
});

describe("customers and contracts", () => {
  test("customers shop, pass the exit gate, pay exactly once and keep arriving", () => {
    const state = simulate(130);
    expect(state.served).toBeGreaterThan(8);
    expect(state.income).toBe(state.served * 3);
    expect(state.cars.length).toBeGreaterThan(0);
    expect(state.happiness).toBeGreaterThan(70);
    expect(state.status).toBe("playing");
    expect(state.expenses).toBeGreaterThan(0);
  });

  test("a missing payment gate cannot produce any revenue", () => {
    const state = createGame();
    state.grid[16]![6] = { kind: "road", rotation: 0 };
    const result = simulate(50, state);
    expect(result.served).toBe(0);
    expect(result.income).toBe(0);
  });

  test("long debt or poor service ends the contract, a recovery resets the grace period", () => {
    const state = createGame();
    expect(step({ ...state, balance: -100, debtTime: 44.9 }, 0.25).status).toBe(
      "lost",
    );
    expect(
      step({ ...state, happiness: 10, unhappyTime: 44.9 }, 0.25).status,
    ).toBe("lost");
    expect(step({ ...state, debtTime: 30 }, 0.25).debtTime).toBe(0);
    const lost = { ...state, status: "lost" as const };
    expect(step(lost, 10)).toBe(lost);
  });

  test("the first construction objectives can be achieved by expanding the existing lot", () => {
    let state = createGame();
    for (const x of [14, 15, 16, 17]) {
      state = build(state, "parking", { x, y: 10 }, 0).state;
      state = build(state, "parking", { x, y: 15 }, 2).state;
    }
    state = build(state, "crossing", { x: 20, y: 9 }, 0).state;
    const goals = objectives({ ...state, served: 30 });
    expect(goals.every((goal) => goal.done)).toBe(true);
    const ready = { ...state, served: 30 };
    const claimed = claimContract(ready);
    expect(claimed.unlocked).toBe(1);
    expect(claimed.balance).toBe(ready.balance + 1800);
    expect(claimContract(claimed)).toBe(claimed);
    expect(claimContract(createGame()).completed).toBe(false);
  });

  test("the largest contract can be built and completed through the real simulation", () => {
    let state = createGame(2, 2);
    for (const x of [14, 15, 16, 17, 22, 23]) {
      state = build(state, "parking", { x, y: 10 }, 0).state;
      state = build(state, "parking", { x, y: 15 }, 2).state;
    }
    for (let x = 9; x <= 23; x++)
      if (x !== 16) state = build(state, "parking", { x, y: 8 }, 2).state;
    for (let x = 9; x <= 16; x++)
      state = build(state, "parking", { x, y: 17 }, 0).state;
    for (const [x, y] of [
      [12, 9],
      [20, 9],
      [20, 16],
    ])
      state = build(state, "crossing", { x: x!, y: y! }, 0).state;
    expect(infrastructure(state.grid).usable).toHaveLength(50);
    state = simulate(400, state);
    expect(state.served).toBeGreaterThanOrEqual(100);
    expect(state.happiness).toBeGreaterThanOrEqual(85);
    expect(objectives(state).every((goal) => goal.done)).toBe(true);
    expect(claimContract(state).completed).toBe(true);
  });
});

describe("saved games", () => {
  test("valid saves round-trip, including refunded starter assets", () => {
    const state = createGame();
    const demolished = build(state, "erase", { x: 5, y: 6 }, 0).state;
    expect(parseParkingSave(JSON.stringify(demolished))).toEqual(demolished);
  });

  test("corrupt, old, oversized and invalid path data are rejected", () => {
    expect(parseParkingSave("not json")).toBeNull();
    expect(
      parseParkingSave(JSON.stringify({ ...createGame(), version: 99 })),
    ).toBeNull();
    expect(
      parseParkingSave(JSON.stringify({ ...createGame(), grid: [] })),
    ).toBeNull();
    expect(parseParkingSave(" ".repeat(250_001))).toBeNull();
    const state = createGame();
    state.cars[0]!.progress = 99;
    expect(parseParkingSave(JSON.stringify(state))).toBeNull();
  });
});
