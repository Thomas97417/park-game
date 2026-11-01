import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  CheckCheck,
  ChevronDown,
  Download,
  Eraser,
  Expand,
  Flag,
  LockKeyhole,
  Minus,
  MousePointer2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  RotateCw,
  Save,
  Trash2,
  Trophy,
  Undo2,
  X,
} from "lucide-react";
import {
  BarrierIcon,
  BenchIcon,
  CarIcon,
  ContractsIcon,
  CrossingIcon,
  EntranceIcon,
  FinanceIcon,
  FlowersIcon,
  GridIcon,
  HelpIcon,
  IncomeIcon,
  LampIcon,
  MotionIcon,
  MutedIcon,
  ObjectivesIcon,
  ParkingIcon,
  RoadIcon,
  RoundaboutIcon,
  SatisfactionIcon,
  SettingsIcon,
  SoundIcon,
  TreasuryIcon,
  TreeIcon,
  type GameIcon,
} from "./game-icons";
import { LEVELS, TILE_LABELS, TOOLS, euro, type Tool } from "@/game/catalog";
import {
  canRotate,
  clockTime,
  infrastructure,
  objectives,
  type Point,
} from "@/game/engine";
import { useParkingGame } from "@/game/use-parking-game";
import { GameMap, CarSprite, Tree } from "./game-map";

const TOOL_ICONS: Partial<Record<Tool, GameIcon>> = {
  road: RoadIcon,
  parking: ParkingIcon,
  crossing: CrossingIcon,
  gate: BarrierIcon,
  roundabout: RoundaboutIcon,
  tree: TreeIcon,
  entry: EntranceIcon,
  lamp: LampIcon,
  bench: BenchIcon,
  flowers: FlowersIcon,
};

function IconButton({
  label,
  icon: Icon,
  onClick,
  active,
  disabled = false,
  className = "",
  iconSize = 20,
}: {
  label: string;
  icon: GameIcon;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  className?: string;
  iconSize?: number;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`game-icon-button ${active ? "bg-[#e4ecda] text-[#3d6249]" : "text-[#697b5e]"} ${className}`}
    >
      <Icon size={iconSize} strokeWidth={1.7} />
    </button>
  );
}
function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
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
      className={`game-dialog ${wide ? "w-[700px]" : "w-[480px]"}`}
      aria-labelledby="game-dialog-title"
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
    >
      <div className="flex items-center justify-between gap-4 border-b border-[#e1e7d7] px-6 py-4">
        <h2
          id="game-dialog-title"
          className="text-xl font-semibold tracking-tight text-[#354e3b]"
        >
          {title}
        </h2>
        <IconButton label="Fermer" icon={X} onClick={onClose} />
      </div>
      <div className="p-6">{children}</div>
    </dialog>
  );
}

