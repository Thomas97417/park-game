import {
  COLS,
  ROWS,
  SAVE_VERSION,
  type ParkingState,
  type Tile,
  type Point,
  type Car,
} from "@my-better-t-app/backend/convex/lib/parkingState";
import { CAR_COLORS, LEVELS, TOOLS, type Tool } from "./catalog";

export { COLS, ROWS };
export type { ParkingState, Tile, Point, Car };
export const CELL = 32;
export const ORIGIN = { x: 64, y: 32 };
export const STORE_DOOR: Point = { x: 16, y: 7 };
export const PUBLIC_START: Point = { x: 3, y: 0 };
export const PUBLIC_END: Point = { x: 3, y: ROWS - 1 };
const key = (p: Point) => `${p.x},${p.y}`;
const same = (a: Point, b: Point) => a.x === b.x && a.y === b.y;
export const inBounds = (p: Point) =>
  p.x >= 0 && p.x < COLS && p.y >= 0 && p.y < ROWS;
export const isRoad = (tile?: Tile) =>
  !!tile && ["road", "crossing", "entry", "gate"].includes(tile.kind);
export const neighbors = (p: Point): Point[] =>
  [
    { x: p.x, y: p.y - 1 },
    { x: p.x + 1, y: p.y },
    { x: p.x, y: p.y + 1 },
    { x: p.x - 1, y: p.y },
  ].filter(inBounds);
const walkable = (tile?: Tile) =>
  !!tile && (isRoad(tile) || tile.kind === "parking" || tile.kind === "path");

export function tilesOf(grid: Tile[][], kind: Tile["kind"]): Point[] {
  return grid.flatMap((row, y) =>
    row.flatMap((tile, x) => (tile.kind === kind ? [{ x, y }] : [])),
  );
}

/** Breadth-first routing respects road connections and the opening of each bay. */
export function findPath(
  grid: Tile[][],
  start: Point,
  end: Point,
  pedestrian = false,
): Point[] | null {
  if (!inBounds(start) || !inBounds(end)) return null;
  const queue = [start];
  const previous = new Map<string, Point | null>([[key(start), null]]);
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i]!;
    if (same(current, end)) {
      const path = [current];
      let cursor = previous.get(key(current));
      while (cursor) {
        path.unshift(cursor);
        cursor = previous.get(key(cursor));
      }
      return path;
    }
    for (const next of neighbors(current)) {
      const tile = grid[next.y]![next.x]!;
      if (previous.has(key(next))) continue;
      if (pedestrian ? !walkable(tile) : !isRoad(tile) && !same(next, end))
        continue;
      if (
        !pedestrian &&
        tile.kind === "parking" &&
        !same(parkingAccess(next, tile.rotation), current)
      )
        continue;
      previous.set(key(next), current);
      queue.push(next);
    }
  }
  return null;
}

export function parkingAccess(spot: Point, rotation: number): Point {
  return [
    { x: spot.x, y: spot.y - 1 },
    { x: spot.x + 1, y: spot.y },
    { x: spot.x, y: spot.y + 1 },
    { x: spot.x - 1, y: spot.y },
  ][rotation]!;
}

function reachableRoads(grid: Tile[][], start: Point): Set<string> {
  const visited = new Set<string>();
  if (!isRoad(grid[start.y]?.[start.x])) return visited;
  const queue = [start];
  visited.add(key(start));
  for (let i = 0; i < queue.length; i++) {
    for (const next of neighbors(queue[i]!)) {
      if (!visited.has(key(next)) && isRoad(grid[next.y]![next.x])) {
        visited.add(key(next));
        queue.push(next);
      }
    }
  }
  return visited;
}

export function infrastructure(grid: Tile[][]) {
  const reachable = reachableRoads(grid, PUBLIC_START);
  const entries = tilesOf(grid, "entry").filter((p) => reachable.has(key(p)));
  const gates = tilesOf(grid, "gate").filter((p) => reachable.has(key(p)));
  const spots = tilesOf(grid, "parking");
  const usable = spots.filter((spot) => {
    const access = parkingAccess(spot, grid[spot.y]![spot.x]!.rotation);
    return (
      entries.length > 0 &&
      gates.length > 0 &&
      reachable.has(key(access)) &&
      !!findPath(grid, spot, STORE_DOOR, true)
    );
  });
  return {
    spots,
    usable,
    entries,
    gates,
    crossings: tilesOf(grid, "crossing").filter((p) => reachable.has(key(p)))
      .length,
    trees: tilesOf(grid, "tree").length,
    roundabouts: tilesOf(grid, "roundabout").length,
  };
}

