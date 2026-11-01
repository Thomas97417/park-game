import { euro } from "@/game/catalog";
import type { ParkingState, UpkeepCharge } from "@/game/engine";

export function ParkingFinances({
  state,
  upkeep,
  playbackRate,
}: {
  state: ParkingState;
  upkeep: UpkeepCharge;
  playbackRate: number;
}) {
  const breakEven = Math.ceil(upkeep.amount / state.price);
  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs text-[#7d906b]">Trésorerie disponible</span>
        <strong
          className={`text-2xl tracking-tight tabular-nums ${state.balance < 0 ? "text-[#a87150]" : "text-[#4b6841]"}`}
        >
          {euro(state.balance, 2)}
        </strong>
      </div>
      <section
        aria-label="Entretien automatique du parking"
        className="rounded-xl border border-[#e3d3b5] bg-[#fcf6e9] p-4 text-[#8a7047]"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h3 className="text-xs font-semibold">Entretien automatique</h3>
          <span className="text-right">
            <strong className="block text-lg leading-none tabular-nums">
              −{euro(upkeep.amount, 2)}
            </strong>
            <span className="mt-1 block text-[10px]">
              toutes les {upkeep.interval} s de simulation
            </span>
          </span>
        </div>
        <dl className="space-y-2 text-[11px]">
          <div className="flex justify-between gap-3">
            <dt>Frais fixes du contrat</dt>
            <dd>{euro(upkeep.base, 2)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>
              {upkeep.spaces} places posées × {euro(upkeep.perSpace, 2)}
            </dt>
            <dd>{euro(upkeep.parking, 2)}</dd>
          </div>
        </dl>
        <div className="mt-3 border-t border-[#e7d9bf] pt-3 text-[11px]">
          <p className="flex justify-between gap-3">
            <span>Prochain prélèvement</span>
            <strong>
              {state.status === "lost"
                ? "contrat terminé"
                : state.opened
                  ? `dans ${Math.ceil(upkeep.nextIn)} s de simulation`
                  : "après l’ouverture"}
            </strong>
          </p>
          <p className="mt-2 text-[10px] leading-relaxed text-[#a28b66]">
            À {playbackRate}× : un prélèvement toutes les{" "}
            {upkeep.interval / playbackRate} s réelles. La pause suspend
            l’entretien.
          </p>
        </div>
      </section>
      <p className="mt-3 rounded-lg bg-[#edf3e5] px-3 py-2.5 text-[11px] leading-relaxed text-[#6d8659]">
        Au tarif actuel de <strong>{euro(state.price, 2)}</strong>, il faut au
        moins{" "}
        <strong>
          {breakEven} sorties payantes par {upkeep.interval} s
        </strong>{" "}
        pour couvrir l’entretien. Les clients encore en magasin n’ont pas encore
        payé.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {[
          ["Recettes encaissées", euro(state.income, 2)],
          ["Dépenses nettes", euro(state.expenses, 2)],
          ["Clients servis", String(state.served)],
          ["Clients non servis", String(state.missed)],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl border border-[#e1e8d5] bg-[#f6f9ef] p-3"
          >
            <p className="text-[10px] text-[#7f936b]">{label}</p>
            <p className="mt-1.5 text-lg font-semibold tracking-tight text-[#536f47]">
              {value}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[10px] leading-relaxed text-[#8a9a7c]">
        Les dépenses nettes incluent les aménagements et l’entretien, après
        remboursements. Les recettes sont cumulées : elles ne représentent pas
        le bénéfice.
      </p>
    </>
  );
}
