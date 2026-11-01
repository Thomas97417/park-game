import { useMemo, useRef, useState, type PointerEvent } from "react";
import {
  COLS,
  ROWS,
  CELL,
  ORIGIN,
  STORE_DOOR,
  build,
  findPath,
  inBounds,
  isRoad,
  parkingAccess,
  positionOnPath,
  type Car,
  type ParkingState,
  type Point,
  type Tile,
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
      {disconnected && <circle cx="10" cy="9" r="3" fill="#d59b5e" />}
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

function Shop({ level }: { level: number }) {
  const info = LEVELS[level]!;
  const width = level === 0 ? 352 : level === 1 ? 416 : 544;
  return (
    <g
      transform={`translate(${cx(16) - width / 2} ${ORIGIN.y + (level === 2 ? 1 : 2) * CELL}) scale(${width / 416} ${level === 2 ? 1.2 : 1})`}
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
      <text
        x="192"
        y="86"
        textAnchor="middle"
        fontSize="6.5"
        letterSpacing="2.1"
        fill="#d6e0c9"
        fontFamily="sans-serif"
      >
        FRAIS · LOCAL · DE SAISON
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
      <text
        x="208"
        y="179"
        textAnchor="middle"
        fontSize="5"
        fill="#7a8b76"
        letterSpacing="1"
      >
        BIENVENUE
      </text>
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
    () => findPath(grid, car.spot, STORE_DOOR, true),
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
  grid,
}: {
  tile: Tile;
  point: Point;
  grid: Tile[][];
}) {
  const x = cx(point.x);
  const y = cy(point.y);
  if (tile.kind === "tree") return <Tree x={x} y={y} />;
  if (tile.kind === "parking") {
    const a = parkingAccess(point, tile.rotation);
    return (
      <g transform={`translate(${x} ${y})`}>
        <ParkingBay tile={tile} disconnected={!isRoad(grid[a.y]?.[a.x])} />
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

export interface GameMapProps {
  state: ParkingState;
  tool: Tool;
  rotation: number;
  gridVisible: boolean;
  zoom: number;
  pan: Point;
  setPan: (pan: Point) => void;
  onPlace: (tool: Tool, point: Point, rotation: number) => void;
  onInspect: (point: Point) => void;
}

export function GameMap({
  state,
  tool,
  rotation,
  gridVisible,
  zoom,
  pan,
  setPan,
  onPlace,
  onInspect,
}: GameMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<Point | null>(null);
  const dragging = useRef(false);
  const visited = useRef(new Set<string>());
  const dragStart = useRef<{ x: number; y: number; pan: Point } | null>(null);
  const { grid } = state;
  const roadPath = useMemo(() => {
    const segments: string[] = [];
    grid.forEach((row, y) =>
      row.forEach((tile, x) => {
        if (!isRoad(tile)) return;
        segments.push(`M${cx(x)} ${cy(y)}h.01`);
        if (isRoad(grid[y]?.[x + 1]))
          segments.push(`M${cx(x)} ${cy(y)}H${cx(x + 1)}`);
        if (isRoad(grid[y + 1]?.[x]))
          segments.push(`M${cx(x)} ${cy(y)}V${cy(y + 1)}`);
      }),
    );
    return segments.join(" ");
  }, [grid]);
  const pointAt = (event: PointerEvent<SVGSVGElement>): Point | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const matrix = svg.getScreenCTM();
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
  const paint = (p: Point) => {
    const id = `${p.x},${p.y}`;
    if (visited.current.has(id)) return;
    visited.current.add(id);
    onPlace(tool, p, rotation);
  };
  const ghost =
    hover && tool !== "select" ? build(state, tool, hover, rotation) : null;
  const ghostValid = ghost && !ghost.error;
  const viewWidth = 1120 / zoom;
  const viewHeight = 800 / zoom;

  return (
    <svg
      ref={svgRef}
      viewBox={`${(1120 - viewWidth) / 2 + pan.x} ${(800 - viewHeight) / 2 + pan.y} ${viewWidth} ${viewHeight}`}
      className={`h-full w-full touch-none select-none outline-none ${tool === "select" ? "cursor-grab active:cursor-grabbing" : "cursor-crosshair"}`}
      role="application"
      aria-label="Carte du parking. Flèches pour choisir une case, Entrée pour construire. R pour tourner la place."
      tabIndex={0}
      onKeyDown={(event) => {
        if (
          ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter"].includes(
            event.key,
          )
        ) {
          event.preventDefault();
          event.stopPropagation();
          const p = hover ?? { x: 14, y: 10 };
          if (event.key === "Enter") {
            if (tool === "select") onInspect(p);
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
        }
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        const p = pointAt(event);
        dragging.current = true;
        visited.current.clear();
        if (tool === "select") {
          dragStart.current = { x: event.clientX, y: event.clientY, pan };
          return;
        }
        if (p) paint(p);
      }}
      onPointerMove={(event) => {
        const p = pointAt(event);
        setHover(p);
        if (!dragging.current) return;
        if (tool === "select" && dragStart.current) {
          const rect = svgRef.current!.getBoundingClientRect();
          const scale = Math.max(
            viewWidth / rect.width,
            viewHeight / rect.height,
          );
          setPan({
            x:
              dragStart.current.pan.x -
              (event.clientX - dragStart.current.x) * scale,
            y:
              dragStart.current.pan.y -
              (event.clientY - dragStart.current.y) * scale,
          });
        } else if (p && ["road", "parking", "tree", "erase"].includes(tool))
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
          if (p) onInspect(p);
        }
        dragging.current = false;
        dragStart.current = null;
      }}
      onPointerCancel={() => {
        dragging.current = false;
        dragStart.current = null;
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
            d={`M ${CELL} 0 H0 V${CELL}`}
            fill="none"
            stroke="#8ea47b"
            strokeWidth="0.65"
            opacity="0.35"
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
            stroke="#b9cca0"
            strokeWidth="1"
            opacity="0.5"
          />
        </pattern>
      </defs>
      <rect x="-3000" y="-3000" width="7000" height="7000" fill="#e2e9d6" />
      <path
        d="M225-100q150 100 100 230T190 380 330 600 95 1000H-100V-100Z"
        fill="#d6e2c7"
      />
      <path
        d="M940-100Q1100 140 1000 270T1010 630 1300 800V-100Z"
        fill="#d5e1c4"
      />
      <rect
        x="-200"
        y="-200"
        width="1600"
        height="1200"
        fill="url(#grass-specks)"
      />
      <rect
        x={cx(7) - 24}
        y={cy(9) - 24}
        width="624"
        height="272"
        rx="22"
        fill="#d6ddca"
        opacity="0.65"
      />
      <rect
        x={cx(9) - 10}
        y={cy(12) - 8}
        width="470"
        height="65"
        rx="21"
        fill="#cbdab5"
      />
      <path
        d={`M${cx(3)} -500V1400M-500 ${cy(20)}H1700`}
        fill="none"
        stroke="#b7c1aa"
        strokeWidth="55"
      />
      <path
        d={`M${cx(3)} -500V1400M-500 ${cy(20)}H1700`}
        fill="none"
        stroke="#f6f5e9"
        strokeWidth="49"
      />
      <path
        d={roadPath}
        fill="none"
        stroke="#b5c1a9"
        strokeWidth="36"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={roadPath}
        fill="none"
        stroke="#faf9ef"
        strokeWidth="32"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={`M${cx(3)} -500V1400M-500 ${cy(20)}H1700`}
        fill="none"
        stroke="#faf9ef"
        strokeWidth="32"
      />
      <path
        d={`M${cx(3)} -500V1400M-500 ${cy(20)}H1700`}
        fill="none"
        stroke="#cfbe7e"
        strokeWidth="1.4"
        strokeDasharray="10 9"
      />
      <path
        d={roadPath}
        fill="none"
        stroke="#c4cbb7"
        strokeWidth="1"
        strokeDasharray="4 8"
        opacity="0.65"
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
              strokeWidth="0.6"
            />
          ) : null,
        ),
      )}
      <rect
        x={ORIGIN.x + 5 * CELL}
        y={ORIGIN.y + CELL}
        width={24 * CELL}
        height={18 * CELL}
        rx="13"
        fill="none"
        stroke="#a9bb92"
        strokeWidth="1.5"
        strokeDasharray="5 7"
        opacity="0.75"
      />
      <g fill="#98aa84" fontFamily="sans-serif" fontSize="7" letterSpacing="2">
        <text
          x={cx(26.3)}
          y={cy(10.5)}
          transform={`rotate(90 ${cx(26.3)} ${cy(10.5)})`}
        >
          LIMITE DU TERRAIN
        </text>
        <text
          x={cx(1.1)}
          y={cy(8.5)}
          transform={`rotate(-90 ${cx(1.1)} ${cy(8.5)})`}
        >
          AVENUE DES TILLEULS
        </text>
      </g>
      {grid.flatMap((row, y) =>
        row.map((tile, x) => (
          <MapTile key={`${x}-${y}`} tile={tile} point={{ x, y }} grid={grid} />
        )),
      )}
      <Shop level={state.level} />
      <g fill="#a3af97" fontFamily="sans-serif" fontSize="10" opacity="0.9">
        <text x={cx(11)} y={cy(9) + 3}>
          →
        </text>
        <text x={cx(20)} y={cy(9) + 3}>
          →
        </text>
        <text x={cx(24)} y={cy(16) + 3}>
          ←
        </text>
        <text x={cx(12)} y={cy(16) + 3}>
          ←
        </text>
        <text x={cx(7) - 4} y={cy(11) + 3}>
          ↑
        </text>
        <text x={cx(25) - 4} y={cy(13) + 3}>
          ↓
        </text>
      </g>
      <g transform={`translate(${cx(15)} ${cy(12.6)})`}>
        <path
          d="M-18-5h36M-18-1h36M-17 3h34"
          stroke="#aa9980"
          strokeWidth="2.8"
          strokeLinecap="round"
        />
        <path d="M-13 5v4M13 5v4" stroke="#7c8971" strokeWidth="2" />
      </g>
      <g transform={`translate(${cx(17)} ${cy(12.6)})`}>
        <rect x="-5" y="-7" width="10" height="13" rx="2" fill="#98ac81" />
        <path d="M-6-7H6M-2-4v7M2-4v7" stroke="#7d9569" strokeWidth="1.5" />
      </g>
      {[
        [14, 13],
        [18, 13],
        [10, 18],
        [23, 6],
      ].map(([x, y], i) => (
        <g key={i} transform={`translate(${cx(x!)} ${cy(y!)})`}>
          <circle r="5" fill="#b1bf86" />
          <circle cx="-3" cy="-1" r="2" fill="#d4b183" />
          <circle cx="2" cy="-3" r="1.8" fill="#e2d4a6" />
          <circle cx="2" cy="2" r="2" fill="#cf9a8d" />
        </g>
      ))}
      {[
        [8, 8],
        [24, 8],
        [8, 17],
        [24, 17],
      ].map(([x, y], i) => (
        <g key={i} transform={`translate(${cx(x!)} ${cy(y!)})`}>
          <path
            d="m0 0 9 8"
            stroke="#667456"
            strokeOpacity="0.15"
            strokeWidth="4"
          />
          <circle r="3" fill="#8a9a79" />
          <path d="M0 0v-12h6" stroke="#7b8c6e" strokeWidth="1.5" fill="none" />
          <rect x="3" y="-14" width="6" height="4" rx="1" fill="#cdd4b9" />
        </g>
      ))}
      {[
        { x: 0.5, y: 4 },
        { x: 0.3, y: 13 },
        { x: 1, y: 17 },
        { x: 28.5, y: 1 },
        { x: 29, y: 12 },
        { x: 15, y: 22.5 },
        { x: 22, y: 22.5 },
      ].map((p, i) => (
        <Tree key={i} x={cx(p.x)} y={cy(p.y)} />
      ))}
      <g transform={`translate(${cx(8)} ${cy(10.7)})`}>
        <rect x="-7" y="-12" width="14" height="14" rx="3" fill="#7e9aa4" />
        <text
          x="0"
          y="-2"
          fill="#fcfcf1"
          fontSize="11"
          fontWeight="700"
          fontFamily="sans-serif"
          textAnchor="middle"
        >
          P
        </text>
        <path d="M0 2v8" stroke="#91a48c" strokeWidth="2" />
      </g>
      {grid.flatMap((row, y) =>
        row.map((tile, x) => {
          if (tile.kind === "crossing")
            return (
              <g
                key={`cross-${x}-${y}`}
                transform={`translate(${cx(x)} ${cy(y)})`}
              >
                <Crossing vertical={tile.rotation % 2 === 1} />
              </g>
            );
          if (tile.kind === "gate" || tile.kind === "entry")
            return (
              <g
                key={`gate-${x}-${y}`}
                transform={`translate(${cx(x)} ${cy(y)})`}
              >
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
            );
          return null;
        }),
      )}
      <g pointerEvents="none">
        {state.cars.map((car) => {
          const p = positionOnPath(car);
          const angle =
            car.phase === "shopping"
              ? grid[car.spot.y]![car.spot.x]!.rotation * 90
              : p.angle;
          const offsetX =
            car.phase === "shopping"
              ? 0
              : Math.cos((p.angle * Math.PI) / 180) * 4;
          const offsetY =
            car.phase === "shopping"
              ? 0
              : Math.sin((p.angle * Math.PI) / 180) * 4;
          return (
            <g
              key={car.id}
              style={{
                transform: `translate(${cx(p.x) + offsetX}px, ${cy(p.y) + offsetY}px) rotate(${angle}deg)`,
                transition: "transform 240ms linear",
              }}
            >
              <CarSprite color={car.color} />
              {car.paid && car.progress < car.path.length - 7 && (
                <circle cy="-22" r="3" fill="#91b682" />
              )}
            </g>
          );
        })}
        {state.cars.map((car) => (
          <Pedestrian key={`person-${car.id}`} car={car} grid={grid} />
        ))}
      </g>
      {(gridVisible || tool !== "select") && (
        <rect
          x={ORIGIN.x}
          y={ORIGIN.y}
          width={COLS * CELL}
          height={ROWS * CELL}
          fill="url(#build-grid)"
          pointerEvents="none"
          opacity={gridVisible ? 0.8 : 0.4}
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
            fill={ghostValid ? "#7da883" : "#c77967"}
            fillOpacity="0.35"
            stroke={ghostValid ? "#487e59" : "#ae6656"}
            strokeWidth="1.5"
          />
          {tool === "parking" && (
            <g opacity="0.65">
              <ParkingBay tile={{ kind: "parking", rotation }} />
              <path
                d="M0-13v-6m-3 3 3-3 3 3"
                fill="none"
                stroke="#487e59"
                strokeWidth="2"
                transform={`rotate(${rotation * 90})`}
              />
            </g>
          )}
          {tool === "tree" && (
            <g opacity="0.7">
              <Tree x={0} y={0} />
            </g>
          )}
          {tool === "crossing" && <Crossing vertical={rotation % 2 === 1} />}
          {(tool === "gate" || tool === "entry") && (
            <Barrier entry={tool === "entry"} rotation={rotation} />
          )}
          {tool === "erase" && (
            <path d="m-5-5 10 10M5-5-5 5" stroke="#ae6656" strokeWidth="2" />
          )}
        </g>
      )}
    </svg>
  );
}
