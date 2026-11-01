import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";
import type { RoadType } from "@/game/catalog";

export type GameIcon = ComponentType<LucideProps>;
const ink = "#4b6740";
const sage = "#b9cda1";
const pale = "#e4ecd8";
const cream = "#fffdf1";
const gold = "#d2b375";
const clay = "#c68f79";

function Frame({ size = 24, children, ...props }: LucideProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}
export function RoadIcon(props: LucideProps) {
  return (
    <Frame {...props}>
      <rect
        x="4"
        y="2"
        width="16"
        height="20"
        rx="3"
        fill={pale}
        stroke={ink}
        strokeWidth="1.4"
      />
      <path d="M7 3v18M17 3v18" stroke={cream} strokeWidth="2" />
      <path d="M12 4v3m0 4v3m0 4v2" stroke={gold} strokeWidth="1.7" />
    </Frame>
  );
}
export function RoadTypeIcon({
  variant = "standard",
  ...props
}: LucideProps & { variant?: RoadType }) {
  const oneWay = variant === "oneWay" || variant === "wideOneWay";
  const width = variant === "oneWay" ? 12 : variant === "standard" ? 16 : 21;
  return (
    <Frame {...props}>
      <rect
        x={(24 - width) / 2}
        y="1"
        width={width}
        height="22"
        rx="3"
        fill={pale}
        stroke={ink}
        strokeWidth="1.2"
      />
      {variant !== "oneWay" && (
        <path
          d="M12 3v3m0 4v4m0 4v3"
          stroke={oneWay ? cream : gold}
          strokeWidth="1.3"
        />
      )}
      {(variant === "oneWay" ? [12] : [7, 17]).map((x, index) => (
        <path
          key={x}
          d="M0 4V-4m-2.5 2.5L0-4l2.5 2.5"
          transform={`translate(${x} 12) ${!oneWay && index === 0 ? "rotate(180)" : ""}`}
          fill="none"
          stroke={ink}
          strokeWidth="1.3"
        />
      ))}
    </Frame>
  );
}
export function ParkingIcon(props: LucideProps) {
  return (
    <Frame {...props}>
      <rect
        x="3"
        y="2.5"
        width="18"
        height="18"
        rx="4"
        fill={sage}
        stroke={ink}
        strokeWidth="1.4"
      />
      <path d="M9 16V7h4a3 3 0 0 1 0 6H9" stroke={cream} strokeWidth="2.3" />
      <path d="M7 22h10" stroke={ink} strokeWidth="1.5" />
    </Frame>
  );
}
export function CrossingIcon(props: LucideProps) {
  return (
    <Frame {...props}>
      <rect
        x="2"
        y="4"
        width="20"
        height="16"
        rx="3"
        fill={pale}
        stroke={ink}
        strokeWidth="1.3"
      />
      {[5, 9, 13, 17].map((x) => (
        <path key={x} d={`M${x} 8v8`} stroke={cream} strokeWidth="2.8" />
      ))}
      <path d="M4 6h16M4 18h16" stroke={gold} strokeWidth="1.2" />
    </Frame>
  );
}
export function BarrierIcon(props: LucideProps) {
  return (
    <Frame {...props}>
      <rect
        x="3"
        y="9"
        width="5"
        height="12"
        rx="1.5"
        fill={gold}
        stroke={ink}
        strokeWidth="1.3"
      />
      <rect
        x="5"
        y="6"
        width="17"
        height="5"
        rx="1.2"
        fill={cream}
        stroke={ink}
        strokeWidth="1.2"
      />
      <path d="m9 6 3 5m4-5 3 5" stroke={clay} strokeWidth="2.5" />
      <circle cx="5.5" cy="15" r="1" fill={gold} />
      <path d="M2 22h7" stroke={ink} strokeWidth="1.3" />
      <circle
        cx="17.5"
        cy="17.5"
        r="5.5"
        fill={gold}
        stroke={ink}
        strokeWidth="1.2"
      />
      <text
        x="17.5"
        y="20.3"
        textAnchor="middle"
        fontFamily="sans-serif"
        fontSize="8"
        fontWeight="700"
        fill={ink}
        stroke="none"
      >
        €
      </text>
    </Frame>
  );
}
export function RoundaboutIcon(props: LucideProps) {
  return (
    <Frame {...props}>
      <circle
        cx="12"
        cy="12"
        r="9.5"
        fill={cream}
        stroke={ink}
        strokeWidth="1.3"
      />
      <circle cx="12" cy="12" r="5" fill={sage} stroke={ink} strokeWidth="1" />
      <path
        d="M6 7.5a7 7 0 0 1 11-.3m1 9a7 7 0 0 1-11 .3"
        stroke={ink}
        strokeWidth="1.4"
      />
      <path
        d="m15 7 2.5.5-.1-2.6M9 17l-2.5-.5.1 2.6"
        stroke={ink}
        strokeWidth="1.4"
      />
    </Frame>
  );
}
export function TreeIcon(props: LucideProps) {
  return (
    <Frame {...props}>
      <path d="M12 15v7" stroke="#9a8562" strokeWidth="2.3" />
      <path d="M7 22h10" stroke={ink} strokeWidth="1.3" />
      <circle
        cx="7.5"
        cy="10"
        r="5"
        fill={sage}
        stroke={ink}
        strokeWidth="1.1"
      />
      <circle
        cx="16"
        cy="10"
        r="5"
        fill="#9fba85"
        stroke={ink}
        strokeWidth="1.1"
      />
      <circle
        cx="12"
        cy="6.5"
        r="5"
        fill="#c8d9ad"
        stroke={ink}
        strokeWidth="1.1"
      />
    </Frame>
  );
}
export function EntranceIcon(props: LucideProps) {
  return (
    <Frame {...props}>
      <path d="M14 3h6v18h-6" fill={pale} stroke={ink} strokeWidth="1.5" />
      <path
        d="M3 9h8V5l7 7-7 7v-4H3Z"
        fill="#8eb28a"
        stroke={ink}
        strokeWidth="1.4"
      />
      <circle cx="18" cy="12" r="1" fill={gold} />
    </Frame>
  );
}
export function LampIcon(props: LucideProps) {
  return (
    <Frame {...props}>
      <path d="M7 21V7a4 4 0 0 1 4-4h5" stroke={ink} strokeWidth="2" />
      <path d="M3 22h8" stroke={ink} strokeWidth="1.6" />
      <path d="M13 3h6l2 5H11Z" fill={sage} stroke={ink} strokeWidth="1.3" />
      <path
        d="M14 9h4m-2 2v2m-5-3-1 1m11-1 1 1"
        stroke={gold}
        strokeWidth="1.4"
      />
    </Frame>
  );
}
export function BenchIcon(props: LucideProps) {
  return (
    <Frame {...props}>
      <rect
        x="3"
        y="5"
        width="18"
        height="8"
        rx="1.5"
        fill="#ccb38b"
        stroke={ink}
        strokeWidth="1.3"
      />
      <path d="M4 9h16" stroke="#9a825e" strokeWidth="1.2" />
      <rect
        x="2"
        y="14"
        width="20"
        height="3"
        rx="1"
        fill="#b69b76"
        stroke={ink}
        strokeWidth="1.2"
      />
      <path d="M6 13v9m12-9v9M4 22h4m8 0h4" stroke={ink} strokeWidth="1.7" />
    </Frame>
  );
}
export function FlowersIcon(props: LucideProps) {
  return (
    <Frame {...props}>
      <ellipse
        cx="12"
        cy="17"
        rx="10"
        ry="5"
        fill={sage}
        stroke={ink}
        strokeWidth="1.2"
      />
      <path d="M7 17v-6m5 7V8m5 9v-6" stroke={ink} strokeWidth="1.3" />
      {[
        [7, 9, clay],
        [12, 5, gold],
        [17, 9, "#c8a5af"],
      ].map(([x, y, color]) => (
        <g key={String(x)}>
          <circle cx={x} cy={y} r="3.5" fill={String(color)} />
          <circle cx={x} cy={y} r="1.2" fill={cream} />
        </g>
      ))}
    </Frame>
  );
}
export function TreasuryIcon(props: LucideProps) {
  return (
    <Frame {...props}>
      <path
        d="M4 7V5a2 2 0 0 1 2-2h11v4"
        fill={sage}
        stroke={ink}
        strokeWidth="1.4"
      />
      <rect
        x="2.5"
        y="7"
        width="19"
        height="14"
        rx="3"
        fill={pale}
        stroke={ink}
        strokeWidth="1.4"
      />
      <path
        d="M16 11h6v6h-6a3 3 0 0 1 0-6Z"
        fill={sage}
        stroke={ink}
        strokeWidth="1.2"
      />
      <circle cx="18" cy="14" r="1" fill={gold} />
    </Frame>
  );
}
export function IncomeIcon(props: LucideProps) {
  return (
    <Frame {...props}>
      <path
        d="M3 12v7c0 1.6 3 3 7 3s7-1.4 7-3v-7"
        fill="#e4cea2"
        stroke="#9b8253"
        strokeWidth="1.3"
      />
      <path
        d="M3 15.5c0 1.6 3 3 7 3s7-1.4 7-3"
        stroke="#aa8e58"
        strokeWidth="1.1"
      />
      <ellipse
        cx="10"
        cy="12"
        rx="7"
        ry="3"
        fill={gold}
        stroke="#9b8253"
        strokeWidth="1.3"
      />
      <path d="M17 9V2m-3 3 3-3 3 3" stroke={ink} strokeWidth="1.8" />
    </Frame>
  );
}
export function CarIcon(props: LucideProps) {
  return (
    <Frame {...props}>
      <path d="m5 10 2-6h10l2 6" fill={sage} stroke={ink} strokeWidth="1.4" />
      <rect
        x="3"
        y="10"
        width="18"
        height="9"
        rx="3"
        fill={pale}
        stroke={ink}
        strokeWidth="1.4"
      />
      <path d="M6 19v2m12-2v2M9 16h6" stroke={ink} strokeWidth="1.7" />
      <path d="M7 6h10" stroke={cream} strokeWidth="1.5" />
      <circle cx="7" cy="14" r="1.5" fill={gold} />
      <circle cx="17" cy="14" r="1.5" fill={gold} />
    </Frame>
  );
}
export function SatisfactionIcon(props: LucideProps) {
  return (
    <Frame {...props}>
      <circle
        cx="12"
        cy="12"
        r="9.5"
        fill={pale}
        stroke={ink}
        strokeWidth="1.4"
      />
      <circle cx="8.5" cy="10" r="1.2" fill={ink} />
      <circle cx="15.5" cy="10" r="1.2" fill={ink} />
      <path d="M7.5 14a5 5 0 0 0 9 0" stroke={ink} strokeWidth="1.6" />
      <path d="M4.5 13h2m11 0h2" stroke={clay} strokeWidth="1.8" />
    </Frame>
  );
}
export function ObjectivesIcon(props: LucideProps) {
  return (
    <Frame {...props}>
      <circle
        cx="11"
        cy="13"
        r="8.5"
        fill={pale}
        stroke={ink}
        strokeWidth="1.3"
      />
      <circle
        cx="11"
        cy="13"
        r="4.5"
        fill={cream}
        stroke={ink}
        strokeWidth="1.2"
      />
      <circle cx="11" cy="13" r="1.5" fill={gold} />
      <path d="m11 13 9-10m-1 0v4h4" stroke={ink} strokeWidth="1.8" />
    </Frame>
  );
}
export function ContractsIcon(props: LucideProps) {
  return (
    <Frame {...props}>
      <path
        d="M6 3h10l4 4v14H4V5a2 2 0 0 1 2-2Z"
        fill={pale}
        stroke={ink}
        strokeWidth="1.4"
      />
      <path d="M15 3v5h5M8 10h4M8 13h4" stroke={ink} strokeWidth="1.2" />
      <path d="m10 17 2 2 5-5" stroke="#79995f" strokeWidth="2" />
      <path d="M7 2h5v3H7Z" fill={gold} stroke="#9b8253" strokeWidth="1" />
    </Frame>
  );
}
export function FinanceIcon(props: LucideProps) {
  return (
    <Frame {...props}>
      <path d="M3 3v18h19" stroke={ink} strokeWidth="1.4" />
      <rect x="6" y="14" width="3" height="5" rx=".5" fill={sage} />
      <rect x="11" y="10" width="3" height="9" rx=".5" fill="#91ae72" />
      <rect x="16" y="5" width="3" height="14" rx=".5" fill={gold} />
      <path d="m6 10 5-4 3 1 6-5" stroke={ink} strokeWidth="1.4" />
    </Frame>
  );
}
export function HelpIcon(props: LucideProps) {
  return (
    <Frame {...props}>
      <circle
        cx="12"
        cy="12"
        r="9.5"
        fill={pale}
        stroke={ink}
        strokeWidth="1.4"
      />
      <path
        d="M9 8a3.2 3.2 0 0 1 6 1.6c0 2.1-3 2.1-3 4.4"
        stroke={ink}
        strokeWidth="1.9"
      />
      <circle cx="12" cy="17.5" r="1.1" fill={gold} />
    </Frame>
  );
}
export function SettingsIcon(props: LucideProps) {
  return (
    <Frame {...props}>
      <g fill={sage} stroke={ink} strokeWidth="1.2">
        {Array.from({ length: 8 }, (_, i) => (
          <rect
            key={i}
            x="10"
            y="1.5"
            width="4"
            height="6"
            rx="1"
            transform={`rotate(${i * 45} 12 12)`}
          />
        ))}
        <circle cx="12" cy="12" r="7.5" />
        <circle cx="12" cy="12" r="3.5" fill={cream} />
      </g>
      <circle cx="12" cy="12" r="1.4" fill={gold} />
    </Frame>
  );
}
export function SoundIcon(props: LucideProps) {
  return (
    <Frame {...props}>
      <path
        d="M3 9h4l6-5v16l-6-5H3Z"
        fill={sage}
        stroke={ink}
        strokeWidth="1.4"
      />
      <path
        d="M17 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"
        stroke={ink}
        strokeWidth="1.5"
      />
    </Frame>
  );
}
export function MutedIcon(props: LucideProps) {
  return (
    <Frame {...props}>
      <path
        d="M3 9h4l6-5v16l-6-5H3Z"
        fill={sage}
        stroke={ink}
        strokeWidth="1.4"
      />
      <path d="m17 9 5 6m0-6-5 6" stroke={clay} strokeWidth="1.9" />
    </Frame>
  );
}
export function GridIcon(props: LucideProps) {
  return (
    <Frame {...props}>
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="3"
        fill={cream}
        stroke={ink}
        strokeWidth="1.3"
      />
      <path
        d="M3 9h18M3 15h18M9 3v18M15 3v18"
        stroke="#96ac7f"
        strokeWidth="1"
      />
      <rect x="9.5" y="9.5" width="5" height="5" rx="1" fill={sage} />
    </Frame>
  );
}
export function MotionIcon(props: LucideProps) {
  return (
    <Frame {...props}>
      <path d="M2 7h7M1 12h6M3 17h6" stroke={ink} strokeWidth="1.6" />
      <path d="m11 5 10 7-10 7Z" fill={sage} stroke={ink} strokeWidth="1.4" />
      <path d="M15 9v6" stroke={cream} strokeWidth="1.5" />
    </Frame>
  );
}