export function objectives(state: ParkingState) {
  const level = LEVELS[state.level];
  const info = infrastructure(state.grid);
  return [
    {
      label: "Places de parking reliées",
      value: info.usable.length,
      target: level.capacity,
      unit: "places",
      done: info.usable.length >= level.capacity,
    },
    {
      label: "Passages piétons sécurisés",
      value: info.crossings,
      target: level.crossings,
      unit: "passages",
      done: info.crossings >= level.crossings,
    },
    {
      label: "Clients accueillis",
      value: state.served,
      target: level.clients,
      unit: "clients",
      done: state.served >= level.clients,
    },
    {
      label: "Satisfaction des clients",
      value: Math.round(state.happiness),
      target: level.satisfaction,
      unit: "%",
      done: state.happiness >= level.satisfaction,
    },
  ];
}

export function claimContract(state: ParkingState): ParkingState {
  if (
    state.status !== "playing" ||
    state.completed ||
    !objectives(state).every((goal) => goal.done)
  )
    return state;
  return {
    ...state,
    completed: true,
    unlocked: Math.min(2, Math.max(state.unlocked, state.level + 1)),
    balance: state.balance + LEVELS[state.level]!.reward,
  };
}

export function createGame(level = 0, unlocked = level): ParkingState {
  const grid: Tile[][] = Array.from({ length: ROWS }, (_, y) =>
    Array.from({ length: COLS }, (_, x) => ({
      kind: "grass",
      rotation: 0,
      fixed: x < 5 || x > 28 || y < 1 || y > 18,
    })),
  );
  const put = (
    x: number,
    y: number,
    kind: Tile["kind"],
    rotation = 0,
    fixed = false,
  ) => {
    grid[y]![x] = { kind, rotation, fixed };
  };
  for (let y = 0; y < ROWS; y++) put(3, y, "road", 0, true);
  for (let x = 0; x < COLS; x++) put(x, 20, "road", 0, true);
  for (let x = 7; x <= 25; x++) {
    put(x, 9, "road");
    put(x, 16, "road");
  }
  for (let y = 9; y <= 16; y++) {
    put(7, y, "road");
    put(25, y, "road");
  }
  for (let x = 4; x <= 7; x++) {
    put(x, 13, "road");
    put(x, 16, "road");
  }
  put(6, 13, "entry", 1);
  put(6, 16, "gate", 1);
  const shopLeft = level === 0 ? 11 : level === 1 ? 10 : 8;
  const shopRight = level === 0 ? 21 : level === 1 ? 22 : 24;
  for (let y = level === 2 ? 1 : 2; y <= 6; y++)
    for (let x = shopLeft; x <= shopRight; x++) put(x, y, "store", 0, true);
  for (let x = 9; x <= 23; x++) put(x, 7, "path", 0, true);
  put(16, 8, "path", 0, true);
  put(16, 9, "crossing");
  for (const x of [10, 11, 12, 13, 18, 19, 20, 21]) {
    put(x, 10, "parking", 0);
    put(x, 15, "parking", 2);
  }
  for (const [x, y] of [
    [9, 12],
    [12, 12],
    [20, 12],
    [23, 12],
    [5, 6],
    [6, 3],
    [26, 4],
    [27, 7],
    [27, 17],
    [6, 18],
    [19, 18],
    [9, 18],
  ])
    put(x!, y!, "tree");
  const spots = tilesOf(grid, "parking");
  const cars: Car[] = spots
    .filter((_, i) => i % 2 === 0)
    .map((spot, i) => ({
      id: i,
      color: CAR_COLORS[i % CAR_COLORS.length]!,
      spot,
      path: [spot],
      progress: 0,
      phase: "shopping",
      wait: 0,
      shoppingTime: 8 + i * 4,
      paid: false,
      fee: 3,
    }));
  return {
    version: SAVE_VERSION,
    savedAt: 0,
    level,
    unlocked,
    grid,
    cars,
    balance: LEVELS[level]!.budget,
    income: 0,
    expenses: 0,
    served: 0,
    missed: 0,
    happiness: 92,
    elapsed: 0,
    spawnTimer: 4,
    upkeepTimer: 0,
    price: 3,
    nextCarId: 8,
    debtTime: 0,
    unhappyTime: 0,
    status: "playing",
    completed: false,
  };
}

export interface BuildUndo {
  grid: Tile[][];
  delta: number;
  expenseDelta: number;
}
export interface BuildResult {
  state: ParkingState;
  error?: string;
  undo?: BuildUndo;
}

