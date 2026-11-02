import { useEffect } from "react";
import { euro } from "@/game/catalog";
import { CELL, ORIGIN, type TollPayment as Payment } from "@/game/engine";

export function TollPayment({
  payment,
  stack = 0,
  onDismiss,
}: {
  payment: Payment;
  stack?: number;
  onDismiss: (carId: number) => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(payment.carId), 1500);
    return () => window.clearTimeout(timer);
  }, [payment.carId, onDismiss]);
  const label = `+${euro(payment.amount, payment.amount % 1 ? 2 : 0)}`;
  const width = label.length * 8 + 18;
  return (
    <g
      transform={`translate(${ORIGIN.x + (payment.point.x + 0.5) * CELL} ${ORIGIN.y + (payment.point.y + 0.5) * CELL - 30 - stack * 26})`}
      pointerEvents="none"
      aria-label={`Paiement encaissé : ${euro(payment.amount, 2)}`}
    >
      <g className="parking-payment-rise">
        <rect
          x={-width / 2}
          y="-22"
          width={width}
          height="27"
          rx="10"
          fill="#fbfff1"
          stroke="#98b47e"
          strokeWidth="1.1"
        />
        <text
          x="0"
          y="-3"
          textAnchor="middle"
          fontSize="16"
          fontWeight="700"
          fill="#47723d"
          fontFamily="sans-serif"
        >
          {label}
        </text>
      </g>
    </g>
  );
}