export function ParkingGame() {
  const game = useParkingGame();
  const { state } = game;
  const [tool, setTool] = useState<Tool>("select");
  const [rotation, setRotation] = useState(0);
  const [selection, setSelection] = useState<Point | null>(null);
  const [gridVisible, setGridVisible] = useState(false);
  const [zoom, setZoom] = useState(1.1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [modal, setModal] = useState<
    | "help"
    | "contracts"
    | "objectives"
    | "stats"
    | "settings"
    | "restart"
    | null
  >(null);
  const [pendingLevel, setPendingLevel] = useState(0);
  const [soundOn, setSoundOn] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const soundRef = useRef(false);
  const previousIncome = useRef(state.income);
  const previousSpeed = useRef(0);
  const level = LEVELS[state.level];
  const info = infrastructure(state.grid);
  const goals = objectives(state);
  const completedGoals = goals.filter((goal) => goal.done).length;
  const selectedTile = selection
    ? state.grid[selection.y]?.[selection.x]
    : undefined;
  const selectedTool = TOOLS.find((item) => item.id === tool);
  const rotatable = selection
    ? canRotate(selectedTile)
    : ["parking", "crossing", "entry", "gate", "lamp", "bench"].includes(tool);
  const occupied = state.cars.filter((car) => car.phase !== "leaving").length;
  const dialogOpen = !!modal || state.status === "lost";

  const tone = useCallback((frequency = 450) => {
    if (!soundRef.current) return;
    try {
      audio.current ??= new AudioContext();
      void audio.current.resume();
      const oscillator = audio.current.createOscillator(),
        gain = audio.current.createGain();
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
      /* Audio is optional. */
    }
  }, []);
  useEffect(() => {
    if (state.income > previousIncome.current) tone(740);
    previousIncome.current = state.income;
  }, [state.income, tone]);
  useEffect(() => {
    if (dialogOpen) {
      previousSpeed.current = game.speed;
      game.setSpeed(0);
    } else game.setSpeed(previousSpeed.current);
    // Preserve the player's speed when a dialog opens or closes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialogOpen]);
  useEffect(() => {
    try {
      const enabled = localStorage.getItem("parkside-sound") === "true";
      soundRef.current = enabled;
      setSoundOn(enabled);
    } catch {
      /* optional */
    }
    setReducedMotion(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
    if (window.matchMedia("(max-width: 639px)").matches) setZoom(1.2);
    return () => {
      void audio.current?.close();
    };
  }, []);
  useEffect(() => {
    if (selectedTile?.kind === "grass") setSelection(null);
  }, [selectedTile?.kind]);

  const selectTool = useCallback((next: Tool) => {
    setTool(next);
    setSelection(null);
  }, []);
  const selectElement = useCallback(
    (point: Point) => {
      setTool("select");
      const tile = game.stateRef.current.grid[point.y]?.[point.x];
      setSelection(tile && tile.kind !== "grass" ? point : null);
    },
    [game.stateRef],
  );
  const rotate = useCallback(() => {
    if (selection) {
      if (game.rotate(selection)) tone(420);
    } else setRotation((value) => (value + 1) % 4);
  }, [game.rotate, selection, tone]);
  const remove = useCallback(() => {
    if (selection && game.place("erase", selection, 0)) {
      setSelection(null);
      tone(300);
    }
  }, [game.place, selection, tone]);
  const togglePlayback = useCallback(() => {
    if (!game.stateRef.current.opened) game.open();
    else game.setSpeed((value) => (value ? 0 : 1));
  }, [game.open, game.setSpeed, game.stateRef]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        dialogOpen ||
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
      if (event.key.toLowerCase() === "r" && rotatable) {
        event.preventDefault();
        rotate();
      }
      if ((event.key === "Delete" || event.key === "Backspace") && selection) {
        event.preventDefault();
        remove();
      }
      if (
        event.code === "Space" &&
        !(event.target instanceof HTMLButtonElement)
      ) {
        event.preventDefault();
        togglePlayback();
      }
      if (event.key.toLowerCase() === "g") setGridVisible((value) => !value);
      if (event.key.toLowerCase() === "v" || event.key === "Escape")
        selectTool("select");
      if (event.key.toLowerCase() === "b") selectTool("erase");
      const next = TOOLS.find((item) => item.key === event.key);
      if (next) selectTool(next.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    dialogOpen,
    game.undo,
    remove,
    rotatable,
    rotate,
    selectTool,
    selection,
    togglePlayback,
  ]);

  const toggleSound = () => {
    soundRef.current = !soundOn;
    setSoundOn(!soundOn);
    try {
      localStorage.setItem("parkside-sound", String(!soundOn));
    } catch {
      /*optional*/
    }
    tone();
  };
  const requestContract = (index: number) => {
    setPendingLevel(index);
    setModal("restart");
  };
  const startContract = () => {
    previousSpeed.current = 0;
    game.startContract(pendingLevel);
    selectTool("select");
    setRotation(0);
    setPan({ x: 0, y: 0 });
    setZoom(window.matchMedia("(max-width: 639px)").matches ? 1.2 : 1.1);
    setModal(null);
  };
  const exportSave = () => {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            { ...game.stateRef.current, savedAt: Date.now() },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "parkside-sauvegarde.json";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const playback = (
    <>
      <span
        className="mr-1 whitespace-nowrap text-[10px] text-[#7a8e68]"
        title={`Jour ${Math.floor(state.elapsed / 240) + 1}`}
      >
        <span className="mr-2 font-medium text-[#587246]">
          J{Math.floor(state.elapsed / 240) + 1}
        </span>
        {clockTime(state.elapsed)}
      </span>
      <button
        type="button"
        onClick={togglePlayback}
        disabled={
          state.status === "lost" || (!state.opened && info.usable.length === 0)
        }
        aria-label={
          !state.opened
            ? "Ouvrir le parking"
            : game.speed
              ? "Mettre en pause (Espace)"
              : "Reprendre (Espace)"
        }
        title={
          !state.opened
            ? "Ouvrir : reliez une entrée, une sortie et une place au magasin"
            : "Pause / lecture (Espace)"
        }
        className={`flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg px-2.5 text-[10px] font-medium disabled:cursor-default disabled:opacity-35 ${state.opened ? "text-[#486846] hover:bg-[#e8eedf]" : "bg-[#486548] text-[#f4f7ec]"}`}
      >
        {game.speed ? (
          <Pause size={13} fill="currentColor" strokeWidth={0} />
        ) : (
          <Play size={13} fill="currentColor" strokeWidth={0} />
        )}
        {!state.opened && "Ouvrir"}
      </button>
      <select
        aria-label="Vitesse de simulation"
        title="Vitesse de simulation"
        value={game.speed || 1}
        disabled={!state.opened || state.status === "lost"}
        onChange={(event) => game.setSpeed(Number(event.target.value))}
        className="h-7 w-10 shrink-0 rounded-md border-0 bg-[#edf2e4] pl-1 text-[10px] text-[#617d50] disabled:opacity-35"
      >
        <option value={1}>1×</option>
        <option value={2}>2×</option>
        <option value={3}>3×</option>
      </select>
    </>
  );
  const menuButtons = (
    <>
      <IconButton
        label={`Objectifs (${completedGoals}/4)`}
        icon={ObjectivesIcon}
        iconSize={25}
        active={modal === "objectives"}
        onClick={() => setModal("objectives")}
        className="!size-9"
      />
      <IconButton
        label="Contrats"
        icon={ContractsIcon}
        iconSize={25}
        onClick={() => setModal("contracts")}
        className="!size-9"
      />
      <IconButton
        label="Finances"
        icon={FinanceIcon}
        iconSize={25}
        onClick={() => setModal("stats")}
        className="!size-9"
      />
      <IconButton
        label="Comment jouer"
        icon={HelpIcon}
        iconSize={25}
        onClick={() => setModal("help")}
        className="!size-9"
      />
      <IconButton
        label="Paramètres"
        icon={SettingsIcon}
        iconSize={25}
        onClick={() => setModal("settings")}
        className="!size-9"
      />
    </>
  );

  return (
    <div
      className={`parkside flex h-svh w-full flex-col overflow-hidden bg-[#e2e9d6] text-[#354e3b] ${reducedMotion ? "reduce-motion" : ""}`}
    >
      <main
        className="relative min-h-0 flex-1"
        aria-label="Aménagement du parking"
      >
        <GameMap
          state={state}
          tool={tool}
          rotation={rotation}
          gridVisible={gridVisible}
          zoom={zoom}
          pan={pan}
          selection={selection}
          setPan={setPan}
          onSelect={selectElement}
          onPlace={(next, point, angle) => {
            if (game.place(next, point, angle)) tone(360);
          }}
        />
        <button
          type="button"
          onClick={() => setModal("contracts")}
          className="absolute top-4 left-4 flex max-w-[calc(100%_-_80px)] items-center gap-2.5 rounded-xl border border-[#e3e9d8] bg-[#fcfdf6]/95 p-2.5 pr-3.5 text-left shadow-[0_3px_14px_#3d543a0c] sm:top-5 sm:left-5"
          aria-label={`Contrat ${state.level + 1} : ${level.name}`}
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-[#3e5a46] text-[23px] font-semibold text-[#eff4e5]">
            p.
          </span>
          <span className="min-w-0">
            <span className="block text-[10px] font-medium text-[#7d8d71]">
              Parkside · {state.opened ? "Contrat" : "Construction"} 0
              {state.level + 1}
            </span>
            <span className="mt-0.5 block truncate text-[12px] font-semibold text-[#48603e]">
              {level.name}
            </span>
          </span>
          <ChevronDown size={12} className="ml-2 shrink-0 text-[#8b9a7b]" />
        </button>
        <aside
          aria-label="Menus et affichage"
          className="absolute top-4 right-4 bottom-4 flex w-[46px] flex-col gap-3 overflow-y-auto [scrollbar-width:none] sm:top-5 sm:right-5 sm:bottom-5"
        >
          <div className="flex shrink-0 flex-col items-center gap-1 rounded-xl border border-[#e1e7d5] bg-[#fbfcf5]/95 p-1 shadow-[0_3px_14px_#3d543a0c]">
            <IconButton
              label="Zoom avant"
              icon={Plus}
              onClick={() => setZoom((value) => Math.min(2.8, value + 0.2))}
              disabled={zoom >= 2.8}
              className="!size-9"
            />
            <span className="text-center text-[9px] text-[#7f906e] tabular-nums">
              {Math.round(zoom * 100)}%
            </span>
            <IconButton
              label="Zoom arrière"
              icon={Minus}
              onClick={() => setZoom((value) => Math.max(0.6, value - 0.2))}
              disabled={zoom <= 0.6}
              className="!size-9"
            />
            <div className="mx-2 my-1 h-px w-5 bg-[#dfe7d1]" />
            <IconButton
              label="Recentrer la carte"
              icon={Expand}
              onClick={() => {
                setZoom(
                  window.matchMedia("(max-width: 639px)").matches ? 1.2 : 1.1,
                );
                setPan({ x: 0, y: 0 });
              }}
              className="!size-9"
            />
            <IconButton
              label="Afficher la grille (G)"
              icon={GridIcon}
              iconSize={24}
              active={gridVisible}
              onClick={() => setGridVisible((value) => !value)}
              className="!size-9"
            />
          </div>
          <nav
            aria-label="Gestion et paramètres"
            className="mt-auto flex shrink-0 flex-col items-center gap-1 rounded-xl border border-[#e1e7d5] bg-[#fbfcf5]/95 p-1 shadow-[0_3px_14px_#3d543a0c]"
          >
            {menuButtons}
            <span
              role="status"
              aria-label={
                game.saveStatus === "error"
                  ? "Sauvegarde indisponible"
                  : game.saveStatus === "cloud"
                    ? "Sauvegardé dans le cloud"
                    : "Sauvegarde locale automatique"
              }
              title={
                game.saveStatus === "error"
                  ? "Sauvegarde indisponible"
                  : game.saveStatus === "cloud"
                    ? "Sauvegardé dans le cloud"
                    : "Sauvegarde locale automatique"
              }
              className="flex h-5 items-center justify-center text-[#8ba174]"
            >
              {game.saveStatus === "error" ? (
                <Save size={13} className="text-[#b08d67]" />
              ) : (
                <CheckCheck size={13} />
              )}
            </span>
          </nav>
        </aside>
        {game.notice && (
          <div
            role="status"
            className="absolute bottom-4 left-1/2 max-w-[calc(100%_-_32px)] -translate-x-1/2 rounded-xl border border-[#dce5ce] bg-[#fdfef8] px-4 py-3 text-center text-[12px] text-[#657b54] shadow-[0_4px_24px_#4c643515]"
          >
            {game.notice}
          </div>
        )}
        {(state.debtTime > 0 || state.unhappyTime > 0) &&
          state.status !== "lost" && (
            <div
              role="alert"
              className="absolute top-24 left-1/2 max-w-[calc(100%_-_32px)] -translate-x-1/2 rounded-lg border border-[#d4b393] bg-[#fbf0df] px-4 py-2 text-[12px] text-[#94704b]"
            >
              Contrat en danger ·{" "}
              {Math.ceil(45 - Math.max(state.debtTime, state.unhappyTime))} s
              pour rétablir la situation
            </div>
          )}
      </main>

      <footer
        aria-label="Construction et gestion du parking"
        className="z-10 shrink-0 border-t border-[#cfd9c1] bg-[#fcfdf7] shadow-[0_-3px_20px_#40573608]"
      >
        <div className="flex h-16 flex-nowrap items-center gap-2 overflow-x-auto overflow-y-hidden px-3 [scrollbar-color:#bdcdae_transparent] [scrollbar-width:thin] sm:gap-3 sm:px-4">
          <div
            className="flex shrink-0 items-center gap-3"
            aria-label="Indicateurs du parking"
          >
            <Metric
              icon={TreasuryIcon}
              label="Trésorerie"
              value={euro(state.balance)}
              negative={state.balance < 0}
            />
            <Metric
              icon={IncomeIcon}
              label="Recettes"
              value={euro(state.income, state.income % 1 ? 1 : 0)}
            />
            <Metric
              icon={CarIcon}
              label="Stationnement"
              value={
                <>
                  {occupied}
                  <span className="ml-0.5 text-[11px] font-normal text-[#829570]">
                    / {info.usable.length}
                  </span>
                </>
              }
            />
            <Metric
              icon={SatisfactionIcon}
              label="Satisfaction"
              value={`${Math.round(state.happiness)} %`}
              negative={state.happiness < 35}
            />
          </div>
          <div className="mx-0.5 h-7 w-px shrink-0 bg-[#dfe6d4]" />
          <div
            className="flex shrink-0 items-center gap-0.5"
            aria-label="Outils de construction"
          >
            <IconButton
              label="Sélectionner / déplacer (V)"
              icon={MousePointer2}
              active={tool === "select"}
              onClick={() => selectTool("select")}
              className="!size-10"
            />
            {TOOLS.map((item) => {
              const Icon = TOOL_ICONS[item.id]!;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-label={`${item.label} — ${euro(item.price)} (touche ${item.key})`}
                  aria-pressed={tool === item.id}
                  onClick={() => selectTool(item.id)}
                  title={`${item.label} · ${euro(item.price)} · ${item.description} (${item.key})`}
                  className={`flex size-10 shrink-0 items-center justify-center rounded-[10px] transition-colors ${tool === item.id ? "bg-[#e1ebd5] shadow-[inset_0_0_0_1px_#97b17f]" : "hover:bg-[#eff3e8]"}`}
                >
                  <Icon size={27} />
                </button>
              );
            })}
          </div>
          <div className="mx-0.5 h-7 w-px shrink-0 bg-[#dfe6d4]" />
          <div
            className="flex shrink-0 items-center gap-0.5"
            aria-label="Modifier la sélection"
          >
            <button
              type="button"
              aria-label="Pivoter (R)"
              title={`${selectedTile ? TILE_LABELS[selectedTile.group ? "roundabout" : selectedTile.kind] : (selectedTool?.label ?? "Sélection")} · ${(selectedTile?.rotation ?? rotation) * 90}° · Pivoter de 90° (R)`}
              onClick={rotate}
              disabled={!rotatable}
              className="flex size-9 shrink-0 items-center justify-center rounded-lg text-[#5c7c48] hover:bg-[#edf2e4] disabled:cursor-default disabled:opacity-30"
            >
              <RotateCw size={21} strokeWidth={1.7} />
            </button>
            {selection ? (
              <IconButton
                label="Supprimer la sélection (Suppr)"
                icon={Trash2}
                onClick={remove}
                disabled={!!selectedTile?.fixed}
                className="!size-9"
              />
            ) : (
              <IconButton
                label="Démolir (B)"
                icon={Eraser}
                active={tool === "erase"}
                onClick={() => selectTool("erase")}
                className="!size-9"
              />
            )}
            <IconButton
              label="Annuler (Ctrl ou ⌘ Z)"
              icon={Undo2}
              onClick={game.undo}
              disabled={!game.canUndo}
              className="!size-9"
            />
          </div>
          <div className="mx-0.5 h-7 w-px shrink-0 bg-[#dfe6d4]" />
          <div
            className="ml-auto flex shrink-0 items-center gap-1"
            aria-label="Heure et simulation"
          >
            {playback}
          </div>
        </div>
      </footer>

      {modal === "objectives" && (
        <Modal title={level.name} onClose={() => setModal(null)}>
          <div className="mb-5 flex items-center justify-between text-[11px] text-[#80916e]">
            <span>
              Contrat 0{state.level + 1} · {level.type}
            </span>
            <span>{completedGoals}/4 objectifs</span>
          </div>
          {goals.map((goal) => (
            <div
              key={goal.label}
              className="flex items-center gap-3 border-b border-[#e5eadc] py-3.5"
            >
              <span
                className={`flex size-5 items-center justify-center rounded-full border ${goal.done ? "border-[#8fa77c] bg-[#8fa77c] text-white" : "border-[#cfd9c0]"}`}
              >
                {goal.done && <Check size={12} />}
              </span>
              <span className="flex-1 text-[12px] text-[#687e58]">
                {goal.label}
              </span>
              <span className="text-[11px] text-[#7d916b] tabular-nums">
                {goal.value} / {goal.target}
                {goal.unit === "%" ? " %" : ""}
              </span>
            </div>
          ))}
          <div className="mt-4 flex justify-between rounded-lg bg-[#f0efdf] p-3 text-[12px] text-[#8b825e]">
            <span className="flex items-center gap-2">
              <Trophy size={14} />
              Prime
            </span>
            <span>+ {euro(level.reward)}</span>
          </div>
          {completedGoals === 4 && !state.completed && (
            <button
              type="button"
              onClick={game.completeContract}
              className="game-primary-button mt-4 w-full justify-center"
            >
              <BadgeCheck size={15} />
              Valider le contrat
            </button>
          )}
          {state.completed && (
            <button
              type="button"
              onClick={() => setModal("contracts")}
              className="game-primary-button mt-4 w-full justify-center"
            >
              {state.level === 2 ? "Contrats" : "Contrat suivant"}
              <ArrowRight size={14} />
            </button>
          )}
          <div className="mt-6 flex items-center justify-between">
            <span className="text-[12px] text-[#657e55]">Tarif par visite</span>
            <div className="flex items-center gap-2 rounded-lg border border-[#dfe6d3] p-1">
              <IconButton
                label="Diminuer le tarif"
                icon={Minus}
                disabled={state.price <= 1}
                onClick={() => game.setPrice(state.price - 0.5)}
              />
              <span className="min-w-[72px] text-center text-sm font-semibold">
                {euro(state.price, 2)}
              </span>
              <IconButton
                label="Augmenter le tarif"
                icon={Plus}
                disabled={state.price >= 8}
                onClick={() => game.setPrice(state.price + 0.5)}
              />
            </div>
          </div>
        </Modal>
      )}
      {modal === "contracts" && (
        <Modal title="Contrats" onClose={() => setModal(null)} wide>
          <div className="grid gap-4 sm:grid-cols-3">
            {LEVELS.map((item, i) => (
              <div
                key={item.name}
                className={`flex flex-col rounded-xl border p-4 ${i === state.level ? "border-[#95ad82] bg-[#f1f5e8]" : "border-[#e0e7d4] bg-[#f8faf2]"}`}
              >
                <div className="relative overflow-hidden rounded-lg bg-[#e1e8d3]">
                  <svg viewBox="0 0 150 90" className="w-full">
                    <path d="M0 72h150" stroke="#f9f7ec" strokeWidth="15" />
                    <rect
                      x="26"
                      y="16"
                      width="90"
                      height="36"
                      rx="2"
                      fill={item.roof}
                    />
                    <text
                      x="71"
                      y="38"
                      fontSize="7"
                      fill="#f9f8e9"
                      textAnchor="middle"
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
                    <div className="absolute inset-0 flex items-center justify-center bg-[#edf2e3]/70">
                      <LockKeyhole size={21} className="text-[#7e906e]" />
                    </div>
                  )}
                </div>
                <p className="mt-4 text-[10px] text-[#80926e]">
                  0{i + 1} · {item.type}
                </p>
                <h3 className="mt-2 flex-1 text-[14px] font-semibold leading-5 tracking-tight">
                  {item.name}
                </h3>
                <div className="mt-4 space-y-2 text-[11px] text-[#7f906e]">
                  <div className="flex justify-between">
                    <span>Budget</span>
                    <span>{euro(item.budget)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Objectif</span>
                    <span>{item.capacity} places</span>
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
                    i === state.level ? setModal(null) : requestContract(i)
                  }
                  className="game-primary-button mt-5 justify-center disabled:bg-[#e6ecda] disabled:text-[#859572]"
                >
                  {i > state.unlocked ? (
                    <>
                      <LockKeyhole size={12} />
                      Verrouillé
                    </>
                  ) : i === state.level ? (
                    "Reprendre"
                  ) : (
                    "Choisir"
                  )}
                </button>
              </div>
            ))}
          </div>
        </Modal>
      )}
      {modal === "stats" && (
        <Modal title="Finances" onClose={() => setModal(null)}>
          <div className="grid grid-cols-2 gap-3">
            {[
              ["Recettes", euro(state.income, 2)],
              ["Dépenses nettes", euro(state.expenses, 2)],
              ["Clients servis", String(state.served)],
              ["Clients perdus", String(state.missed)],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-[#e1e8d5] bg-[#f6f9ef] p-4"
              >
                <p className="text-[11px] text-[#7f936b]">{label}</p>
                <p className="mt-2 text-xl font-semibold tracking-tight text-[#536f47]">
                  {value}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-5 flex items-center justify-between border-t border-[#dfe6d3] pt-4 text-[12px]">
            <span>Trésorerie</span>
            <strong>{euro(state.balance, 2)}</strong>
          </div>
        </Modal>
      )}
      {modal === "help" && (
        <Modal title="Comment jouer" onClose={() => setModal(null)}>
          <ol className="list-inside list-decimal space-y-3 text-[12px] leading-6 text-[#71865e]">
            <li>Tracez une route depuis la voie publique jusqu’au magasin.</li>
            <li>Posez une entrée et une barrière de sortie sur vos routes.</li>
            <li>Ajoutez des places, leur ouverture orientée vers la route.</li>
            <li>Ajoutez des passages piétons, puis cliquez sur « Ouvrir ».</li>
          </ol>
          <p className="mt-5 border-t border-[#e1e8d6] pt-4 text-[12px] leading-6 text-[#7a8d68]">
            Cliquez sur un élément pour le sélectionner, puis utilisez Pivoter
            ou Supprimer. Le clic droit sélectionne un élément pendant la
            construction. Tracer une route remplace les décors.
          </p>
          <div className="mt-5 flex flex-wrap gap-3 text-[10px] text-[#7a8f66]">
            {[
              ["1–0", "Outils"],
              ["R", "Pivoter"],
              ["Suppr", "Supprimer"],
              ["V", "Sélection"],
              ["G", "Grille"],
              ["Espace", "Pause"],
              ["⌘ / Ctrl Z", "Annuler"],
            ].map(([key, label]) => (
              <span key={key} className="flex items-center gap-1.5">
                <kbd className="game-kbd">{key}</kbd>
                {label}
              </span>
            ))}
          </div>
          <p className="mt-5 rounded-lg bg-[#f5efdf] p-3 text-[11px] leading-6 text-[#97815d]">
            Après ouverture, un découvert ou une satisfaction sous 35 % pendant
            45 secondes de jeu entraîne la perte du contrat.
          </p>
        </Modal>
      )}
      {modal === "settings" && (
        <Modal title="Paramètres" onClose={() => setModal(null)}>
          <SettingRow
            label="Sons"
            icon={soundOn ? SoundIcon : MutedIcon}
            active={soundOn}
            onClick={toggleSound}
          />
          <SettingRow
            label="Grille"
            icon={GridIcon}
            active={gridVisible}
            onClick={() => setGridVisible((value) => !value)}
          />
          <SettingRow
            label="Réduire les animations"
            icon={MotionIcon}
            active={reducedMotion}
            onClick={() => setReducedMotion((value) => !value)}
          />
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                void game.save();
                game.notify("Partie sauvegardée.");
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
              Exporter
            </button>
          </div>
          {!game.isAuthenticated && (
            <a
              href="/sign-in"
              onClick={() => {
                void game.save();
              }}
              className="mt-4 inline-flex items-center gap-2 text-[11px] text-[#718d5c]"
            >
              Connexion pour la sauvegarde cloud
              <ArrowRight size={12} />
            </a>
          )}
          <button
            type="button"
            onClick={() => requestContract(state.level)}
            className="mt-6 flex items-center gap-2 text-[11px] text-[#a08465]"
          >
            <RotateCcw size={13} />
            Recommencer sur un terrain vide
          </button>
        </Modal>
      )}
      {modal === "restart" && (
        <Modal
          title={
            pendingLevel === state.level
              ? "Recommencer le contrat ?"
              : "Changer de contrat ?"
          }
          onClose={() => setModal(null)}
        >
          <p className="text-[12px] leading-6 text-[#7b8e67]">
            Le parking actuel sera remplacé par un terrain vide. Les contrats
            débloqués restent disponibles.
          </p>
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setModal(null)}
              className="game-secondary-button"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={startContract}
              className="game-primary-button"
            >
              Commencer
              <ArrowRight size={14} />
            </button>
          </div>
        </Modal>
      )}
      {state.status === "lost" && !modal && (
        <Modal title="Contrat perdu" onClose={() => setModal("stats")}>
          <Flag size={30} className="text-[#a28b68]" />
          <p className="mt-4 text-[12px] leading-6 text-[#7d8c6b]">
            {state.lossReason}
          </p>
          <p className="mt-2 text-[12px] text-[#8e9d7c]">
            {state.served} clients servis.
          </p>
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setModal("stats")}
              className="game-secondary-button"
            >
              Bilan
            </button>
            <button
              type="button"
              onClick={() => {
                previousSpeed.current = 0;
                game.startContract(state.level);
                selectTool("select");
              }}
              className="game-primary-button"
            >
              <RotateCcw size={14} />
              Recommencer
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  negative = false,
}: {
  icon: GameIcon;
  label: string;
  value: ReactNode;
  negative?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      title={label}
      className="flex shrink-0 items-center gap-1.5"
    >
      <Icon size={24} className="shrink-0" />
      <span
        className={`whitespace-nowrap text-[13px] leading-none font-semibold tracking-tight tabular-nums ${negative ? "text-[#b07859]" : "text-[#46613e]"}`}
      >
        {value}
      </span>
    </div>
  );
}
function SettingRow({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  icon: GameIcon;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-[#e3ead8] py-3 last:border-0">
      <Icon size={25} className="shrink-0" />
      <span className="flex-1 text-[12px] text-[#6d8459]">{label}</span>
      <button
        type="button"
        role="switch"
        aria-label={label}
        aria-checked={active}
        onClick={onClick}
        className={`flex h-[22px] w-[38px] items-center rounded-full px-[3px] ${active ? "bg-[#87a171]" : "bg-[#d9e2cb]"}`}
      >
        <span
          className={`size-4 rounded-full bg-white transition-transform ${active ? "translate-x-4" : ""}`}
        />
      </button>
    </div>
  );
}
