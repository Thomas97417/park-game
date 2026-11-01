import {
  COLS,
  BUILD_BOUNDS,
  ROWS,
  SAVE_VERSION,
  type ParkingState,
  type Tile,
  type Point,
  type Car,
} from "@my-better-t-app/backend/convex/lib/parkingState";
import { CAR_COLORS, LEVELS, TOOLS, type Tool } from "./catalog";

export { COLS, ROWS, BUILD_BOUNDS };
export type { ParkingState, Tile, Point, Car };
export const CELL = 32;
export const ORIGIN = { x: 64, y: 32 };
export const STORE_DOOR: Point = { x: 24, y: 7 };
export const WORLD_WIDTH = ORIGIN.x * 2 + COLS * CELL;
export const WORLD_HEIGHT = ORIGIN.y * 2 + ROWS * CELL;
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

const ROUNDABOUT_RING = [
  { x: 0, y: -1 },
  { x: -1, y: -1 },
  { x: -1, y: 0 },
  { x: -1, y: 1 },
  { x: 0, y: 1 },
  { x: 1, y: 1 },
  { x: 1, y: 0 },
  { x: 1, y: -1 },
];

/** Screen coordinates: north → west → south → east is counterclockwise. */
export function canDriveBetween(
  grid: Tile[][],
  from: Point,
  to: Point,
): boolean {
  if (Math.abs(to.x - from.x) + Math.abs(to.y - from.y) !== 1) return false;
  const group = grid[from.y]?.[from.x]?.group;
  if (!group || grid[to.y]?.[to.x]?.group !== group) return true;
  for (let y = from.y - 1; y <= from.y + 1; y++) {
    for (let x = from.x - 1; x <= from.x + 1; x++) {
      const center = grid[y]?.[x];
      if (center?.kind !== "roundabout" || center.group !== group) continue;
      const index = ROUNDABOUT_RING.findIndex(
        (p) => p.x === from.x - x && p.y === from.y - y,
      );
      if (index < 0) return false;
      const next = ROUNDABOUT_RING[(index + 1) % ROUNDABOUT_RING.length]!;
      return to.x === x + next.x && to.y === y + next.y;
    }
  }
  return true;
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
      if (!pedestrian && !canDriveBetween(grid, current, next)) continue;
      const currentTile = grid[current.y]![current.x]!;
      if (
        !pedestrian &&
        currentTile.kind === "parking" &&
        !same(parkingAccess(current, currentTile.rotation), next)
      )
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

export function storeBounds(grid: Tile[][]) {
  const cells = tilesOf(grid, "store");
  return {
    left: Math.min(...cells.map((p) => p.x)),
    right: Math.max(...cells.map((p) => p.x)),
    top: Math.min(...cells.map((p) => p.y)),
    bottom: Math.max(...cells.map((p) => p.y)),
  };
}

export function storeDoor(grid: Tile[][]): Point {
  const bounds = storeBounds(grid);
  return {
    x: Math.floor((bounds.left + bounds.right) / 2),
    y: bounds.bottom + 1,
  };
}

function reachableTiles(
  grid: Tile[][],
  start: Point,
  accepts: (tile?: Tile) => boolean,
  canStep?: (from: Point, to: Point) => boolean,
): Set<string> {
  const visited = new Set<string>();
  if (!accepts(grid[start.y]?.[start.x])) return visited;
  const queue = [start];
  visited.add(key(start));
  for (let i = 0; i < queue.length; i++) {
    for (const next of neighbors(queue[i]!)) {
      if (
        !visited.has(key(next)) &&
        accepts(grid[next.y]![next.x]) &&
        (!canStep || canStep(queue[i]!, next))
      ) {
        visited.add(key(next));
        queue.push(next);
      }
    }
  }
  return visited;
}

export interface ParkingConnection {
  point: Point;
  access: Point;
  roadAccess: boolean;
  streetConnected: boolean;
  storeConnected: boolean;
  issue: "orientation" | "road" | "street" | "store" | null;
}

export function parkingConnectionMessage(connection: ParkingConnection) {
  switch (connection.issue) {
    case "orientation":
      return "Pivotez la place : son ouverture doit donner sur la route.";
    case "road":
      return "Tracez une route devant l’ouverture de la place.";
    case "street":
      return "Reliez la route de cette place à la rue publique.";
    case "store":
      return "Reliez cette place au parvis du magasin par une route ou un passage piéton.";
    default:
      return "Place reliée à la rue et au magasin.";
  }
}

export function infrastructure(grid: Tile[][]) {
  const reachable = reachableTiles(grid, PUBLIC_START, isRoad, (from, to) =>
    canDriveBetween(grid, from, to),
  );
  const exits = reachableTiles(grid, PUBLIC_END, isRoad, (from, to) =>
    canDriveBetween(grid, to, from),
  );
  const pedestrians = reachableTiles(grid, storeDoor(grid), walkable);
  const placedEntries = tilesOf(grid, "entry");
  const placedGates = tilesOf(grid, "gate");
  const entries = placedEntries.filter((p) => reachable.has(key(p)));
  const gates = placedGates.filter(
    (p) => reachable.has(key(p)) && exits.has(key(p)),
  );
  const spots = tilesOf(grid, "parking");
  const spotConnections: ParkingConnection[] = spots.map((spot) => {
    const access = parkingAccess(spot, grid[spot.y]![spot.x]!.rotation);
    const roadAccess = isRoad(grid[access.y]?.[access.x]);
    const streetConnected = roadAccess && reachable.has(key(access));
    const storeConnected = pedestrians.has(key(spot));
    return {
      point: spot,
      access,
      roadAccess,
      streetConnected,
      storeConnected,
      issue: !roadAccess
        ? neighbors(spot).some((p) => isRoad(grid[p.y]?.[p.x]))
          ? "orientation"
          : "road"
        : !streetConnected
          ? "street"
          : !storeConnected
            ? "store"
            : null,
    };
  });
  // Detect bays independently of entrance/exit equipment. Opening checks both.
  const usable = spotConnections
    .filter((connection) => connection.issue === null)
    .map((connection) => connection.point);
  return {
    spots,
    usable,
    spotConnections,
    placedEntries,
    placedGates,
    entries,
    gates,
    crossings: tilesOf(grid, "crossing").filter((p) => reachable.has(key(p)))
      .length,
    trees: tilesOf(grid, "tree").length,
    roundabouts: tilesOf(grid, "roundabout").filter((p) =>
      neighbors(p).some((n) => reachable.has(key(n))),
    ).length,
  };
}

/** Shared by the opening guard and its UI, including keyboard activation. */
export function openingStatus(info: ReturnType<typeof infrastructure>) {
  const streetSpots = info.spotConnections.filter((p) => p.streetConnected);
  const checks = [
    {
      id: "entry",
      label: "Entrée reliée à la rue",
      done: info.entries.length > 0,
      detail: info.entries.length
        ? `${info.entries.length} entrée${info.entries.length > 1 ? "s" : ""} reliée${info.entries.length > 1 ? "s" : ""}`
        : info.placedEntries.length
          ? "Reliez l’entrée à la rue publique par une route continue."
          : "Placez une entrée sur une route reliée à la rue. Une barrière de sortie ne sert pas d’entrée.",
      tool: "entry" as Tool,
    },
    {
      id: "exit",
      label: "Sortie reliée à la rue",
      done: info.gates.length > 0,
      detail: info.gates.length
        ? `${info.gates.length} sortie${info.gates.length > 1 ? "s" : ""} reliée${info.gates.length > 1 ? "s" : ""}`
        : info.placedGates.length
          ? "Reliez la barrière de sortie à la rue publique."
          : "Placez une barrière de sortie sur une route reliée à la rue.",
      tool: "gate" as Tool,
    },
    {
      id: "parking",
      label: "Places accessibles depuis la rue",
      done: streetSpots.length > 0,
      detail: streetSpots.length
        ? `${streetSpots.length} / ${info.spots.length} places accessibles`
        : !info.spots.length
          ? "Ajoutez au moins une place de parking, ouverte vers une route."
          : info.spotConnections.some((p) => p.roadAccess)
            ? "Reliez la route des places à la rue publique."
            : info.spotConnections.some((p) => p.issue === "orientation")
              ? "Pivotez les places pour orienter leur ouverture vers la route."
              : "Tracez une route devant l’ouverture des places.",
      tool: (!info.spots.length ? "parking" : "road") as Tool,
    },
    {
      id: "store",
      label: "Accès piéton au magasin",
      done: info.usable.length > 0,
      detail: info.usable.length
        ? `${info.usable.length} / ${info.spots.length} places reliées au magasin`
        : !streetSpots.length
          ? "Une même place doit être accessible depuis la rue et reliée au magasin."
          : "Prolongez la route des places jusqu’au parvis du magasin. Les passages piétons se posent sur la route.",
      tool: "road" as Tool,
    },
  ];
  return {
    checks,
    missing: checks.filter((check) => !check.done),
    ready: checks.every((check) => check.done),
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
      fixed:
        x < BUILD_BOUNDS.left ||
        x >= BUILD_BOUNDS.right ||
        y < BUILD_BOUNDS.top ||
        y >= BUILD_BOUNDS.bottom,
    })),
  );
  const put = (x: number, y: number, kind: Tile["kind"]) => {
    grid[y]![x] = { kind, rotation: 0, fixed: true };
  };
  for (let y = 0; y < ROWS; y++) put(3, y, "road");
  for (let x = 0; x < COLS; x++) put(x, 30, "road");
  const left = level === 0 ? 19 : level === 1 ? 18 : 16;
  const right = level === 0 ? 29 : level === 1 ? 30 : 32;
  for (let y = level === 2 ? 1 : 2; y <= 6; y++)
    for (let x = left; x <= right; x++) put(x, y, "store");
  for (let x = left - 1; x <= right + 1; x++) put(x, 7, "path");
  return {
    version: SAVE_VERSION,
    savedAt: 0,
    level,
    unlocked,
    grid,
    cars: [],
    balance: LEVELS[level]!.budget,
    income: 0,
    expenses: 0,
    served: 0,
    missed: 0,
    happiness: 92,
    elapsed: 0,
    spawnTimer: 0,
    upkeepTimer: 0,
    price: 3,
    nextCarId: 0,
    debtTime: 0,
    unhappyTime: 0,
    status: "playing",
    completed: false,
    opened: false,
  };
}