export function build(
  state: ParkingState,
  tool: Tool,
  point: Point,
  rotation: number,
): BuildResult {
  const fail = (error: string): BuildResult => ({ state, error });
  if (state.status === "lost")
    return fail("Ce contrat est terminé. Relancez une partie.");
  if (!inBounds(point) || tool === "select") return { state };
  const old = state.grid[point.y]![point.x]!;
  if (old.fixed)
    return fail("Ce terrain appartient à la ville ou au commerce.");
  const grid = state.grid.map((row) => row.map((tile) => ({ ...tile })));
  let delta = 0;
  let expenseDelta = 0;
  if (tool === "erase") {
    if (old.kind === "grass") return { state };
    const cells = old.group
      ? state.grid.flatMap((row, y) =>
          row.flatMap((t, x) => (t.group === old.group ? [{ x, y }] : [])),
        )
      : [point];
    if (
      state.cars.some((car) =>
        cells.some(
          (cell) =>
            same(cell, car.spot) ||
            car.path
              .slice(Math.floor(car.progress), Math.floor(car.progress) + 2)
              .some((p) => same(p, cell)),
        ),
      )
    )
      return fail("Un client utilise cet aménagement. Attendez son départ.");
    for (const cell of cells)
      grid[cell.y]![cell.x] = { kind: "grass", rotation: 0 };
    delta = Math.round(
      (TOOLS.find((t) => t.id === (old.group ? "roundabout" : old.kind))
        ?.price ?? 35) * 0.4,
    );
    expenseDelta = -delta;
  } else {
    const price = TOOLS.find((t) => t.id === tool)!.price;
    if (state.balance < price)
      return fail("Trésorerie insuffisante pour cet aménagement.");
    if (["crossing", "entry", "gate"].includes(tool)) {
      if (!isRoad(old) || old.kind !== "road" || old.group)
        return fail("Placez cet équipement sur une route libre.");
    } else if (old.kind !== "grass")
      return fail("Cette case est déjà occupée.");
    if (tool === "roundabout") {
      const cells = Array.from({ length: 9 }, (_, i) => ({
        x: point.x - 1 + (i % 3),
        y: point.y - 1 + Math.floor(i / 3),
      }));
      if (
        cells.some(
          (cell) =>
            !inBounds(cell) || state.grid[cell.y]![cell.x]!.kind !== "grass",
        )
      )
        return fail("Un rond-point a besoin de 3 × 3 cases libres.");
      const group = `round-${point.x}-${point.y}`;
      for (const cell of cells)
        grid[cell.y]![cell.x] = {
          kind: same(cell, point) ? "roundabout" : "road",
          rotation: 0,
          group,
        };
    } else grid[point.y]![point.x] = { kind: tool, rotation };
    delta = -price;
    expenseDelta = price;
  }
  return {
    state: {
      ...state,
      grid,
      balance: state.balance + delta,
      expenses: state.expenses + expenseDelta,
    },
    undo: { grid: state.grid, delta, expenseDelta },
  };
}

export function positionOnPath(car: Car): {
  x: number;
  y: number;
  angle: number;
} {
  const index = Math.min(Math.floor(car.progress), car.path.length - 1);
  const a = car.path[index] ?? car.spot;
  const b = car.path[index + 1] ?? a;
  const progress = car.progress - index;
  const previous = car.path[Math.max(0, index - 1)] ?? a;
  const direction = same(a, b)
    ? { x: a.x - previous.x, y: a.y - previous.y }
    : { x: b.x - a.x, y: b.y - a.y };
  return {
    x: a.x + (b.x - a.x) * progress,
    y: a.y + (b.y - a.y) * progress,
    angle: (Math.atan2(direction.y, direction.x) * 180) / Math.PI + 90,
  };
}

function exitPath(grid: Tile[][], car: Car, gates: Point[]): Point[] | null {
  const access = parkingAccess(
    car.spot,
    grid[car.spot.y]![car.spot.x]!.rotation,
  );
  if (!inBounds(access) || !isRoad(grid[access.y]![access.x])) return null;
  for (const gate of gates) {
    const toGate = findPath(grid, access, gate);
    const toExit = findPath(grid, gate, PUBLIC_END);
    if (toGate && toExit) return [car.spot, ...toGate, ...toExit.slice(1)];
  }
  return null;
}

