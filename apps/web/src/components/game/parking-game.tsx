import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  CarFront,
  Check,
  CheckCheck,
  ChevronDown,
  CircleHelp,
  CircleParking,
  Coins,
  Construction,
  Download,
  Eraser,
  Expand,
  Flag,
  Grid2X2,
  Hand,
  Leaf,
  Lightbulb,
  LockKeyhole,
  MapPin,
  Minus,
  MousePointer2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  RotateCw,
  Route,
  Save,
  Settings2,
  ShieldCheck,
  Smile,
  Sparkles,
  Sprout,
  Star,
  Sun,
  Target,
  TrafficCone,
  TrendingUp,
  Trophy,
  Undo2,
  Volume2,
  VolumeX,
  Wallet,
  X,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";
import { LEVELS, TOOLS, euro, type Tool } from "@/game/catalog";
import {
  clockTime,
  infrastructure,
  objectives,
  type Point,
} from "@/game/engine";
import { useParkingGame } from "@/game/use-parking-game";
import { GameMap, CarSprite, Tree } from "./game-map";

const TOOL_ICONS: Partial<Record<Tool, ComponentType<LucideProps>>> = {
  road: Route,
  parking: CircleParking,
  crossing: FootstepsIcon,
  gate: BarrierIcon,
  roundabout: RotateCw,
  tree: Sprout,
  entry: ArrowDownLeft,
  erase: Eraser,
  select: MousePointer2,
};

function FootstepsIcon(props: React.ComponentProps<LucideIcon>) {
  return (
    <svg
      {...props}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    >
      <path d="M3 20 9 4M8 20l6-16M13 20l6-16M18 20l3-8" />
      <path d="M2 3h20M2 21h20" strokeWidth="1" opacity="0.4" />
    </svg>
  );
}

function BarrierIcon(props: React.ComponentProps<LucideIcon>) {
  return (
    <svg
      {...props}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 21V10h4v11M8 12h13V8H5v2M4 21H2M8 21h2M11 8l3 4M17 8l3 4" />
      <circle cx="6" cy="15" r=".7" fill="currentColor" />
    </svg>
  );
}

function IconButton({
  label,
  icon: Icon,
  onClick,
  active = false,
  disabled = false,
  className = "",
}: {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      disabled={disabled}
      className={`game-icon-button ${active ? "bg-[#e6eddf] text-[#3e604b]" : "text-[#70786c]"} ${className}`}
    >
      <Icon size={18} strokeWidth={1.7} />
    </button>
  );
}

function Modal({
  title,
  eyebrow,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  eyebrow?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`game-dialog ${wide ? "w-[740px]" : "w-[540px]"}`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const rect = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            onClose();
        }
      }}
      aria-labelledby="game-dialog-title"
    >
      <div className="flex items-start justify-between gap-4 border-b border-[#e8eade] px-7 py-6">
        <div>
          {eyebrow && (
            <p className="mb-2 text-[11px] font-semibold tracking-[0.16em] text-[#6d7565] uppercase">
              {eyebrow}
            </p>
          )}
          <h2
            id="game-dialog-title"
            className="text-[25px] font-semibold tracking-[-0.055em] text-[#293e33]"
          >
            {title}
          </h2>
        </div>
        <IconButton label="Fermer" icon={X} onClick={onClose} />
      </div>
      <div className="px-7 py-6">{children}</div>
    </dialog>
  );
}