export function openParking(state: ParkingState): ParkingState {
  if (
    state.status !== "playing" ||
    state.opened ||
    !openingStatus(infrastructure(state.grid)).ready
  )
    return state;
  return { ...state, opened: true };
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
  if (tool === "road" && isRoad(old)) return { state };
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
      grid[cell.y]![cell.x] = {
        kind: ["crossing", "entry", "gate"].includes(old.kind)
          ? "road"
          : "grass",
        rotation: 0,
      };
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
    } else if (
      old.kind !== "grass" &&
      !(
        tool === "road" &&
        ["tree", "lamp", "bench", "flowers"].includes(old.kind)
      )
    )
      return fail("Cette case est déjà occupée.");
    if (tool === "roundabout") {
      const cells = Array.from({ length: 9 }, (_, i) => ({
        x: point.x - 1 + (i % 3),
        y: point.y - 1 + Math.floor(i / 3),
      }));
      if (
        cells.some(
          (cell) =>
            !inBounds(cell) ||
            state.grid[cell.y]![cell.x]!.fixed ||
            state.grid[cell.y]![cell.x]!.kind !== "grass",
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

export const canRotate = (tile?: Tile) =>
  !!tile &&
  !tile.fixed &&
  ["parking", "crossing", "entry", "gate", "lamp", "bench"].includes(tile.kind);

export function rotatePlaced(state: ParkingState, point: Point): BuildResult {
  if (!inBounds(point) || state.status !== "playing") return { state };
  const tile = state.grid[point.y]![point.x]!;
  if (!canRotate(tile))
    return { state, error: "Cet élément ne peut pas pivoter." };
  if (
    state.cars.some(
      (car) =>
        same(car.spot, point) ||
        car.path
          .slice(Math.floor(car.progress), Math.floor(car.progress) + 2)
          .some((p) => same(p, point)),
    )
  )
    return {
      state,
      error: "Un client utilise cet aménagement. Attendez son départ.",
    };
  const grid = state.grid.map((row) => row.slice());
  grid[point.y]![point.x] = { ...tile, rotation: (tile.rotation + 1) % 4 };
  return {
    state: { ...state, grid },
    undo: { grid: state.grid, delta: 0, expenseDelta: 0 },
  };
}

export function setBarrierKind(
  state: ParkingState,
  point: Point,
  kind: "entry" | "gate",
): BuildResult {
  if (!inBounds(point)) return { state };
  if (state.status !== "playing")
    return { state, error: "Ce contrat est terminé. Relancez une partie." };
  const tile = state.grid[point.y]![point.x]!;
  if (tile.fixed || (tile.kind !== "entry" && tile.kind !== "gate"))
    return { state, error: "Sélectionnez une barrière modifiable." };
  if (tile.kind === kind) return { state };
  // A departing client may already be routed to this toll to pay.
  if (
    state.cars.some(
      (car) =>
        car.phase !== "shopping" &&
        car.path.slice(Math.floor(car.progress)).some((p) => same(p, point)),
    )
  )
    return {
      state,
      error: "Un client emprunte encore cette barrière. Attendez son passage.",
    };
  const grid = state.grid.map((row) => row.slice());
  grid[point.y]![point.x] = { ...tile, kind };
  return {
    state: { ...state, grid },
    undo: { grid: state.grid, delta: 0, expenseDelta: 0 },
  };
}

function lanePoint(grid: Tile[][], path: Point[], index: number): Point {
  const point = path[index]!;
  const tile = grid[point.y]?.[point.x];
  if (!isRoad(tile)) return point;
  const before = path[index - 1] ?? point;
  const after = path[index + 1] ?? point;
  const incoming = same(before, point)
    ? { x: after.x - point.x, y: after.y - point.y }
    : { x: point.x - before.x, y: point.y - before.y };
  const outgoing = same(after, point)
    ? incoming
    : { x: after.x - point.x, y: after.y - point.y };
  const dot = incoming.x * outgoing.x + incoming.y * outgoing.y;
  const offset = (tile!.fixed ? 12 : 8) / CELL;
  // Intersect the right-hand lane on both sides of a corner, keeping positions continuous.
  const normal =
    dot === -1
      ? { x: -outgoing.y, y: outgoing.x }
      : {
          x: -(incoming.y + outgoing.y) / (1 + dot),
          y: (incoming.x + outgoing.x) / (1 + dot),
        };
  return { x: point.x + normal.x * offset, y: point.y + normal.y * offset };
}

export function positionOnPath(
  car: Car,
  grid?: Tile[][],
): {
  x: number;
  y: number;
  angle: number;
} {
  const index = Math.min(Math.floor(car.progress), car.path.length - 1);
  const a = grid
    ? lanePoint(grid, car.path, index)
    : (car.path[index] ?? car.spot);
  const b = grid
    ? lanePoint(grid, car.path, Math.min(index + 1, car.path.length - 1))
    : (car.path[index + 1] ?? a);
  const progress = car.progress - index;
  const previous = grid
    ? lanePoint(grid, car.path, Math.max(0, index - 1))
    : (car.path[Math.max(0, index - 1)] ?? a);
  const direction = same(a, b)
    ? { x: a.x - previous.x, y: a.y - previous.y }
    : { x: b.x - a.x, y: b.y - a.y };
  return {
    x: a.x + (b.x - a.x) * progress,
    y: a.y + (b.y - a.y) * progress,
    angle: (Math.atan2(direction.y, direction.x) * 180) / Math.PI + 90,
  };
}

/** Preserve an in-progress segment while replacing old routes that used a roundabout backwards. */
function repairCarRoute(grid: Tile[][], car: Car): Car {
  if (car.phase === "shopping") return { ...car };
  const anchorIndex = Math.ceil(car.progress);
  if (
    !car.path
      .slice(anchorIndex, -1)
      .some((p, i) => !canDriveBetween(grid, p, car.path[anchorIndex + i + 1]!))
  )
    return { ...car };
  const anchor = car.path[anchorIndex]!;
  const remaining = car.path.slice(anchorIndex);
  const checkpoint = remaining.find(
    (p) =>
      grid[p.y]?.[p.x]?.kind === (car.phase === "arriving" ? "entry" : "gate"),
  );
  const end = car.path.at(-1)!;
  const targets =
    checkpoint && (car.phase === "arriving" || !car.paid)
      ? [checkpoint, end]
      : [end];
  const route = [anchor];
  for (const target of targets) {
    const leg = findPath(grid, route.at(-1)!, target);
    if (!leg) return { ...car };
    route.push(...leg.slice(1));
  }
  const prefixStart = Math.max(0, anchorIndex - 2);
  return {
    ...car,
    path: [...car.path.slice(prefixStart, anchorIndex), ...route],
    progress: car.progress - prefixStart,
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
  if (state.status !== "playing" || !state.opened) return state;
  const info = infrastructure(state.grid);
  const level = LEVELS[state.level];
  let { balance, income, expenses, served, missed, happiness, nextCarId } =
    state;
  let cars = state.cars.map((car) => repairCarRoute(state.grid, car));
  const positions = cars
    .filter((car) => car.phase !== "shopping")
    .map((car) => ({ id: car.id, ...positionOnPath(car, state.grid) }));

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
    const next = positionOnPath({ ...car, progress: nextProgress }, state.grid);
    const current = positionOnPath(car, state.grid);
    const nextCell =
      car.path[Math.min(Math.ceil(nextProgress), car.path.length - 1)]!;
    const blockedRoad =
      !isRoad(state.grid[nextCell.y]![nextCell.x]) &&
      state.grid[nextCell.y]![nextCell.x]!.kind !== "parking";
    const againstTraffic = car.path
      .slice(Math.ceil(car.progress), Math.ceil(nextProgress))
      .some(
        (p, i) =>
          !canDriveBetween(
            state.grid,
            p,
            car.path[Math.ceil(car.progress) + i + 1]!,
          ),
      );
    // Queue against the same positions that are rendered in each lane.
    const blockedCar = positions.some(
      (p) =>
        p.id !== car.id &&
        Math.cos(((p.angle - next.angle) * Math.PI) / 180) > 0.5 &&
        Math.hypot(p.x - next.x, p.y - next.y) < 0.72 &&
        Math.hypot(p.x - current.x, p.y - current.y) >
          Math.hypot(p.x - next.x, p.y - next.y),
    );
    if (blockedRoad || blockedCar || againstTraffic) {
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
