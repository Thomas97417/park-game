import { useEffect, useMemo, useRef, useState } from "react";
import {
  COLS,
  ROWS,
  CELL,
  ORIGIN,
  storeDoor,
  storeBounds,
  BUILD_BOUNDS,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  build,
  findPath,
  inBounds,
  isRoad,
  parkingConnectionMessage,
  positionOnPath,
  type Car,
  type ParkingState,
  type Point,
  type Tile,
  type ParkingConnection,
  type infrastructure,
} from "@/game/engine";
import { LEVELS, type Tool } from "@/game/catalog";

const cx = (x: number) => ORIGIN.x + x * CELL + CELL / 2;
const cy = (y: number) => ORIGIN.y + y * CELL + CELL / 2;

export function Tree({
  x,
  y,
  small = false,
}: {
  x: number;
  y: number;
  small?: boolean;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${small ? 0.72 : 1})`}>
      <ellipse cx="7" cy="11" rx="18" ry="12" fill="#536747" opacity="0.14" />
      <path
        d="M0 5v12"
        stroke="#8a805e"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx="-6" cy="1" r="12" fill="#7f9b64" />
      <circle cx="6" cy="-4" r="13" fill="#91ae72" />
      <circle cx="-4" cy="-9" r="12" fill="#a3bc80" />
      <circle cx="2" cy="-12" r="6" fill="#b6ca94" opacity="0.65" />
    </g>
  );
}

export function CarSprite({
  color = "#dc9a65",
  small = false,
}: {
  color?: string;
  small?: boolean;
}) {
  return (
    <g transform={small ? "scale(.7)" : undefined}>
      <rect
        x="-7"
        y="-11"
        width="17"
        height="27"
        rx="4"
        fill="#364c42"
        opacity="0.17"
      />
      <path d="M-9-7v5M9-7v5M-9 6v5M9 6v5" stroke="#4e514b" strokeWidth="2.5" />
      <rect
        x="-8"
        y="-14"
        width="16"
        height="28"
        rx="4"
        fill={color}
        stroke="#334a48"
        strokeOpacity="0.2"
      />
      <path d="M-5-7h10l1 6H-6Z" fill="#3e5960" />
      <path d="M-5 6h10v4H-5Z" fill="#4a6165" />
      <path d="M-5-6h8" stroke="#bad1ce" strokeWidth="1" opacity="0.7" />
      <path
        d="M-6-11h3M3-11h3"
        stroke="#fff4cf"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M-6 12h3M3 12h3" stroke="#b75e53" strokeWidth="1.5" />
      <path d="M-5 1v3M5 1v3" stroke="white" strokeOpacity="0.2" />
    </g>
  );
}

function ParkingBay({
  tile,
  disconnected = false,
}: {
  tile: Tile;
  disconnected?: boolean;
}) {
  return (
    <g transform={`rotate(${tile.rotation * 90})`}>
      <rect x="-16" y="-16" width="32" height="32" fill="#d0d8c9" />
      <path
        d="M-14-14v27h28v-27"
        fill="none"
        stroke="#fbfcf4"
        strokeWidth="2"
      />
      <path
        d="m-3-10 3-3 3 3"
        fill="none"
        stroke={disconnected ? "#b88749" : "#8da37e"}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <text
        x="0"
        y="3"
        textAnchor="middle"
        fontSize="8"
        fill="#a2b29a"
        fontFamily="sans-serif"
        fontWeight="600"
      >
        P
      </text>
      {disconnected && (
        <rect
          x="-15"
          y="-15"
          width="30"
          height="30"
          rx="2"
          fill="none"
          stroke="#ca995c"
          strokeWidth="1.5"
          strokeDasharray="3 2"
        />
      )}
    </g>
  );
}

function Crossing({ vertical }: { vertical: boolean }) {
  return (
    <g transform={vertical ? "rotate(90)" : undefined}>
      {[-11, -5, 1, 7].map((x) => (
        <rect
          key={x}
          x={x}
          y="-12"
          width="3.5"
          height="24"
          rx="0.6"
          fill="#bcc7ad"
        />
      ))}
      <path d="M-15-15h30M-15 15h30" stroke="#e9d396" strokeWidth="2" />
    </g>
  );
}

function Barrier({
  entry = false,
  rotation = 0,
  open = false,
}: {
  entry?: boolean;
  rotation?: number;
  open?: boolean;
}) {
  return (
    <g transform={`rotate(${rotation * 90})`}>
      <rect x="-18" y="-10" width="7" height="17" rx="2" fill="#526459" />
      <rect
        x="-17"
        y="-9"
        width="5"
        height="4"
        rx="1"
        fill={entry ? "#abc88c" : "#e9bc76"}
      />
      <circle cx="-14.5" cy="3" r="1.5" fill={open ? "#b9d4a1" : "#e1a780"} />
      <g
        transform={open ? "rotate(-65 -12 0)" : undefined}
        style={{ transition: "transform 300ms ease" }}
      >
        <rect
          x="-12"
          y="-2"
          width="27"
          height="4"
          rx="1"
          fill="#fffdf3"
          stroke="#d8d8c9"
          strokeWidth="0.5"
        />
        <path d="M-7-2l3 4M1-2l3 4M9-2l3 4" stroke="#cd8b78" strokeWidth="3" />
      </g>
      <path
        d="M0 7v7m-3-3 3 3 3-3"
        stroke="#a2aa97"
        fill="none"
        strokeWidth="1.5"
      />
    </g>
  );
}

function Shop({ level, grid }: { level: number; grid: Tile[][] }) {
  const info = LEVELS[level]!;
  const bounds = storeBounds(grid);
  const width = (bounds.right - bounds.left + 1) * CELL;
  return (
    <g
      transform={`translate(${ORIGIN.x + bounds.left * CELL} ${ORIGIN.y + bounds.top * CELL}) scale(${width / 416} ${((bounds.bottom - bounds.top + 1) * CELL) / 160})`}
    >
      <path d="M10 16H416l20 19v144H22Z" fill="#567052" opacity="0.15" />
      <rect x="0" y="4" width="416" height="157" rx="4" fill="#536d59" />
      <rect
        x="3"
        y="0"
        width="410"
        height="147"
        rx="3"
        fill={info.roof}
        stroke="#5d7760"
        strokeWidth="2"
      />
      <path
        d="m3 0 14 13h382l14-13M17 13v120l-14 14M399 13v120l14 14M17 133h382"
        fill="none"
        stroke="#c0d0b6"
        strokeOpacity="0.45"
        strokeWidth="1.5"
      />
      <rect
        x="30"
        y="25"
        width="78"
        height="38"
        rx="3"
        fill="#62776a"
        opacity="0.6"
      />
      <rect
        x="27"
        y="22"
        width="76"
        height="36"
        rx="3"
        fill="#b7c4b2"
        stroke="#6d8470"
      />
      {[47, 82].map((x) => (
        <g key={x}>
          <circle cx={x} cy="40" r="12" fill="#859985" />
          <circle
            cx={x}
            cy="40"
            r="9"
            fill="none"
            stroke="#a7b6a1"
            strokeWidth="1.5"
          />
          <path
            d={`M${x - 7} 40h14M${x} 33v14`}
            stroke="#bcc8b7"
            strokeWidth="2"
          />
        </g>
      ))}
      <rect
        x="286"
        y="28"
        width="93"
        height="66"
        rx="2"
        fill="#637b77"
        opacity="0.4"
      />
      {Array.from({ length: 8 }, (_, i) => (
        <g
          key={i}
          transform={`translate(${282 + (i % 4) * 24} ${24 + Math.floor(i / 4) * 31})`}
        >
          <rect
            width="21"
            height="28"
            rx="1"
            fill="#46616a"
            stroke="#9eb6b0"
            strokeWidth="1"
          />
          <path
            d="M7 1v26M14 1v26M1 9h19M1 18h19"
            stroke="#78969b"
            strokeWidth="0.55"
          />
        </g>
      ))}
      <rect x="126" y="55" width="133" height="40" rx="3" fill="#6a826a" />
      <text
        x="192"
        y="73"
        textAnchor="middle"
        fontSize="12"
        fontWeight="700"
        letterSpacing="2.2"
        fill="#fbf8e9"
        fontFamily="sans-serif"
      >
        {info.shop}
      </text>

      <rect x="8" y="147" width="400" height="15" fill="#e9e7d2" />
      {Array.from({ length: 20 }, (_, i) => (
        <path key={i} d={`M${8 + i * 20} 146h10l2 18h-12Z`} fill="#be9982" />
      ))}
      <path d="M8 164h400" stroke="#a58a73" strokeWidth="2" />
      <rect
        x="190"
        y="148"
        width="36"
        height="20"
        fill="#b3c6be"
        stroke="#597065"
        strokeWidth="2"
      />
      <path
        d="M208 150v16M194 152h11M211 152h11"
        stroke="#e6eee3"
        strokeWidth="1.5"
      />
      <rect x="183" y="170" width="50" height="13" rx="2" fill="#c8cebb" />

      {[46, 344, 372].map((x) => (
        <g key={x} transform={`translate(${x} 177)`}>
          <rect x="-8" y="-4" width="16" height="7" rx="2" fill="#a2ac8c" />
          <circle cx="-3" cy="-5" r="5" fill="#789064" />
          <circle cx="3" cy="-6" r="5" fill="#90a777" />
        </g>
      ))}
      <g
        transform="translate(284 180)"
        stroke="#9aab98"
        fill="none"
        strokeWidth="1.2"
      >
        <path d="m0-5 2 10h9l3-8H2M6-5v11M10-5v11M0 0h12" />
        <circle cx="4" cy="8" r="1.5" />
        <circle cx="11" cy="8" r="1.5" />
        <path d="m17-5 2 10h9l3-8H19M23-5v11M27-5v11M17 0h12" />
      </g>
    </g>
  );
}

function Pedestrian({ car, grid }: { car: Car; grid: Tile[][] }) {
  const path = useMemo(
    () => findPath(grid, car.spot, storeDoor(grid), true),
    [car.spot, grid],
  );
  if (!path || car.phase !== "shopping") return null;
  const ratio = car.wait / car.shoppingTime;
  if (ratio > 0.28 && ratio < 0.75) return null;
  const progress = ratio <= 0.28 ? ratio / 0.28 : (1 - ratio) / 0.25;
  const at = Math.max(
    0,
    Math.min(path.length - 1, progress * (path.length - 1)),
  );
  const a = path[Math.floor(at)]!;
  const b = path[Math.min(path.length - 1, Math.ceil(at))]!;
  const x = cx(a.x + (b.x - a.x) * (at % 1)) + 6;
  const y = cy(a.y + (b.y - a.y) * (at % 1)) + 5;
  return (
    <g
      style={{
        transform: `translate(${x}px, ${y}px)`,
        transition: "transform 240ms linear",
      }}
    >
      <ellipse cx="2" cy="3" rx="4" ry="3" fill="#4e5f3d" opacity="0.2" />
      <circle r="3.3" fill={car.color} />
      <circle cy="-2" r="2.2" fill="#ead0af" />
    </g>
  );
}

function MapTile({
  tile,
  point,
  connection,
}: {
  tile: Tile;
  point: Point;
  connection?: ParkingConnection;
}) {
  const x = cx(point.x);
  const y = cy(point.y);
  if (tile.kind === "tree") return <Tree x={x} y={y} />;
  if (["lamp", "bench", "flowers"].includes(tile.kind))
    return (
      <g transform={`translate(${x} ${y}) rotate(${tile.rotation * 90})`}>
        <PropSprite kind={tile.kind} />
      </g>
    );
  if (tile.kind === "parking") {
    return (
      <g transform={`translate(${x} ${y})`}>
        {connection && <title>{parkingConnectionMessage(connection)}</title>}
        <ParkingBay tile={tile} disconnected={!!connection?.issue} />
      </g>
    );
  }
  if (tile.kind === "roundabout")
    return (
      <g transform={`translate(${x} ${y})`}>
        <circle r="25" fill="#dbe5c7" stroke="#b7c7a2" strokeWidth="2" />
        <circle r="16" fill="#c1d3a8" />
        <Tree x={0} y={0} small />
        <path
          d="M-36-14q-5 13 0 22m-3-3 3 3 3-3M36 14q5-13 0-22m3 3-3-3-3 3"
          stroke="#bac5aa"
          fill="none"
          strokeWidth="1.5"
        />
      </g>
    );
  return null;
}

export function PropSprite({ kind }: { kind: string }) {
  if (kind === "lamp")
    return (
      <g>
        <path
          d="m0 8 12 9"
          stroke="#526244"
          strokeOpacity=".14"
          strokeWidth="5"
        />
        <circle cy="9" r="4" fill="#899779" />
        <path d="M0 8V-9h10" stroke="#65725d" strokeWidth="2.5" fill="none" />
        <rect
          x="7"
          y="-12"
          width="10"
          height="6"
          rx="2"
          fill="#94a18a"
          stroke="#697b5c"
        />
        <rect x="9" y="-10" width="6" height="2" rx="1" fill="#faf0c3" />
      </g>
    );
  if (kind === "bench")
    return (
      <g>
        <rect
          x="-10"
          y="-3"
          width="26"
          height="14"
          rx="2"
          fill="#536247"
          opacity=".14"
        />
        {[-6, -2, 2, 6].map((y) => (
          <path
            key={y}
            d={`M-12 ${y}h24`}
            stroke="#ad8e69"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
        ))}
        <path d="M-8-9v18M8-9v18" stroke="#6f7e60" strokeWidth="2" />
      </g>
    );
  return (
    <g>
      <ellipse cx="3" cy="4" rx="15" ry="11" fill="#526244" opacity=".12" />
      <rect x="-14" y="-12" width="28" height="24" rx="9" fill="#b1c68e" />
      {[
        [-7, -4],
        [2, -6],
        [8, 1],
        [-3, 4],
      ].map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="4" fill={i % 2 ? "#d4ae9b" : "#e6d0a0"} />
          <circle cx={x} cy={y} r="1.4" fill="#f7ebba" />
        </g>
      ))}
    </g>
  );
}

export interface GameMapProps {
  state: ParkingState;
  connections: ReturnType<typeof infrastructure>;
  tool: Tool;
  rotation: number;
  gridVisible: boolean;
  zoom: number;
  pan: Point;
  selection: Point | null;
  setPan: (pan: Point) => void;
  onPlace: (tool: Tool, point: Point, rotation: number) => void;
  onSelect: (point: Point) => void;
}

export function GameMap({
  state,
  connections,
  tool,
  rotation,
  gridVisible,
  zoom,
  pan,
  selection,
  setPan,
  onPlace,
  onSelect,
}: GameMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({
    width: WORLD_WIDTH,
    height: WORLD_HEIGHT,
  });
  const [hover, setHover] = useState<Point | null>(null);
  const dragging = useRef(false);
  const visited = useRef(new Set<string>());
  const lastPaint = useRef<Point | null>(null);
  const dragStart = useRef<{ x: number; y: number; pan: Point } | null>(null);
  const { grid } = state;
  const spotConnections = new Map(
    connections.spotConnections.map((connection) => [
      `${connection.point.x},${connection.point.y}`,
      connection,
    ]),
  );
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry && entry.contentRect.width && entry.contentRect.height)
        setSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
    });
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);
  const scale =
    Math.min(size.width / WORLD_WIDTH, size.height / WORLD_HEIGHT) * zoom;
  const viewWidth = size.width / scale;
  const viewHeight = size.height / scale;
  const roadPaths = useMemo(() => {
    const collect = (publicOnly: boolean) => {
      const segments: string[] = [];
      grid.forEach((row, y) =>
        row.forEach((tile, x) => {
          if (!isRoad(tile) || (publicOnly ? !tile.fixed : tile.fixed)) return;
          segments.push(`M${cx(x)} ${cy(y)}h.01`);
          if (
            isRoad(grid[y]?.[x + 1]) &&
            (!publicOnly || grid[y]![x + 1]!.fixed)
          )
            segments.push(`M${cx(x)} ${cy(y)}H${cx(x + 1)}`);
          if (
            isRoad(grid[y + 1]?.[x]) &&
            (!publicOnly || grid[y + 1]![x]!.fixed)
          )
            segments.push(`M${cx(x)} ${cy(y)}V${cy(y + 1)}`);
        }),
      );
      return segments.join(" ");
    };
    return {
      all: collect(false),
      public:
        collect(true) +
        ` M${cx(3)} -5000V${cy(0)} M${cx(3)} ${cy(ROWS - 1)}V${WORLD_HEIGHT + 5000} M-5000 ${cy(30)}H${cx(0)} M${cx(COLS - 1)} ${cy(30)}H${WORLD_WIDTH + 5000}`,
    };
  }, [grid]);
  const pointAt = (event: {
    clientX: number;
    clientY: number;
  }): Point | null => {
    const matrix = svgRef.current?.getScreenCTM();
    if (!matrix) return null;
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(
      matrix.inverse(),
    );
    const point = {
      x: Math.floor((p.x - ORIGIN.x) / CELL),
      y: Math.floor((p.y - ORIGIN.y) / CELL),
    };
    return inBounds(point) ? point : null;
  };
  const paintOne = (p: Point) => {
    const id = `${p.x},${p.y}`;
    if (!visited.current.has(id)) {
      visited.current.add(id);
      onPlace(tool, p, rotation);
    }
  };
  const paint = (p: Point) => {
    const previous = lastPaint.current;
    if (previous) {
      let x = previous.x,
        y = previous.y;
      while (x !== p.x || y !== p.y) {
        if (x !== p.x) x += Math.sign(p.x - x);
        paintOne({ x, y });
        if (y !== p.y) y += Math.sign(p.y - y);
        paintOne({ x, y });
      }
    } else paintOne(p);
    lastPaint.current = p;
  };
  const ghost =
    hover && tool !== "select" ? build(state, tool, hover, rotation) : null;
  const selectedTile = selection ? grid[selection.y]?.[selection.x] : undefined;
  const selectedCells = selection
    ? selectedTile?.group
      ? grid.flatMap((row, y) =>
          row.flatMap((tile, x) =>
            tile.group === selectedTile.group ? [{ x, y }] : [],
          ),
        )
      : [selection]
    : [];
  const selectedBounds = selectedCells.length
    ? {
        left: Math.min(...selectedCells.map((p) => p.x)),
        right: Math.max(...selectedCells.map((p) => p.x)),
        top: Math.min(...selectedCells.map((p) => p.y)),
        bottom: Math.max(...selectedCells.map((p) => p.y)),
      }
    : null;

  return (
    <svg
      ref={svgRef}
      viewBox={`${(WORLD_WIDTH - viewWidth) / 2 + pan.x} ${(WORLD_HEIGHT - viewHeight) / 2 + pan.y} ${viewWidth} ${viewHeight}`}
      className={`h-full w-full touch-none select-none outline-none ${tool === "select" ? "cursor-grab active:cursor-grabbing" : "cursor-crosshair"}`}
      role="application"
      aria-label="Terrain de construction"
      tabIndex={0}
      onKeyDown={(event) => {
        if (
          ![
            "ArrowUp",
            "ArrowDown",
            "ArrowLeft",
            "ArrowRight",
            "Enter",
          ].includes(event.key)
        )
          return;
        event.preventDefault();
        event.stopPropagation();
        const p = hover ?? { x: 20, y: 10 };
        if (event.key === "Enter") {
          setHover(p);
          if (tool === "select") onSelect(p);
          else onPlace(tool, p, rotation);
          return;
        }
        setHover({
          x: Math.max(
            0,
            Math.min(
              COLS - 1,
              p.x +
                (event.key === "ArrowRight"
                  ? 1
                  : event.key === "ArrowLeft"
                    ? -1
                    : 0),
            ),
          ),
          y: Math.max(
            0,
            Math.min(
              ROWS - 1,
              p.y +
                (event.key === "ArrowDown"
                  ? 1
                  : event.key === "ArrowUp"
                    ? -1
                    : 0),
            ),
          ),
        });
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        const p = pointAt(event);
        if (p) onSelect(p);
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        dragging.current = true;
        visited.current.clear();
        lastPaint.current = null;
        if (tool === "select") {
          dragStart.current = { x: event.clientX, y: event.clientY, pan };
          return;
        }
        const p = pointAt(event);
        if (p) paint(p);
      }}
      onPointerMove={(event) => {
        const p = pointAt(event);
        setHover(p);
        if (!dragging.current) return;
        if (tool === "select" && dragStart.current)
          setPan({
            x:
              dragStart.current.pan.x -
              (event.clientX - dragStart.current.x) / scale,
            y:
              dragStart.current.pan.y -
              (event.clientY - dragStart.current.y) / scale,
          });
        else if (
          p &&
          [
            "road",
            "parking",
            "tree",
            "lamp",
            "bench",
            "flowers",
            "erase",
          ].includes(tool)
        )
          paint(p);
      }}
      onPointerUp={(event) => {
        if (
          dragStart.current &&
          Math.hypot(
            event.clientX - dragStart.current.x,
            event.clientY - dragStart.current.y,
          ) < 5
        ) {
          const p = pointAt(event);
          if (p) onSelect(p);
        }
        dragging.current = false;
        dragStart.current = null;
        lastPaint.current = null;
      }}
      onPointerCancel={() => {
        dragging.current = false;
        dragStart.current = null;
        lastPaint.current = null;
      }}
      onPointerLeave={() => {
        if (!dragging.current) setHover(null);
      }}
    >
      <defs>
        <pattern
          id="build-grid"
          width={CELL}
          height={CELL}
          patternUnits="userSpaceOnUse"
          x={ORIGIN.x}
          y={ORIGIN.y}
        >
          <path
            d={`M${CELL} 0H0V${CELL}`}
            fill="none"
            stroke="#9eb28e"
            strokeWidth=".65"
            opacity=".5"
          />
        </pattern>
        <pattern
          id="grass-specks"
          width="57"
          height="47"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="m8 9 1-3m2 3 1-2m25 24 1-3m2 3 1-2"
            stroke="#b4c69a"
            strokeWidth="1"
            opacity=".45"
          />
        </pattern>
      </defs>
      <rect x="-5000" y="-5000" width="12000" height="12000" fill="#e2e9d6" />
      <path
        d={`M-200-200Q300 0 150 350T100 ${WORLD_HEIGHT + 200}H-200Z`}
        fill="#d6e2c7"
      />
      <path
        d={`M${WORLD_WIDTH - 150}-200Q${WORLD_WIDTH - 350} 400 ${WORLD_WIDTH - 50} 700T${WORLD_WIDTH + 300} ${WORLD_HEIGHT + 100}V-200Z`}
        fill="#d6e2c7"
      />
      <rect
        x="-200"
        y="-200"
        width={WORLD_WIDTH + 400}
        height={WORLD_HEIGHT + 400}
        fill="url(#grass-specks)"
      />
      <rect
        x={ORIGIN.x + BUILD_BOUNDS.left * CELL}
        y={ORIGIN.y + BUILD_BOUNDS.top * CELL}
        width={(BUILD_BOUNDS.right - BUILD_BOUNDS.left) * CELL}
        height={(BUILD_BOUNDS.bottom - BUILD_BOUNDS.top) * CELL}
        rx="8"
        fill="#deE8ce"
        stroke="#a8bb92"
        strokeDasharray="6 7"
        strokeWidth="1.5"
      />
      <path
        d={roadPaths.public}
        stroke="#b5c0a7"
        strokeWidth="53"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d={roadPaths.all}
        stroke="#b2bea5"
        strokeWidth="36"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={roadPaths.public}
        stroke="#f8f7ed"
        strokeWidth="48"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d={roadPaths.all}
        stroke="#faf9ef"
        strokeWidth="32"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={roadPaths.all}
        stroke="#c0c9b1"
        strokeWidth="1"
        strokeDasharray="4 9"
        fill="none"
      />
      <path
        d={roadPaths.public}
        stroke="#c9b97b"
        strokeWidth="1.4"
        strokeDasharray="10 9"
        fill="none"
      />
      {grid.flatMap((row, y) =>
        row.map((tile, x) =>
          tile.kind === "path" ? (
            <rect
              key={`path-${x}-${y}`}
              x={ORIGIN.x + x * CELL}
              y={ORIGIN.y + y * CELL}
              width={CELL}
              height={CELL}
              fill="#e8e7d9"
              stroke="#d8ddca"
              strokeWidth=".6"
            />
          ) : null,
        ),
      )}
      {grid.flatMap((row, y) =>
        row.map((tile, x) =>
          ![
            "grass",
            "road",
            "path",
            "store",
            "entry",
            "gate",
            "crossing",
          ].includes(tile.kind) ? (
            <MapTile
              key={`${x}-${y}`}
              tile={tile}
              point={{ x, y }}
              connection={spotConnections.get(`${x},${y}`)}
            />
          ) : null,
        ),
      )}
      <Shop level={state.level} grid={grid} />
      {[
        { x: 0.5, y: 4 },
        { x: 0.2, y: 15 },
        { x: 1, y: 25 },
        { x: 45.4, y: 3 },
        { x: 45.3, y: 15 },
        { x: 45.2, y: 26 },
        { x: 14, y: 32.5 },
        { x: 35, y: 32.5 },
      ].map((p, i) => (
        <Tree key={i} x={cx(p.x)} y={cy(p.y)} />
      ))}
      {grid.flatMap((row, y) =>
        row.map((tile, x) =>
          tile.kind === "crossing" ? (
            <g key={`${x}-${y}`} transform={`translate(${cx(x)} ${cy(y)})`}>
              <Crossing vertical={tile.rotation % 2 === 1} />
            </g>
          ) : tile.kind === "gate" || tile.kind === "entry" ? (
            <g key={`${x}-${y}`} transform={`translate(${cx(x)} ${cy(y)})`}>
              <title>
                {tile.kind === "entry" ? "Entrée" : "Sortie"} ·{" "}
                {(tile.kind === "entry"
                  ? connections.entries
                  : connections.gates
                ).some((p) => p.x === x && p.y === y)
                  ? "reliée à la rue"
                  : "à relier à la rue publique"}
              </title>
              <Barrier
                entry={tile.kind === "entry"}
                rotation={tile.rotation}
                open={state.cars.some(
                  (car) =>
                    car.phase !== "shopping" &&
                    Math.hypot(
                      positionOnPath(car).x - x,
                      positionOnPath(car).y - y,
                    ) < 1.6,
                )}
              />
            </g>
          ) : null,
        ),
      )}
      <g pointerEvents="none">
        {state.cars.map((car) => {
          const p = positionOnPath(car);
          const parked = car.phase === "shopping";
          const angle = parked
            ? grid[car.spot.y]![car.spot.x]!.rotation * 90
            : p.angle;
          return (
            <g
              key={car.id}
              style={{
                transform: `translate(${cx(p.x) + (parked ? 0 : Math.cos((p.angle * Math.PI) / 180) * 4)}px, ${cy(p.y) + (parked ? 0 : Math.sin((p.angle * Math.PI) / 180) * 4)}px) rotate(${angle}deg)`,
                transition: "transform 240ms linear",
              }}
            >
              <CarSprite color={car.color} />
            </g>
          );
        })}
        {state.cars.map((car) => (
          <Pedestrian key={car.id} car={car} grid={grid} />
        ))}
      </g>
      {(gridVisible || tool !== "select") && (
        <rect
          x={ORIGIN.x + BUILD_BOUNDS.left * CELL}
          y={ORIGIN.y + BUILD_BOUNDS.top * CELL}
          width={(BUILD_BOUNDS.right - BUILD_BOUNDS.left) * CELL}
          height={(BUILD_BOUNDS.bottom - BUILD_BOUNDS.top) * CELL}
          fill="url(#build-grid)"
          pointerEvents="none"
          opacity={gridVisible ? 0.9 : 0.45}
        />
      )}
      {selectedBounds && (
        <rect
          x={ORIGIN.x + selectedBounds.left * CELL - 2}
          y={ORIGIN.y + selectedBounds.top * CELL - 2}
          width={(selectedBounds.right - selectedBounds.left + 1) * CELL + 4}
          height={(selectedBounds.bottom - selectedBounds.top + 1) * CELL + 4}
          rx="4"
          fill="#487c5b"
          fillOpacity=".12"
          stroke="#3d7654"
          strokeWidth="2.2"
          pointerEvents="none"
        />
      )}
      {hover && tool !== "select" && (
        <g
          transform={`translate(${cx(hover.x)} ${cy(hover.y)})`}
          pointerEvents="none"
        >
          <rect
            x={tool === "roundabout" ? -48 : -16}
            y={tool === "roundabout" ? -48 : -16}
            width={tool === "roundabout" ? 96 : 32}
            height={tool === "roundabout" ? 96 : 32}
            rx="3"
            fill={ghost?.error ? "#c77967" : "#7da883"}
            fillOpacity=".35"
            stroke={ghost?.error ? "#a65f50" : "#487e59"}
            strokeWidth="1.5"
          />
          {tool === "parking" && (
            <g opacity=".7">
              <ParkingBay tile={{ kind: "parking", rotation }} />
            </g>
          )}
          {["lamp", "bench", "flowers"].includes(tool) && (
            <g transform={`rotate(${rotation * 90})`} opacity=".8">
              <PropSprite kind={tool} />
            </g>
          )}
          {tool === "tree" && <Tree x={0} y={0} />}
          {tool === "crossing" && <Crossing vertical={rotation % 2 === 1} />}
          {(tool === "entry" || tool === "gate") && (
            <Barrier entry={tool === "entry"} rotation={rotation} />
          )}
          {tool === "erase" && (
            <path d="m-5-5 10 10M5-5-5 5" stroke="#a65f50" strokeWidth="2" />
          )}
        </g>
      )}
      {hover && tool === "select" && !selection && (
        <rect
          x={ORIGIN.x + hover.x * CELL}
          y={ORIGIN.y + hover.y * CELL}
          width={CELL}
          height={CELL}
          fill="#6e8d5f"
          fillOpacity=".12"
          stroke="#8ba575"
          strokeWidth="1"
          pointerEvents="none"
        />
      )}
    </svg>
  );
}