export function step(
  state: ParkingState,
  dt: number,
  random: () => number = Math.random,
): ParkingState {
  if (state.status !== "playing") return state;
  const info = infrastructure(state.grid);
  const level = LEVELS[state.level];
  let { balance, income, expenses, served, missed, happiness, nextCarId } =
    state;
  let cars = state.cars.map((car) => ({ ...car }));
  const positions = cars
    .filter((car) => car.phase !== "shopping")
    .map((car) => ({ id: car.id, ...positionOnPath(car) }));

  cars = cars.filter((car) => {
    if (car.phase === "shopping") {
      car.wait += dt;
      if (car.wait >= car.shoppingTime) {
        const route = exitPath(state.grid, car, info.gates);
        if (route) {
          car.path = route;
          car.progress = 0;
          car.phase = "leaving";
          car.wait = 0;
        } else if (car.wait > car.shoppingTime + 30) {
          missed++;
          happiness = Math.max(0, happiness - 5);
          return false;
        }
      }
      return true;
    }
    const nextProgress = Math.min(
      car.progress + dt * (2.2 + Math.min(info.roundabouts, 3) * 0.15),
      car.path.length - 1,
    );
    const next = positionOnPath({ ...car, progress: nextProgress });
    const nextCell =
      car.path[Math.min(Math.ceil(nextProgress), car.path.length - 1)]!;
    const blockedRoad =
      !isRoad(state.grid[nextCell.y]![nextCell.x]) &&
      state.grid[nextCell.y]![nextCell.x]!.kind !== "parking";
    // Each road has two visual lanes. Only cars in the same direction queue.
    const blockedCar = positions.some(
      (p) =>
        p.id !== car.id &&
        Math.cos(((p.angle - next.angle) * Math.PI) / 180) > 0.5 &&
        Math.hypot(p.x - next.x, p.y - next.y) < 0.72 &&
        Math.hypot(p.x - positionOnPath(car).x, p.y - positionOnPath(car).y) >
          Math.hypot(p.x - next.x, p.y - next.y),
    );
    if (blockedRoad || blockedCar) {
      car.wait += dt;
      if (car.wait > 35) {
        missed++;
        happiness = Math.max(0, happiness - 4);
        return false;
      }
      return true;
    }
    car.wait = 0;
    const previousProgress = car.progress;
    car.progress = nextProgress;
    if (car.phase === "leaving" && !car.paid) {
      const crossedGate = car.path
        .slice(Math.floor(previousProgress), Math.floor(nextProgress) + 1)
        .some((p) => state.grid[p.y]![p.x]!.kind === "gate");
      if (crossedGate) {
        car.paid = true;
        balance += car.fee;
        income += car.fee;
        served++;
      }
    }
    if (car.progress >= car.path.length - 1) {
      if (car.phase === "leaving") return false;
      car.phase = "shopping";
      car.wait = 0;
    }
    return true;
  });

  let spawnTimer = state.spawnTimer + dt;
  const interval =
    level.demand / Math.max(1, Math.min(info.entries.length, 3) * 0.7);
  if (spawnTimer >= interval) {
    spawnTimer = 0;
    const available = info.usable.filter(
      (spot) => !cars.some((car) => same(car.spot, spot)),
    );
    const spot = available[Math.floor(random() * available.length)];
    const entry = info.entries[Math.floor(random() * info.entries.length)];
    if (spot && entry && cars.length < 100) {
      const startToEntry = findPath(state.grid, PUBLIC_START, entry);
      const entryToSpot = findPath(state.grid, entry, spot);
      if (startToEntry && entryToSpot) {
        cars.push({
          id: nextCarId++,
          color: CAR_COLORS[Math.floor(random() * CAR_COLORS.length)]!,
          spot,
          path: [...startToEntry, ...entryToSpot.slice(1)],
          progress: 0,
          phase: "arriving",
          wait: 0,
          shoppingTime: level.shopping + random() * 15,
          paid: false,
          fee: state.price,
        });
      }
    } else {
      missed++;
      happiness = Math.max(0, happiness - 1.5);
    }
  }

  let upkeepTimer = state.upkeepTimer + dt;
  if (upkeepTimer >= 30) {
    upkeepTimer = 0;
    const amount = level.upkeep + info.spots.length * 0.15;
    balance -= amount;
    expenses += amount;
  }
  const pressure = info.usable.length
    ? Math.max(0, (cars.length / info.usable.length - 0.85) * 35)
    : 30;
  const targetHappiness = Math.max(
    5,
    Math.min(
      98,
      79 +
        info.crossings * 3 +
        Math.min(info.trees, 20) * 0.45 +
        info.roundabouts * 2 -
        Math.max(0, state.price - 3) * 8 -
        pressure -
        (info.gates.length ? 0 : 25),
    ),
  );
  happiness = Math.max(
    0,
    Math.min(100, happiness + (targetHappiness - happiness) * dt * 0.018),
  );
  const debtTime = balance < 0 ? state.debtTime + dt : 0;
  const unhappyTime = happiness < 35 ? state.unhappyTime + dt : 0;
  const lost = debtTime >= 45 || unhappyTime >= 45;
  return {
    ...state,
    cars,
    balance,
    income,
    expenses,
    served,
    missed,
    happiness,
    nextCarId,
    spawnTimer,
    upkeepTimer,
    elapsed: state.elapsed + dt,
    debtTime,
    unhappyTime,
    status: lost ? "lost" : "playing",
    lossReason: lost
      ? debtTime >= 45
        ? "Votre trésorerie est restée dans le rouge trop longtemps."
        : "Les clients sont mécontents depuis trop longtemps."
      : undefined,
  };
}

export function clockTime(elapsed: number) {
  const minutes = Math.floor(((elapsed % 240) / 240) * 720) + 480;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
