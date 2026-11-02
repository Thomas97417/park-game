import { useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { ArrowUp, Check, ChevronUp, X } from "lucide-react";
import { ROAD_TYPES, euro, type RoadType } from "@/game/catalog";
import { RoadTypeIcon } from "./game-icons";
import { BuildHint } from "./build-hint";

export function RoadPalette({
  type,
  active,
  rotation,
  onSelect,
  onDirectionChange,
}: {
  type: RoadType;
  active: boolean;
  rotation: number;
  onSelect: (type: RoadType) => void;
  onDirectionChange: (rotation: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = ROAD_TYPES[type];
  return (
    <Popover.Root open={open} onOpenChange={setOpen} modal>
      <BuildHint
        label="Routes"
        price={selected.price}
        description={`${selected.label} · ${selected.description}`}
        hotkey="1"
        disabled={open}
      >
        <Popover.Trigger
          aria-label={`Routes — ${selected.label} · ${euro(selected.price)} (touche 1)`}
          className={`relative flex size-10 shrink-0 items-center justify-center rounded-[10px] transition-colors ${active || open ? "bg-[#e1ebd5] shadow-[inset_0_0_0_1px_#97b17f]" : "hover:bg-[#eff3e8]"}`}
        >
          <RoadTypeIcon size={27} variant={type} />
          <ChevronUp
            size={8}
            className="absolute right-0.5 bottom-0.5 text-[#647d50]"
          />
        </Popover.Trigger>
      </BuildHint>
      <Popover.Portal>
        <Popover.Positioner
          side="top"
          align="center"
          sideOffset={12}
          className="z-40 max-w-[calc(100vw-24px)] outline-none"
        >
          <Popover.Popup
            aria-label="Types de route"
            className="parkside w-[340px] max-w-[calc(100vw-24px)] rounded-2xl border border-[#d4dfc7] bg-[#fcfdf6] p-3 text-[#4b6541] shadow-[0_10px_40px_#344d3e26] outline-none"
          >
            <div className="mb-2.5 flex items-center justify-between px-1">
              <h2 className="text-sm font-semibold">Routes</h2>
              <Popover.Close
                aria-label="Fermer les types de route"
                className="rounded-md p-1 text-[#829374] hover:bg-[#edf2e5]"
              >
                <X size={15} />
              </Popover.Close>
            </div>
            <div
              className="grid grid-cols-2 gap-2"
              role="group"
              aria-label="Type de route"
            >
              {(Object.keys(ROAD_TYPES) as RoadType[]).map((variant) => {
                const road = ROAD_TYPES[variant];
                return (
                  <button
                    key={variant}
                    type="button"
                    aria-label={`${road.label} — ${euro(road.price)} par case`}
                    aria-pressed={type === variant}
                    onClick={() => {
                      onSelect(variant);
                      setOpen(false);
                    }}
                    className={`relative flex flex-col items-start rounded-xl border p-3 text-left transition-colors ${type === variant ? "border-[#94ad7d] bg-[#eaf1df]" : "border-[#e0e7d5] bg-[#f7f9f0] hover:border-[#bacbaa] hover:bg-[#eff4e5]"}`}
                  >
                    <div className="mb-2 flex w-full items-center justify-between">
                      <RoadTypeIcon variant={variant} size={32} />
                      <span className="text-[11px] font-semibold text-[#7c8e69]">
                        {euro(road.price)}
                        <span className="font-normal"> / case</span>
                      </span>
                    </div>
                    <span className="text-xs font-semibold">{road.label}</span>
                    <span className="mt-1 text-[10px] text-[#7e8f6e]">
                      {road.description}
                    </span>
                    {type === variant && (
                      <Check
                        size={12}
                        className="absolute top-2 right-2 text-[#678852]"
                      />
                    )}
                  </button>
                );
              })}
            </div>
            {selected.oneWay && (
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#e0e7d5] px-1 pt-3">
                <span className="text-[11px] text-[#7c8f69]">
                  Orientation <span className="game-kbd ml-1">R</span>
                </span>
                <div
                  className="flex gap-1"
                  role="group"
                  aria-label="Sens de la route"
                >
                  {["Nord", "Est", "Sud", "Ouest"].map((direction, index) => (
                    <button
                      key={direction}
                      type="button"
                      aria-label={`Sens : ${direction.toLowerCase()}`}
                      aria-pressed={rotation === index}
                      onClick={() => onDirectionChange(index)}
                      title={direction}
                      className={`flex size-7 items-center justify-center rounded-md ${rotation === index ? "bg-[#dce8d0] text-[#4b7043]" : "text-[#8b9b7c] hover:bg-[#edf2e5]"}`}
                    >
                      <ArrowUp
                        size={15}
                        style={{ transform: `rotate(${index * 90}deg)` }}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