export function ParkingGame() {
  const game = useParkingGame();
  const { state } = game;
  const [tool, setTool] = useState<Tool>("select");
  const [rotation, setRotation] = useState(0);
  const [gridVisible, setGridVisible] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [modal, setModal] = useState<
    "help" | "contracts" | "stats" | "settings" | "restart" | null
  >(null);
  const [pendingLevel, setPendingLevel] = useState(0);
  const [showWelcome, setShowWelcome] = useState(true);
  const [showObjectives, setShowObjectives] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [inspection, setInspection] = useState<Point | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const soundRef = useRef(false);
  const previousIncome = useRef(state.income);
  const savedSpeed = useRef(1);
  const contractPanelRef = useRef<HTMLElement>(null);
  const level = LEVELS[state.level];
  const info = infrastructure(state.grid);
  const goals = objectives(state);
  const completedGoals = goals.filter((goal) => goal.done).length;
  const allDone = completedGoals === goals.length;
  const selectedTool = TOOLS.find((item) => item.id === tool);
  const occupied = state.cars.filter((car) => car.phase !== "leaving").length;
  const day = Math.floor(state.elapsed / 240) + 1;
  const dialogOpen = !!modal || showObjectives || state.status === "lost";

  useEffect(() => {
    contractPanelRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [state.level]);

  const tone = useCallback((frequency = 520) => {
    if (!soundRef.current) return;
    try {
      audio.current ??= new AudioContext();
      void audio.current.resume();
      const oscillator = audio.current.createOscillator();
      const gain = audio.current.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.025, audio.current.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        audio.current.currentTime + 0.16,
      );
      oscillator.connect(gain);
      gain.connect(audio.current.destination);
      oscillator.start();
      oscillator.stop(audio.current.currentTime + 0.18);
    } catch {
      /* Sound is optional on browsers without Web Audio. */
    }
  }, []);

  useEffect(() => {
    if (state.income > previousIncome.current) tone(740);
    previousIncome.current = state.income;
  }, [state.income, tone]);

  useEffect(() => {
    if (dialogOpen) {
      savedSpeed.current = game.speed;
      game.setSpeed(0);
    } else game.setSpeed(savedSpeed.current);
    // Opening a dialog freezes the simulation until the player returns.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialogOpen]);

  useEffect(() => {
    try {
      setShowWelcome(
        localStorage.getItem("parkside-welcome-dismissed") !== "true",
      );
      const sound = localStorage.getItem("parkside-sound") === "true";
      setSoundOn(sound);
      soundRef.current = sound;
      setReducedMotion(
        window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      );
      if (window.matchMedia("(max-width: 639px)").matches) setZoom(1.35);
    } catch {
      /* The game also works without browser storage. */
    }
    return () => {
      void audio.current?.close();
    };
  }, []);

  const selectTool = (next: Tool) => {
    setTool(next);
    setInspection(null);
  };
  const closeModal = () => setModal(null);
  const requestContract = (index: number) => {
    setPendingLevel(index);
    setModal("restart");
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        modal ||
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement ||
        event.altKey
      )
        return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        game.undo();
        return;
      }
      if (event.ctrlKey || event.metaKey) return;
      if (
        event.code === "Space" &&
        !(event.target instanceof HTMLButtonElement)
      ) {
        event.preventDefault();
        game.setSpeed((value) => (value ? 0 : 1));
      }
      if (event.key.toLowerCase() === "r")
        setRotation((value) => (value + 1) % 4);
      if (event.key.toLowerCase() === "g") setGridVisible((value) => !value);
      if (event.key.toLowerCase() === "v" || event.key === "Escape")
        selectTool("select");
      if (event.key.toLowerCase() === "b") selectTool("erase");
      const next = TOOLS.find((item) => item.key === event.key);
      if (next) selectTool(next.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [game.undo, game.setSpeed, modal]);

  const dismissWelcome = () => {
    setShowWelcome(false);
    try {
      localStorage.setItem("parkside-welcome-dismissed", "true");
    } catch {
      /* optional */
    }
  };
  const toggleSound = () => {
    soundRef.current = !soundOn;
    setSoundOn(!soundOn);
    try {
      localStorage.setItem("parkside-sound", String(!soundOn));
    } catch {
      /* optional */
    }
    tone(440);
  };
  const exportSave = () => {
    const file = new Blob(
      [
        JSON.stringify(
          { ...game.stateRef.current, savedAt: Date.now() },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(file);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "parkside-sauvegarde.json";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const contractPanel = (
    <>
      <div className="p-6 pb-5">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.16em] text-[#6f7667] uppercase">
            <span className="size-1.5 rounded-full bg-[#8eaa78]" />
            Votre contrat
          </p>
          <span className="rounded-md bg-[#edf1e5] px-2 py-1 text-[10px] font-medium text-[#657857]">
            NIVEAU 0{state.level + 1}
          </span>
        </div>
        <h1 className="mt-5 text-[29px] leading-[1.08] font-semibold tracking-[-0.065em] text-[#314437]">
          {state.completed ? (
            "Bien joué,\npartenaire."
          ) : state.level === 0 ? (
            <>
              Un bon
              <br />
              départ.
            </>
          ) : state.level === 1 ? (
            <>
              Voyez
              <br />
              plus grand.
            </>
          ) : (
            <>
              À vous
              <br />
              la ville.
            </>
          )}
        </h1>
        <p className="mt-3 max-w-[220px] text-[12px] leading-[1.7] text-[#6d7864]">
          {state.completed
            ? "Le commerce est conquis. Un nouveau terrain de jeu vous attend."
            : "Un commerce, un terrain et plein de possibilités. Faites bonne impression."}
        </p>
        <div className="mt-5 flex items-center gap-3 rounded-xl border border-[#e8ebdf] bg-[#f8f9f2] p-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#e5ebd8] text-[#697a5a]">
            <Building2 size={21} strokeWidth={1.4} />
          </div>
          <div>
            <p className="text-[12px] font-semibold text-[#4b5b46]">
              {level.type}
            </p>
            <p className="mt-1 flex items-center gap-1 text-[10px] text-[#707568]">
              <MapPin size={10} />
              Quartier {level.district}
            </p>
          </div>
        </div>
        <div className="mt-6 flex items-center justify-between">
          <h2 className="text-[12px] font-semibold text-[#4c5b46]">
            Les objectifs
          </h2>
          <span className="text-[11px] text-[#6f7465]">
            {completedGoals}{" "}
            <span className="text-[#73776c]">/ {goals.length}</span>
          </span>
        </div>
        <div className="mt-2.5 flex gap-1.5">
          {goals.map((goal) => (
            <div
              key={goal.label}
              className={`h-1 flex-1 rounded-full transition-colors ${goal.done ? "bg-[#86a277]" : "bg-[#e9ecdf]"}`}
            />
          ))}
        </div>
        <div className="mt-2">
          {goals.map((goal) => (
            <div
              key={goal.label}
              className="flex items-center gap-2.5 border-b border-[#edf0e6] py-3.5 last:border-0"
            >
              <span
                className={`flex size-[17px] shrink-0 items-center justify-center rounded-full border ${goal.done ? "border-[#9bb68a] bg-[#9bb68a] text-white" : "border-[#d5ddc8]"}`}
              >
                {goal.done && <Check size={10} strokeWidth={2.5} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-[#717b65]">{goal.label}</p>
              </div>
              <span
                className={`shrink-0 text-[11px] font-medium tabular-nums ${goal.done ? "text-[#677759]" : "text-[#6d7a5f]"}`}
              >
                {Math.min(goal.value, goal.target)}
                <span className="text-[#6e765f]">
                  {" "}
                  / {goal.target}
                  {goal.unit === "%" ? " %" : ""}
                </span>
              </span>
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between rounded-lg bg-[#f4f1e6] px-3 py-3">
          <span className="flex items-center gap-2 text-[11px] text-[#797360]">
            <Trophy size={13} strokeWidth={1.5} />
            Prime de contrat
          </span>
          <span className="text-[12px] font-semibold text-[#77745c]">
            + {euro(level.reward)}
          </span>
        </div>
        {allDone && !state.completed && (
          <button
            type="button"
            onClick={game.completeContract}
            className="game-primary-button mt-3 w-full justify-center"
          >
            <BadgeCheck size={15} />
            Valider le contrat
            <ArrowRight size={14} />
          </button>
        )}
        {state.completed && (
          <button
            type="button"
            onClick={() => {
              setShowObjectives(false);
              setModal("contracts");
            }}
            className="game-primary-button mt-3 w-full justify-center"
          >
            {state.level === 2 ? "Revoir les contrats" : "Le prochain défi"}
            <ArrowRight size={14} />
          </button>
        )}
      </div>
      <div className="border-t border-[#e7ebde] px-6 py-5">
        <div className="flex items-center justify-between">
          <h2 className="text-[12px] font-semibold text-[#52604a]">
            Tarif du stationnement
          </h2>
          <CircleParking size={14} className="text-[#6d7a5f]" />
        </div>
        <div className="mt-3 flex items-center justify-between rounded-lg border border-[#e1e6d6] p-1.5">
          <IconButton
            label="Diminuer le tarif"
            icon={Minus}
            onClick={() => game.setPrice(state.price - 0.5)}
            disabled={state.price <= 1}
          />
          <span className="text-[17px] font-semibold tracking-tight text-[#52634b] tabular-nums">
            {euro(state.price, 2)}
            <span className="ml-1.5 text-[10px] font-normal text-[#6f7467]">
              / visite
            </span>
          </span>
          <IconButton
            label="Augmenter le tarif"
            icon={Plus}
            onClick={() => game.setPrice(state.price + 0.5)}
            disabled={state.price >= 8}
          />
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-[#6b765b]">
          Le tarif est fixé à l’entrée, puis encaissé à la sortie.
        </p>
      </div>
      <div className="mx-5 mb-5 rounded-xl bg-[#f1f4e8] p-4">
        <div className="flex items-center gap-2 text-[#6b775a]">
          <Lightbulb size={14} strokeWidth={1.6} />
          <h2 className="text-[11px] font-semibold">
            Ça roule mieux avec un conseil.
          </h2>
        </div>
        <p className="mt-2 text-[11px] leading-[1.7] text-[#6e7662]">
          {info.usable.length < info.spots.length
            ? "Certaines places sont inaccessibles. Tournez leur ouverture vers une route et reliez-les à l’entrée."
            : state.price > 4
              ? "Un prix élevé fait baisser la satisfaction. Trouvez le bon équilibre avec la qualité du parking."
              : "Rapprochez les places du commerce et ajoutez des passages piétons. Les clients aiment les petites attentions."}
        </p>
      </div>
      <div className="mt-auto flex items-center gap-2 border-t border-[#e7ebde] bg-[#f7f9ef] px-6 py-3.5 text-[10px] text-[#6c7a5e]">
        <ShieldCheck size={13} />
        {state.debtTime > 0 || state.unhappyTime > 0
          ? "Votre contrat est en danger"
          : state.completed
            ? "Une collaboration réussie"
            : "La confiance, ça se construit."}
      </div>
    </>
  );

  return (
    <div
      className={`parkside flex h-svh min-h-[620px] flex-col overflow-hidden bg-[#fafbf6] text-[#334639] ${reducedMotion ? "reduce-motion" : ""}`}
    >
      <header className="z-20 flex h-[74px] shrink-0 items-center justify-between gap-4 border-b border-[#e3e7db] bg-[#fdfdf9] px-4 sm:px-7">
        <a
          href="/"
          className="flex shrink-0 items-center gap-2.5"
          aria-label="Parkside, accueil du jeu"
        >
          <div className="relative flex size-10 items-center justify-center rounded-[12px] bg-[#3d5947] text-[28px] leading-none font-semibold text-[#eff5e4]">
            p
            <span className="absolute right-2 bottom-2 size-1 rounded-full bg-[#b5c994]" />
          </div>
          <div>
            <span className="text-[24px] font-semibold tracking-[-0.065em] text-[#344e3e]">
              parkside<span className="text-[#6c7563]">.</span>
            </span>
            <p className="mt-0.5 hidden text-[8px] font-medium tracking-[0.18em] text-[#707769] uppercase min-[420px]:block">
              De la place pour vos idées
            </p>
          </div>
        </a>
        <button
          type="button"
          onClick={() => setModal("contracts")}
          className="hidden items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-[#f1f4e9] md:flex"
        >
          <span className="flex size-8 items-center justify-center rounded-full border border-[#e2e8d7] text-[11px] font-medium text-[#697a5b]">
            0{state.level + 1}
          </span>
          <div>
            <p className="text-[9px] tracking-[0.1em] text-[#71776a] uppercase">
              Contrat en cours
            </p>
            <p className="mt-1 text-[12px] font-medium text-[#64735a]">
              {level.name}
            </p>
          </div>
          <ChevronDown size={13} className="ml-3 text-[#6f7768]" />
        </button>
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            type="button"
            aria-label="Comment jouer"
            onClick={() => setModal("help")}
            className="flex items-center gap-2 text-[11px] text-[#6b7660] hover:text-[#3e604b]"
          >
            <CircleHelp size={17} strokeWidth={1.6} />
            <span className="hidden sm:block">Comment jouer</span>
          </button>
          <span className="mx-1 hidden h-5 w-px bg-[#e8ebdf] sm:block" />
          <div className="flex sm:hidden">
            <IconButton
              label="Contrats et progression"
              icon={BriefcaseBusiness}
              onClick={() => setModal("contracts")}
            />
            <IconButton
              label="Finances du parking"
              icon={TrendingUp}
              onClick={() => setModal("stats")}
            />
          </div>
          <span className="hidden sm:block">
            <IconButton
              label={soundOn ? "Couper les sons" : "Activer les sons"}
              icon={soundOn ? Volume2 : VolumeX}
              onClick={toggleSound}
            />
          </span>
          <button
            type="button"
            onClick={() => setModal("settings")}
            title="Préférences"
            aria-label="Préférences"
            className="ml-1 flex size-8 items-center justify-center rounded-full border border-[#dae3ce] bg-[#eef3e7] text-[11px] font-medium text-[#6a775b]"
          >
            VO
          </button>
        </div>
      </header>

      <section
        className="z-10 grid h-[96px] shrink-0 grid-cols-4 border-b border-[#e1e6d7] bg-[#fbfcf7] px-1 sm:px-[78px] lg:pr-[302px]"
        aria-label="Indicateurs du parking"
      >
        <Stat
          icon={Wallet}
          label="TRÉSORERIE"
          value={euro(state.balance)}
          sub={
            state.balance < 0 ? "Attention au découvert" : "De quoi voir venir"
          }
          color="green"
          negative={state.balance < 0}
        />
        <Stat
          icon={TrendingUp}
          label="RECETTES"
          value={euro(state.income, state.income % 1 ? 1 : 0)}
          sub={`${state.served} client${state.served > 1 ? "s" : ""} accueilli${state.served > 1 ? "s" : ""}`}
          color="yellow"
        />
        <Stat
          icon={CarFront}
          label="STATIONNEMENT"
          value={
            <>
              {occupied}
              <span className="ml-1 text-[15px] font-normal text-[#6f7667]">
                / {info.usable.length}
              </span>
            </>
          }
          sub={`${Math.max(0, info.usable.length - occupied)} places disponibles`}
          color="blue"
        />
        <Stat
          icon={Smile}
          label="SATISFACTION"
          value={
            <>
              {Math.round(state.happiness)}
              <span className="ml-1 text-[15px] font-normal text-[#6f7667]">
                %
              </span>
            </>
          }
          sub={
            state.happiness >= 80
              ? "Tout le monde a le sourire"
              : state.happiness >= 50
                ? "Peut encore mieux faire"
                : "Les clients s’impatientent"
          }
          color="pink"
          negative={state.happiness < 35}
        />
      </section>

      <div className="flex min-h-0 flex-1">
        <nav
          className="z-10 hidden w-[78px] shrink-0 flex-col items-center gap-3 border-r border-[#e1e6d7] bg-[#fafbf5] py-5 sm:flex"
          aria-label="Navigation du jeu"
        >
          <RailButton
            icon={Construction}
            label="Construire"
            active={!modal || modal === "help"}
            onClick={() => selectTool(tool === "select" ? "parking" : "select")}
          />
          <RailButton
            icon={BriefcaseBusiness}
            label="Contrats"
            active={modal === "contracts"}
            onClick={() => setModal("contracts")}
          />
          <RailButton
            icon={TrendingUp}
            label="Finances"
            active={modal === "stats"}
            onClick={() => setModal("stats")}
          />
          <div className="mt-2 h-px w-7 bg-[#e1e6d7]" />
          <RailButton
            icon={CircleHelp}
            label="Le guide"
            onClick={() => setModal("help")}
          />
          <div className="mt-auto">
            <RailButton
              icon={Settings2}
              label="Réglages"
              onClick={() => setModal("settings")}
            />
          </div>
        </nav>

        <main
          className="relative min-w-0 flex-1 overflow-hidden bg-[#e2e9d6]"
          aria-label="Aménagement du parking"
        >
          <GameMap
            state={state}
            tool={tool}
            rotation={rotation}
            gridVisible={gridVisible}
            zoom={zoom}
            pan={pan}
            setPan={setPan}
            onPlace={(next, point, angle) => {
              const old = game.stateRef.current.balance;
              game.place(next, point, angle);
              if (old !== game.stateRef.current.balance) {
                tone(360);
                setShowWelcome(false);
              }
            }}
            onInspect={(point) => setInspection(point)}
          />
          <div className="pointer-events-none absolute top-5 right-5 left-5 flex items-start justify-between gap-4">
            <div className="pointer-events-auto flex items-center gap-2.5 rounded-xl border border-white/60 bg-[#fcfdf5]/95 px-3.5 py-2.5 shadow-[0_3px_12px_#536b4610]">
              <span className="flex size-7 items-center justify-center rounded-lg bg-[#e8eedc] text-[#6b795b]">
                <MapPin size={14} strokeWidth={1.7} />
              </span>
              <div>
                <p className="text-[11px] font-medium text-[#64765a]">
                  Votre petit coin de ville
                </p>
                <p className="mt-0.5 text-[9px] text-[#68775a]">
                  {level.district} <span className="mx-1">·</span> Terrain
                  constructible
                </p>
              </div>
              <span className="ml-3 size-1.5 rounded-full bg-[#9cb485]" />
            </div>
            <div className="hidden items-center gap-2.5 px-2 py-2 sm:flex">
              <Sun size={23} strokeWidth={1.3} className="text-[#857245]" />
              <div>
                <p className="text-[12px] font-medium text-[#6e795f]">19°</p>
                <p className="mt-0.5 text-[9px] text-[#6e7562]">
                  Belle journée pour construire
                </p>
              </div>
            </div>
          </div>

          <div className="absolute top-[92px] right-5 flex flex-col gap-1 rounded-xl border border-[#e7ecdc] bg-[#fbfcf5]/95 p-1 shadow-[0_3px_12px_#536b4610]">
            <IconButton
              label="Zoom avant"
              icon={Plus}
              onClick={() => setZoom((value) => Math.min(1.8, value + 0.15))}
              disabled={zoom >= 1.8}
            />
            <span className="text-center text-[9px] text-[#6e7664] tabular-nums">
              {Math.round(zoom * 100)}%
            </span>
            <IconButton
              label="Zoom arrière"
              icon={Minus}
              onClick={() => setZoom((value) => Math.max(0.65, value - 0.15))}
              disabled={zoom <= 0.65}
            />
            <div className="mx-2 my-0.5 h-px bg-[#e4e9d9]" />
            <IconButton
              label="Recentrer la carte"
              icon={Expand}
              onClick={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
            />
            <IconButton
              label="Afficher la grille (G)"
              icon={Grid2X2}
              active={gridVisible}
              onClick={() => setGridVisible((value) => !value)}
            />
          </div>

          <button
            type="button"
            onClick={() => setShowObjectives(true)}
            className="absolute top-[91px] left-5 flex items-center gap-2 rounded-lg bg-[#fcfdf5] px-3 py-2.5 text-[11px] text-[#69795a] shadow-sm lg:hidden"
          >
            <Target size={14} />
            Objectifs
            <span className="ml-1 rounded bg-[#e8eedc] px-1.5 py-0.5 text-[10px]">
              {completedGoals}/4
            </span>
          </button>

          {inspection && (
            <div className="absolute top-[95px] left-5 w-[230px] rounded-xl border border-[#e5ead9] bg-[#fcfdf6] p-4 shadow-[0_5px_25px_#536b4615]">
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-semibold text-[#536b47]">
                  {
                    {
                      grass: "Terrain disponible",
                      road: "Route de circulation",
                      parking: "Place de stationnement",
                      crossing: "Passage piéton",
                      gate: "Barrière de paiement",
                      entry: "Accès au parking",
                      roundabout: "Rond-point",
                      tree: "Un peu de verdure",
                      path: "Allée piétonne",
                      store: level.name,
                    }[state.grid[inspection.y]![inspection.x]!.kind]
                  }
                </p>
                <button
                  aria-label="Fermer l’inspection"
                  type="button"
                  onClick={() => setInspection(null)}
                >
                  <X size={13} />
                </button>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-[#6d7562]">
                {state.grid[inspection.y]![inspection.x]!.fixed
                  ? "Cet espace est entretenu par le commerce ou la ville."
                  : state.grid[inspection.y]![inspection.x]!.kind === "parking"
                    ? "Une ouverture vers la route et un accès au magasin sont nécessaires pour accueillir un client."
                    : "Choisissez un outil dans la barre de construction pour aménager votre terrain."}
              </p>
              <p className="mt-3 text-[9px] text-[#707668]">
                CASE {inspection.x + 1} · {inspection.y + 1}
              </p>
            </div>
          )}

          {(state.debtTime > 0 || state.unhappyTime > 0) &&
            state.status !== "lost" && (
              <div
                role="alert"
                className="absolute top-[85px] left-1/2 flex max-w-[85%] -translate-x-1/2 items-center gap-2 rounded-xl border border-[#d6b99a] bg-[#fbf0df] px-4 py-3 text-[12px] text-[#8e6e48]"
              >
                <TrafficCone size={16} />
                Contrat en danger :{" "}
                {Math.ceil(45 - Math.max(state.debtTime, state.unhappyTime))} s
                pour redresser la situation.
              </div>
            )}

          <div className="pointer-events-none absolute right-4 bottom-4 left-4 flex flex-col items-center gap-3 sm:right-5 sm:bottom-5 sm:left-5">
            {game.notice && (
              <div
                role="status"
                className="pointer-events-auto max-w-lg rounded-xl border border-[#dfe6d2] bg-[#fcfdf6] px-4 py-3 text-center text-[12px] text-[#687759] shadow-[0_4px_20px_#536b4615]"
              >
                {game.notice}
              </div>
            )}
            {showWelcome && !game.notice && tool === "select" && (
              <div className="pointer-events-auto flex w-full max-w-[445px] items-start gap-3 rounded-xl border border-[#e4e9da] bg-[#fcfdf5]/95 px-4 py-3.5 shadow-[0_4px_20px_#536b4610]">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-[#edf1e3] text-[#6d785b]">
                  <Sparkles size={14} />
                </span>
                <div className="flex-1">
                  <p className="text-[12px] font-medium text-[#6b7e5c]">
                    Le terrain est à vous.
                  </p>
                  <p className="mt-1 text-[10px] leading-relaxed text-[#69785a]">
                    Ajoutez des places et sécurisez les traversées. Votre
                    premier contrat n’attend que vos idées.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={dismissWelcome}
                  aria-label="Masquer le conseil de bienvenue"
                  className="mt-0.5 text-[#717768]"
                >
                  <X size={13} />
                </button>
              </div>
            )}
            {tool !== "select" && !game.notice && (
              <div className="pointer-events-auto flex max-w-full items-center gap-3 rounded-lg border border-[#dfe6d2] bg-[#fcfdf6]/95 px-3 py-2 text-[11px] text-[#69775a]">
                <span className="hidden max-w-[330px] sm:block">
                  {selectedTool?.description ??
                    "Retirez un aménagement et récupérez 40 % de son prix."}
                </span>
                {tool !== "erase" && (
                  <button
                    type="button"
                    onClick={() => setRotation((value) => (value + 1) % 4)}
                    className="flex shrink-0 items-center gap-1.5 border-l border-[#e1e7d6] pl-3 text-[#667953]"
                  >
                    <RotateCw size={12} />
                    <kbd className="game-kbd">R</kbd>
                    <span>{rotation * 90}°</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => selectTool("select")}
                  className="shrink-0 text-[#6d7a5f]"
                  aria-label="Quitter l’outil de construction"
                >
                  <X size={12} />
                </button>
              </div>
            )}
            <div
              className="pointer-events-auto flex max-w-full items-stretch gap-0.5 overflow-x-auto rounded-[16px] border border-[#e0e6d5] bg-[#fdfef9] p-1.5 shadow-[0_8px_25px_#4c64351a] sm:gap-1 sm:p-2"
              aria-label="Outils de construction"
            >
              <button
                type="button"
                onClick={() => selectTool("select")}
                aria-pressed={tool === "select"}
                title="Déplacer la carte (V)"
                aria-label="Déplacer la carte (V)"
                className={`flex w-9 shrink-0 flex-col items-center justify-center rounded-[10px] transition-colors sm:w-10 ${tool === "select" ? "bg-[#edf2e5] text-[#627c4d]" : "text-[#707765] hover:bg-[#f4f6ed]"}`}
              >
                <Hand size={18} strokeWidth={1.5} />
                <span className="mt-3 text-[8px]">V</span>
              </button>
              <div className="mx-0.5 my-2 w-px shrink-0 bg-[#e8ecdf]" />
              {TOOLS.map((item) => {
                const Icon = TOOL_ICONS[item.id]!;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={tool === item.id}
                    aria-label={`${item.label} — ${euro(item.price)} (touche ${item.key})`}
                    onClick={() => selectTool(item.id)}
                    title={`${item.label} · ${euro(item.price)} · ${item.key}`}
                    className={`group relative flex h-[70px] w-[58px] shrink-0 flex-col items-center justify-center gap-1 rounded-[10px] transition-colors sm:w-[64px] ${tool === item.id ? "bg-[#435e48] text-[#f2f6e7]" : "text-[#6b7961] hover:bg-[#f1f4e9]"}`}
                  >
                    <span
                      className={`absolute top-1 right-1.5 text-[8px] ${tool === item.id ? "text-[#aabda0]" : "text-[#717668]"}`}
                    >
                      {item.key}
                    </span>
                    <Icon size={21} strokeWidth={1.45} />
                    <span className="mt-0.5 text-[10px] font-medium">
                      {item.label}
                    </span>
                    <span
                      className={`text-[9px] ${tool === item.id ? "text-[#b6c8a9]" : "text-[#717768]"}`}
                    >
                      {euro(item.price)}
                    </span>
                  </button>
                );
              })}
              <div className="mx-0.5 my-2 w-px shrink-0 bg-[#e8ecdf]" />
              <button
                type="button"
                onClick={() => selectTool("erase")}
                aria-pressed={tool === "erase"}
                title="Démolir (B) · Remboursement de 40 %"
                aria-label="Démolir (B)"
                className={`flex w-9 shrink-0 flex-col items-center justify-center gap-3 rounded-[10px] sm:w-10 ${tool === "erase" ? "bg-[#f2e5d9] text-[#8c6d57]" : "text-[#7b7469] hover:bg-[#f4eee5]"}`}
              >
                <Eraser size={18} strokeWidth={1.5} />
                <span className="text-[8px]">B</span>
              </button>
            </div>
          </div>
          <div className="absolute bottom-[23px] left-5 hidden items-center gap-1 rounded-lg border border-[#e3e9d8] bg-[#fcfdf5] p-1 2xl:flex">
            <IconButton
              label="Annuler la dernière construction (Ctrl ou ⌘ Z)"
              icon={Undo2}
              onClick={game.undo}
              disabled={!game.canUndo}
            />
          </div>
        </main>

        <aside
        ref={contractPanelRef}
          className="z-10 hidden w-[282px] shrink-0 flex-col overflow-y-auto border-l border-[#e1e6d7] bg-[#fdfef9] lg:flex"
          aria-label="Contrat et objectifs"
        >
          {contractPanel}
        </aside>
      </div>

      <footer className="z-20 flex h-[53px] shrink-0 items-center justify-between gap-3 border-t border-[#e1e6d7] bg-[#fafbf5] px-3 sm:px-6">
        <div className="flex items-center gap-2 sm:gap-4">
          <span className="flex items-center gap-2 text-[11px] font-medium text-[#6a775d]">
            <span
              className={`size-1.5 rounded-full ${game.speed > 0 && state.status === "playing" ? "bg-[#9ab582]" : "bg-[#d1b381]"}`}
            />
            Jour {day}
            <span className="ml-1 font-normal text-[#69775b] tabular-nums">
              {clockTime(state.elapsed)}
            </span>
          </span>
          <span className="h-4 w-px bg-[#e2e7d7]" />
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              aria-label={
                game.speed ? "Mettre en pause (Espace)" : "Reprendre (Espace)"
              }
              title="Pause / lecture (Espace)"
              onClick={() => game.setSpeed((value) => (value ? 0 : 1))}
              className="flex size-7 items-center justify-center rounded-md text-[#697a59] hover:bg-[#e9efde]"
            >
              {game.speed ? (
                <Pause size={13} fill="currentColor" strokeWidth={0} />
              ) : (
                <Play size={13} fill="currentColor" strokeWidth={0} />
              )}
            </button>
            {[1, 2, 3].map((speed) => (
              <button
                key={speed}
                type="button"
                aria-label={`Vitesse ${speed}`}
                aria-pressed={game.speed === speed}
                onClick={() => game.setSpeed(speed)}
                className={`flex h-6 w-7 items-center justify-center rounded-md text-[10px] transition-colors ${game.speed === speed ? "bg-[#e8efdd] font-semibold text-[#667b4f]" : "text-[#6d7a5f] hover:bg-[#f0f3e8]"}`}
              >
                {speed}×
              </button>
            ))}
          </div>
        </div>
        <div className="hidden items-center gap-4 text-[10px] text-[#69785a] xl:flex">
          <span className="flex items-center gap-1.5">
            <MousePointer2 size={10} />
            Cliquer pour construire
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="game-kbd">R</kbd>Pivoter
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="game-kbd">Espace</kbd>Pause
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-[#69785a]">
          <button
            type="button"
            onClick={game.undo}
            disabled={!game.canUndo}
            className="mr-2 text-[#6d7a5e] disabled:opacity-30 2xl:hidden"
            title="Annuler la dernière construction"
            aria-label="Annuler la dernière construction"
          >
            <Undo2 size={14} />
          </button>
          {game.saveStatus === "error" ? (
            <Save size={12} className="text-[#8a6e54]" />
          ) : (
            <CheckCheck size={13} />
          )}
          <span className="hidden sm:block">
            {game.saveStatus === "cloud"
              ? "Sauvegardé dans le cloud"
              : game.saveStatus === "error"
                ? "Sauvegarde indisponible"
                : game.lastSaved
                  ? "Partie sauvegardée"
                  : "Sauvegarde automatique"}
          </span>
          <span className="hidden h-4 w-px bg-[#e1e7d6] sm:mx-3 sm:block" />
          <Leaf size={14} strokeWidth={1.4} className="hidden sm:block" />
          <span className="hidden text-[9px] tracking-wider text-[#717768] sm:block">
            PRENEZ PLACE.
          </span>
        </div>
      </footer>

      {showObjectives && (
        <Modal title="Votre contrat" onClose={() => setShowObjectives(false)}>
          <div className="-mx-7 -my-6">{contractPanel}</div>
        </Modal>
      )}

      {modal === "help" && (
        <Modal
          title="Une bonne place, ça change tout."
          eyebrow="Bienvenue chez Parkside"
          onClose={closeModal}
          wide
        >
          <p className="text-[13px] leading-7 text-[#6d7762]">
            Vous aménagez les parkings des commerces du quartier. Offrez un
            trajet simple, une place libre et une traversée sûre. Les clients
            s’occupent de faire leurs courses.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              {
                icon: Route,
                title: "1. Aménagez",
                text: "Tracez des routes depuis l’entrée. Ajoutez des places, avec leur ouverture face à la route. R permet de les tourner.",
              },
              {
                icon: Smile,
                title: "2. Prenez soin des clients",
                text: "Reliez les places au magasin. Passages piétons et arbres améliorent la satisfaction ; les prix trop élevés la font baisser.",
              },
              {
                icon: Coins,
                title: "3. Faites tourner l’affaire",
                text: "Le paiement se fait à la barrière de sortie. Validez tous les objectifs pour obtenir une prime et le contrat suivant.",
              },
            ].map(({ icon: Icon, title, text }) => (
              <div
                key={title}
                className="rounded-xl border border-[#e5ebd9] bg-[#f6f9ee] p-4"
              >
                <Icon size={21} className="text-[#677855]" strokeWidth={1.5} />
                <h3 className="mt-4 text-[13px] font-semibold">{title}</h3>
                <p className="mt-2 text-[12px] leading-6 text-[#6b7a5b]">
                  {text}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-xl border border-[#eadfc8] bg-[#faf6ea] px-4 py-3 text-[12px] leading-6 text-[#7d755e]">
            Gardez un œil sur le contrat : un découvert ou une satisfaction
            inférieure à 35 % pendant 45 secondes de jeu met fin à la partie.
            L’entretien est prélevé toutes les 30 secondes. La simulation
            s’arrête quand cet onglet est masqué.
          </div>
          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-3 text-[11px] text-[#6d7a5f]">
            {[
              ["1–7", "Outils"],
              ["R", "Pivoter"],
              ["V", "Déplacer"],
              ["G", "Grille"],
              ["B", "Démolir"],
              ["⌘ / Ctrl Z", "Annuler"],
              ["Espace", "Pause"],
            ].map(([key, label]) => (
              <span key={key} className="flex items-center gap-2">
                <kbd className="game-kbd">{key}</kbd>
                {label}
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={closeModal}
            className="game-primary-button mt-7 ml-auto"
          >
            C’est parti
            <ArrowRight size={14} />
          </button>
        </Modal>
      )}

      {modal === "contracts" && (
        <Modal
          title="À chaque commerce, son défi."
          eyebrow="Votre entreprise grandit"
          onClose={closeModal}
          wide
        >
          <p className="mb-6 text-[13px] leading-6 text-[#6b7a5b]">
            Remplissez les objectifs de chaque contrat pour débloquer le
            suivant. Chaque nouveau terrain démarre avec son propre budget.
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            {LEVELS.map((item, i) => (
              <div
                key={item.name}
                className={`flex flex-col rounded-2xl border p-4 ${i === state.level ? "border-[#9db48b] bg-[#f2f6e9]" : "border-[#e6ebdc] bg-[#fafbf6]"}`}
              >
                <div className="relative flex h-[105px] items-center justify-center overflow-hidden rounded-xl bg-[#e2e9d4]">
                  <svg viewBox="0 0 150 90" className="h-full w-full">
                    <path d="M0 72h150" stroke="#f8f7ec" strokeWidth="15" />
                    <path
                      d="M0 72h150"
                      stroke="#c9ba7e"
                      strokeWidth=".8"
                      strokeDasharray="5 5"
                    />
                    <rect
                      x="31"
                      y="22"
                      width="90"
                      height="36"
                      rx="2"
                      fill="#a8b89a"
                      opacity=".3"
                    />
                    <rect
                      x="26"
                      y="16"
                      width="90"
                      height="36"
                      rx="2"
                      fill={item.roof}
                    />
                    <path d="M27 16h88l-6 5H33Z" fill="#a5b89d" />
                    <text
                      x="71"
                      y="38"
                      fontSize="7"
                      fill="#f9f8e9"
                      textAnchor="middle"
                      fontFamily="sans-serif"
                    >
                      {item.shop}
                    </text>
                    <path d="M28 52h86" stroke="#d6b09b" strokeWidth="5" />
                    <Tree x={134} y={40} small />
                    <g transform="translate(52 72) rotate(90) scale(.5)">
                      <CarSprite color="#ddb574" />
                    </g>
                  </svg>
                  {i > state.unlocked && (
                    <div className="absolute inset-0 flex items-center justify-center bg-[#eef2e5]/65">
                      <LockKeyhole
                        size={23}
                        className="text-[#6d7960]"
                        strokeWidth={1.5}
                      />
                    </div>
                  )}
                </div>
                <p className="mt-4 text-[9px] tracking-[0.15em] text-[#6e7565] uppercase">
                  Contrat 0{i + 1} · {item.type}
                </p>
                <h3 className="mt-2 text-[15px] leading-5 font-semibold tracking-tight">
                  {item.name}
                </h3>
                <p className="mt-2 flex-1 text-[11px] leading-5 text-[#6b775e]">
                  {item.subtitle}
                </p>
                <div className="mt-5 space-y-2 border-t border-[#e2e8d5] pt-3 text-[11px] text-[#6e7961]">
                  <div className="flex justify-between">
                    <span>Budget de départ</span>
                    <span className="font-medium">{euro(item.budget)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Places à aménager</span>
                    <span>{item.capacity}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Prime</span>
                    <span>{euro(item.reward)}</span>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={i > state.unlocked}
                  onClick={() =>
                    i === state.level ? closeModal() : requestContract(i)
                  }
                  className={`mt-5 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-3 text-[11px] font-medium ${i > state.unlocked ? "bg-[#eaeedf] text-[#717768]" : "bg-[#4c664e] text-[#f4f8eb] hover:bg-[#3b543e]"}`}
                >
                  {i > state.unlocked ? (
                    <>
                      <LockKeyhole size={11} />À débloquer
                    </>
                  ) : i === state.level ? (
                    "Reprendre le contrat"
                  ) : (
                    <>
                      Choisir ce contrat
                      <ArrowRight size={12} />
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {modal === "stats" && (
        <Modal
          title="Votre parking en quelques chiffres."
          eyebrow="Le carnet de bord"
          onClose={closeModal}
        >
          <div className="grid grid-cols-2 gap-3">
            <FinanceCard
              label="Recettes encaissées"
              value={euro(state.income, 2)}
              icon={ArrowUpRight}
            />
            <FinanceCard
              label="Dépenses et entretien"
              value={euro(state.expenses, 2)}
              icon={ArrowDownLeft}
            />
            <FinanceCard
              label="Clients accueillis"
              value={String(state.served)}
              icon={Smile}
            />
            <FinanceCard
              label="Clients sans solution"
              value={String(state.missed)}
              icon={CarFront}
            />
          </div>
          <div className="mt-6 space-y-4 rounded-xl border border-[#e1e8d5] p-5">
            {[
              ["Solde de départ", euro(level.budget)],
              [
                "Résultat d’exploitation",
                euro(state.income - state.expenses, 2),
              ],
              [
                "Prime de contrat",
                state.completed ? euro(level.reward) : "À débloquer",
              ],
              ["Trésorerie actuelle", euro(state.balance, 2)],
            ].map(([label, value], i) => (
              <div
                key={label}
                className={`flex items-center justify-between text-[12px] ${i === 3 ? "border-t border-[#e3e9d9] pt-4 font-semibold text-[#4e694b]" : "text-[#6f7764]"}`}
              >
                <span>{label}</span>
                <span>{value}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 flex items-center gap-3 rounded-xl bg-[#f3f6ea] p-4">
            <ShieldCheck
              size={25}
              className="text-[#6a775c]"
              strokeWidth={1.4}
            />
            <div>
              <p className="text-[12px] font-medium text-[#687959]">
                {state.happiness >= 80
                  ? "Votre réputation se porte bien."
                  : "Votre réputation mérite un peu d’attention."}
              </p>
              <div className="mt-2 flex gap-1">
                {Array.from({ length: 5 }, (_, i) => (
                  <Star
                    key={i}
                    size={12}
                    fill={
                      i < Math.round(state.happiness / 20)
                        ? "#bac69a"
                        : "transparent"
                    }
                    className="text-[#6f765c]"
                    strokeWidth={1.2}
                  />
                ))}
                <span className="ml-2 text-[10px] text-[#6d7a5f]">
                  {Math.round(state.happiness)} % de satisfaction
                </span>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {modal === "settings" && (
        <Modal
          title="À votre rythme."
          eyebrow="Les préférences"
          onClose={closeModal}
        >
          <div className="space-y-1">
            <SettingRow
              icon={soundOn ? Volume2 : VolumeX}
              title="Les petits sons du parking"
              text="Un son discret à chaque construction et paiement."
              active={soundOn}
              onClick={toggleSound}
            />
            <SettingRow
              icon={Grid2X2}
              title="Afficher la grille"
              text="Pour aménager votre terrain au millimètre."
              active={gridVisible}
              onClick={() => setGridVisible((value) => !value)}
            />
            <SettingRow
              icon={Leaf}
              title="Réduire les animations"
              text="Des déplacements sans transition visuelle."
              active={reducedMotion}
              onClick={() => setReducedMotion((value) => !value)}
            />
          </div>
          <div className="mt-6 flex flex-wrap gap-3 border-t border-[#e4e9da] pt-5">
            <button
              type="button"
              onClick={() => {
                void game.save();
                game.notify("Sauvegarde demandée.");
              }}
              className="game-secondary-button"
            >
              <Save size={14} />
              Sauvegarder
            </button>
            <button
              type="button"
              onClick={exportSave}
              className="game-secondary-button"
            >
              <Download size={14} />
              Exporter la partie
            </button>
          </div>
          <p className="mt-3 text-[11px] leading-6 text-[#6a775c]">
            La partie est enregistrée automatiquement sur cet appareil. Les
            comptes connectés bénéficient aussi d’une sauvegarde Convex.
          </p>
          {!game.isAuthenticated && (
            <a
              href="/sign-in"
              onClick={() => {
                void game.save();
              }}
              className="mt-3 inline-flex items-center gap-2 text-[11px] font-medium text-[#647d51]"
            >
              Connecter mon compte
              <ArrowRight size={12} />
            </a>
          )}
          <button
            type="button"
            onClick={() => requestContract(state.level)}
            className="mt-6 flex items-center gap-2 text-[12px] text-[#86725f] hover:text-[#8c6d50]"
          >
            <RotateCcw size={13} />
            Recommencer ce contrat
          </button>
        </Modal>
      )}

      {modal === "restart" && (
        <Modal
          title={
            pendingLevel === state.level
              ? "Un nouveau départ ?"
              : "Un terrain plus grand vous attend."
          }
          eyebrow="Changement de contrat"
          onClose={closeModal}
        >
          <p className="text-[13px] leading-7 text-[#6e7662]">
            {pendingLevel === state.level
              ? "Le parking et les comptes de ce contrat seront réinitialisés. Vos contrats débloqués restent disponibles."
              : "Vous démarrez ce contrat avec un nouveau parking et son budget de départ. Votre parking actuel sera remplacé. Vos contrats débloqués restent disponibles."}
          </p>
          <div className="mt-7 flex justify-end gap-3">
            <button
              type="button"
              onClick={closeModal}
              className="game-secondary-button"
            >
              Garder mon parking
            </button>
            <button
              type="button"
              onClick={() => {
                savedSpeed.current = 1;
                game.startContract(pendingLevel);
                selectTool("select");
                setPan({ x: 0, y: 0 });
                setZoom(1);
                closeModal();
              }}
              className="game-primary-button"
            >
              C’est parti
              <ArrowRight size={14} />
            </button>
          </div>
        </Modal>
      )}

      {state.status === "lost" && !modal && (
        <Modal
          title="Ce n’est qu’un au revoir."
          eyebrow="Fin du contrat"
          onClose={() => setModal("stats")}
        >
          <div className="flex size-14 items-center justify-center rounded-2xl bg-[#f3e9d9] text-[#837056]">
            <Flag size={25} strokeWidth={1.5} />
          </div>
          <p className="mt-5 text-[13px] leading-7 text-[#6d7562]">
            {state.lossReason} Le commerce a mis fin à votre contrat.
          </p>
          <p className="mt-3 text-[12px] leading-6 text-[#6d7963]">
            {state.served} clients ont utilisé votre parking. Reprenez ce que
            vous avez appris pour imaginer un meilleur aménagement.
          </p>
          <div className="mt-7 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setModal("stats")}
              className="game-secondary-button"
            >
              Voir le bilan
            </button>
            <button
              type="button"
              onClick={() => {
                savedSpeed.current = 1;
                game.startContract(state.level);
              }}
              className="game-primary-button"
            >
              <RotateCcw size={14} />
              Réessayer
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
  color,
  negative = false,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  sub: string;
  color: "green" | "yellow" | "blue" | "pink";
  negative?: boolean;
}) {
  const colors = {
    green: "bg-[#eaf0df] text-[#6c775b]",
    yellow: "bg-[#f3eedc] text-[#807350]",
    blue: "bg-[#e9eeeb] text-[#68766f]",
    pink: "bg-[#f2ebe3] text-[#867067]",
  };
  return (
    <div className="flex min-w-0 items-center gap-3 px-2 first:pl-2 sm:px-5 sm:first:pl-4">
      <span
        className={`hidden size-[37px] shrink-0 items-center justify-center rounded-xl md:flex ${colors[color]}`}
      >
        <Icon size={19} strokeWidth={1.5} />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[8px] font-medium tracking-[0.09em] text-[#6b795f] sm:text-[9px]">
          {label}
        </p>
        <div
          className={`mt-1.5 whitespace-nowrap text-[18px] leading-none font-semibold tracking-[-0.045em] tabular-nums sm:text-[24px] ${negative ? "text-[#9a6a54]" : "text-[#506449]"}`}
        >
          {value}
        </div>
        <p className="mt-2 hidden truncate text-[9px] text-[#6d7963] sm:block">
          {sub}
        </p>
      </div>
    </div>
  );
}

function RailButton({
  icon: Icon,
  label,
  onClick,
  active = false,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-[64px] flex-col items-center gap-2 py-1.5"
      aria-pressed={active}
    >
      <span
        className={`flex size-[39px] items-center justify-center rounded-xl transition-colors ${active ? "bg-[#e7eede] text-[#647951]" : "text-[#6d7a5f] group-hover:bg-[#f0f4e7] group-hover:text-[#667a52]"}`}
      >
        <Icon size={18} strokeWidth={1.5} />
      </span>
      <span
        className={`text-[9px] ${active ? "font-medium text-[#687a56]" : "text-[#6d7a5f]"}`}
      >
        {label}
      </span>
    </button>
  );
}

function FinanceCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-xl border border-[#e5ebdb] bg-[#f8faf3] p-4">
      <Icon size={17} className="text-[#6c785e]" strokeWidth={1.5} />
      <p className="mt-3 text-[22px] font-semibold tracking-tight text-[#5d7750]">
        {value}
      </p>
      <p className="mt-1 text-[11px] text-[#69775b]">{label}</p>
    </div>
  );
}

function SettingRow({
  icon: Icon,
  title,
  text,
  active,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-[#e8eddf] py-4 last:border-0">
      <Icon size={18} className="shrink-0 text-[#6c7760]" strokeWidth={1.5} />
      <div className="flex-1">
        <p className="text-[13px] font-medium text-[#657c56]">{title}</p>
        <p className="mt-1.5 text-[11px] leading-5 text-[#6b765b]">{text}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={active}
        aria-label={title}
        onClick={onClick}
        className={`flex h-[22px] w-[38px] shrink-0 items-center rounded-full px-[3px] transition-colors ${active ? "bg-[#8ca87a]" : "bg-[#dfe6d4]"}`}
      >
        <span
          className={`size-4 rounded-full bg-[#fdfef8] shadow-sm transition-transform ${active ? "translate-x-4" : "translate-x-0"}`}
        />
      </button>
    </div>
  );
}
