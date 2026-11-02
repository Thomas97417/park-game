import type { ReactElement, ReactNode } from "react";
import { Tooltip } from "@base-ui/react/tooltip";
import { euro } from "@/game/catalog";

export function BuildHintProvider({ children }: { children: ReactNode }) {
  return (
    <Tooltip.Provider delay={220} closeDelay={80}>
      {children}
    </Tooltip.Provider>
  );
}

export function BuildHint({
  label,
  price,
  value,
  description,
  hotkey,
  disabled,
  side = "top",
  children,
}: {
  label: string;
  price?: number;
  value?: ReactNode;
  description: ReactNode;
  hotkey?: string;
  disabled?: boolean;
  side?: "top" | "left" | "right" | "bottom";
  children: ReactElement;
}) {
  return (
    <Tooltip.Root disabled={disabled}>
      <Tooltip.Trigger render={children} />
      <Tooltip.Portal>
        <Tooltip.Positioner
          side={side}
          sideOffset={10}
          align="center"
          className="z-50 max-w-[calc(100vw-24px)]"
        >
          <Tooltip.Popup className="parkside w-56 rounded-xl border border-[#d5e0c8] bg-[#fcfdf6] px-3 py-2.5 text-[#4d6842] shadow-[0_5px_24px_#344d3e1c]">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <span>{label}</span>
              {hotkey && <span className="game-kbd">{hotkey}</span>}
              {(value !== undefined || price !== undefined) && (
                <span className="ml-auto whitespace-nowrap text-[#718e54]">
                  {value ?? euro(price!)}
                </span>
              )}
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-[#81916f]">
              {description}
            </p>
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
