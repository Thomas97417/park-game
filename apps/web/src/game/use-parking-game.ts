import { useCallback, useEffect, useRef, useState } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@my-better-t-app/backend/convex/_generated/api";
import { parseParkingSave } from "@my-better-t-app/backend/convex/lib/parkingState";
import {
  build,
  claimContract,
  createGame,
  step,
  rotatePlaced,
  setBarrierKind,
  openParking,
  infrastructure,
  openingStatus,
  type BuildResult,
  type BuildUndo,
  type ParkingState,
  type Point,
  type TollPayment,
  type UpkeepCharge,
} from "./engine";
import { STORAGE_KEY, type Tool, type RoadType } from "./catalog";

export function useParkingGame() {
  const [state, setState] = useState<ParkingState>(() => createGame());
  const [speed, setSpeed] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [payments, setPayments] = useState<TollPayment[]>([]);
  const [upkeepNotice, setUpkeepNotice] = useState<UpkeepCharge | null>(null);
  const [ready, setReady] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"local" | "cloud" | "error">(
    "local",
  );
  const [lastSaved, setLastSaved] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const stateRef = useRef(state);
  const history = useRef<BuildUndo[]>([]);
  const restoredCloud = useRef(false);
  const initialSavedAt = useRef(0);
  const hasLocalEdits = useRef(false);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const { isAuthenticated } = useConvexAuth();
  const cloudSave = useQuery(api.parking.load, isAuthenticated ? {} : "skip");
  const saveToCloud = useMutation(api.parking.save);

  const update = useCallback(
    (next: ParkingState | ((previous: ParkingState) => ParkingState)) => {
      const value = typeof next === "function" ? next(stateRef.current) : next;
      stateRef.current = value;
      setState(value);
    },
    [],
  );

  const notify = useCallback((message: string) => {
    setNotice(message);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 3500);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = parseParkingSave(raw);
        if (saved) {
          update(saved);
          setPayments([]);
          setUpkeepNotice(null);
          setPlaybackRate(1);
          initialSavedAt.current = saved.savedAt;
          setSpeed(saved.opened ? 1 : 0);
          setLastSaved(saved.savedAt);
        } else
          notify(
            "La sauvegarde est incompatible. Un nouveau contrat est prêt.",
          );
      }
    } catch {
      setSaveStatus("error");
    }
    setReady(true);
    return () => clearTimeout(noticeTimer.current);
  }, [notify, update]);

  useEffect(() => {
    if (!isAuthenticated) {
      restoredCloud.current = false;
      return;
    }
    if (!ready || cloudSave === undefined || restoredCloud.current) return;
    restoredCloud.current = true;
    const saved = cloudSave ? parseParkingSave(cloudSave) : null;
    // An autosave while the network is loading is not a new player decision.
    if (
      saved &&
      saved.savedAt > initialSavedAt.current &&
      !hasLocalEdits.current
    ) {
      update(saved);
      setPayments([]);
      setUpkeepNotice(null);
      setPlaybackRate(1);
      setSpeed(saved.opened ? 1 : 0);
      history.current = [];
      setCanUndo(false);
      notify("Votre contrat a été restauré depuis le cloud.");
    }
  }, [cloudSave, isAuthenticated, notify, ready, update]);

  const save = useCallback(async () => {
    const snapshot = { ...stateRef.current, savedAt: Date.now() };
    const serialized = JSON.stringify(snapshot);
    let localSaved = false;
    try {
      localStorage.setItem(STORAGE_KEY, serialized);
      localSaved = true;
      setLastSaved(snapshot.savedAt);
      setSaveStatus("local");
    } catch {
      setSaveStatus("error");
    }
    stateRef.current = { ...stateRef.current, savedAt: snapshot.savedAt };
    if (isAuthenticated && restoredCloud.current) {
      try {
        await saveToCloud({ snapshot: serialized });
        setSaveStatus("cloud");
        setLastSaved(snapshot.savedAt);
      } catch {
        setSaveStatus(localSaved ? "local" : "error");
      }
    }
  }, [isAuthenticated, saveToCloud]);

  useEffect(() => {
    if (!ready) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible" && speed > 0) {
        const receipts: TollPayment[] = [];
        let maintenance: UpkeepCharge | undefined;
        update((current) =>
          step(
            current,
            0.25 * speed,
            Math.random,
            (payment) => receipts.push(payment),
            (charge) => (maintenance = charge),
          ),
        );
        if (receipts.length)
          setPayments((current) => [...current, ...receipts].slice(-12));
        if (maintenance) setUpkeepNotice(maintenance);
      }
    }, 250);
    return () => clearInterval(timer);
  }, [ready, speed, update]);

  useEffect(() => {
    if (!upkeepNotice) return;
    const timer = window.setTimeout(() => setUpkeepNotice(null), 4500);
    return () => window.clearTimeout(timer);
  }, [upkeepNotice]);

  const dismissPayment = useCallback((carId: number) => {
    setPayments((current) =>
      current.filter((payment) => payment.carId !== carId),
    );
  }, []);
  const cycleSpeed = useCallback(() => {
    const next = (playbackRate % 3) + 1;
    setPlaybackRate(next);
    setSpeed((current) => (current > 0 ? next : 0));
  }, [playbackRate]);

  useEffect(() => {
    if (!ready) return;
    const timer = setInterval(() => {
      void save();
    }, 8000);
    const onHide = () => {
      void save();
    };
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      clearInterval(timer);
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [ready, save]);

  const apply = useCallback(
    (result: BuildResult) => {
      if (result.error) {
        notify(result.error);
        return false;
      }
      if (!result.undo) return false;
      hasLocalEdits.current = true;
      history.current.push(result.undo);
      if (history.current.length > 40) history.current.shift();
      setCanUndo(true);
      update(result.state);
      return true;
    },
    [notify, update],
  );

  const place = useCallback(
    (tool: Tool, point: Point, rotation: number, roadType?: RoadType) =>
      apply(build(stateRef.current, tool, point, rotation, roadType)),
    [apply],
  );
  const rotate = useCallback(
    (point: Point) => apply(rotatePlaced(stateRef.current, point)),
    [apply],
  );
  const changeBarrier = useCallback(
    (point: Point, kind: "entry" | "gate") =>
      apply(setBarrierKind(stateRef.current, point, kind)),
    [apply],
  );
  const open = useCallback(() => {
    const current = stateRef.current;
    const next = openParking(current);
    if (next === current) {
      const missing = openingStatus(infrastructure(current.grid)).missing;
      if (missing[0]) notify(missing[0].detail);
      return false;
    }
    hasLocalEdits.current = true;
    update(next);
    setSpeed(1);
    return true;
  }, [notify, update]);

  const undo = useCallback(() => {
    const previous = history.current.pop();
    if (!previous) return;
    hasLocalEdits.current = true;
    update((current) => ({
      ...current,
      grid: previous.grid,
      balance: current.balance - previous.delta,
      expenses: current.expenses - previous.expenseDelta,
    }));
    setCanUndo(history.current.length > 0);
    notify("Dernier aménagement annulé.");
  }, [notify, update]);

  const startContract = useCallback(
    (level: number) => {
      const current = stateRef.current;
      if (level > current.unlocked) return;
      hasLocalEdits.current = true;
      update(createGame(level, current.unlocked));
      history.current = [];
      setCanUndo(false);
      setSpeed(0);
      setPlaybackRate(1);
      setPayments([]);
      setUpkeepNotice(null);
      void save();
    },
    [notify, save, update],
  );

  const completeContract = useCallback(() => {
    const current = stateRef.current;
    const claimed = claimContract(current);
    if (claimed === current) return;
    hasLocalEdits.current = true;
    update(claimed);
    void save();
    notify("Contrat validé ! Votre prime a été versée.");
  }, [notify, save, update]);

  const setPrice = useCallback(
    (price: number) => {
      hasLocalEdits.current = true;
      update((current) => ({
        ...current,
        price: Math.min(8, Math.max(1, price)),
      }));
    },
    [update],
  );

  return {
    state,
    stateRef,
    speed,
    setSpeed,
    playbackRate,
    cycleSpeed,
    payments,
    dismissPayment,
    upkeepNotice,
    ready,
    notice,
    notify,
    saveStatus,
    lastSaved,
    canUndo,
    isAuthenticated,
    place,
    rotate,
    changeBarrier,
    open,
    undo,
    save,
    startContract,
    completeContract,
    setPrice,
  };
}
