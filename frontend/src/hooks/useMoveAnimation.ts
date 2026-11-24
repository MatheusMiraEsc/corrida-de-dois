/**
 * ANIMAÇÃO DAS JOGADAS — reproduz, passo a passo, as jogadas que o servidor
 * já decidiu (histórico do snapshot). Os dois jogadores veem a mesma coisa.
 *
 * Para cada jogada nova: o dado gira → o carrinho anda casa a casa (path) →
 * se houver escada/serpente, salta até o destino. Jogadas chegam em fila
 * (ex.: o adversário tirou 6 e jogou de novo) e são animadas em ordem.
 * Se o cliente ficou muito para trás (reconexão), pula direto para o estado
 * do servidor — a animação nunca atrasa a sincronização.
 */
import { useEffect, useRef, useState } from "react";
import type { MoveRecord, RoomSnapshot } from "../types/contract";

const DICE_SPIN_MS = 700;
const STEP_MS = 190;
const BEFORE_JUMP_MS = 280;
const JUMP_MS = 750;
const AFTER_MOVE_MS = 250;
/** Mais jogadas pendentes do que isso → sincroniza sem animar. */
const MAX_QUEUE_TO_ANIMATE = 6;

export type MoveHighlight = "ladder" | "snake" | "overshoot" | "extra-turn" | "win";

export interface AnimationView {
  /** Posição exibida de cada jogador (pode estar "atrás" do servidor durante a animação). */
  positions: Record<string, number>;
  /** Valor mostrado no dado. */
  diceValue: number | null;
  rolling: boolean;
  /** Jogador cujo carrinho está se movendo agora. */
  movingPlayerId: string | null;
  /** Salto em andamento (escada/serpente) — muda a animação do carrinho. */
  jumping: "ladder" | "snake" | null;
  /** true enquanto houver jogadas a animar. */
  busy: boolean;
  /** Número da última jogada já exibida (o histórico mostra até ela). */
  shownMoveNumber: number;
}

type MoveCallback = (move: MoveRecord, highlight: MoveHighlight | null) => void;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function positionsFrom(room: RoomSnapshot | null): Record<string, number> {
  return Object.fromEntries((room?.players ?? []).map((p) => [p.playerId, p.position]));
}

export function useMoveAnimation(room: RoomSnapshot | null, onMoveShown?: MoveCallback): AnimationView {
  const [view, setView] = useState<AnimationView>(() => ({
    positions: positionsFrom(room),
    diceValue: room?.lastMove?.dice ?? null,
    rolling: false,
    movingPlayerId: null,
    jumping: null,
    busy: false,
    shownMoveNumber: room?.moveCount ?? 0,
  }));

  const roomRef = useRef(room);
  const queueRef = useRef<MoveRecord[]>([]);
  const queuedUpToRef = useRef<number>(room?.moveCount ?? 0);
  const matchKeyRef = useRef<string | null>(room ? `${room.code}#${room.matchNumber}` : null);
  const runningRef = useRef(false);
  const generationRef = useRef(0);
  const callbackRef = useRef(onMoveShown);

  // Mantém as referências atualizadas (lidas pela fila de animação assíncrona).
  useEffect(() => {
    callbackRef.current = onMoveShown;
    roomRef.current = room;
  });

  useEffect(() => {
    if (!room) return;
    const matchKey = `${room.code}#${room.matchNumber}`;

    // Nova partida (ou outra sala): recomeça do estado do servidor, sem animar.
    if (matchKeyRef.current !== matchKey) {
      matchKeyRef.current = matchKey;
      generationRef.current += 1;
      queueRef.current = [];
      queuedUpToRef.current = room.moveCount;
      runningRef.current = false;
      setView({
        positions: positionsFrom(room),
        diceValue: room.lastMove?.dice ?? null,
        rolling: false,
        movingPlayerId: null,
        jumping: null,
        busy: false,
        shownMoveNumber: room.moveCount,
      });
      return;
    }

    const fresh = room.history.filter((move) => move.moveNumber > queuedUpToRef.current);
    const missedSome = fresh.length > 0 && fresh[0].moveNumber !== queuedUpToRef.current + 1;
    if (fresh.length === 0 && !runningRef.current) {
      // Nada novo para animar: mantém as posições alinhadas ao servidor (ex.: reinício).
      setView((current) => ({ ...current, positions: positionsFrom(room), shownMoveNumber: room.moveCount }));
      return;
    }
    if (fresh.length === 0) return;

    if (missedSome || queueRef.current.length + fresh.length > MAX_QUEUE_TO_ANIMATE) {
      generationRef.current += 1;
      queueRef.current = [];
      queuedUpToRef.current = room.moveCount;
      runningRef.current = false;
      setView({
        positions: positionsFrom(room),
        diceValue: room.lastMove?.dice ?? null,
        rolling: false,
        movingPlayerId: null,
        jumping: null,
        busy: false,
        shownMoveNumber: room.moveCount,
      });
      return;
    }

    queueRef.current.push(...fresh);
    queuedUpToRef.current = fresh[fresh.length - 1].moveNumber;
    if (!runningRef.current) void runQueue();
  }, [room?.version, room?.code, room?.matchNumber]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => void (generationRef.current += 1), []);

  async function runQueue(): Promise<void> {
    runningRef.current = true;
    const generation = generationRef.current;
    const stillValid = () => generation === generationRef.current;
    setView((current) => ({ ...current, busy: true }));

    while (queueRef.current.length > 0 && stillValid()) {
      const move = queueRef.current.shift()!;
      await animateMove(move, stillValid);
    }

    if (!stillValid()) return;
    runningRef.current = false;
    const latest = roomRef.current;
    setView((current) => ({
      ...current,
      positions: positionsFrom(latest),
      busy: false,
      movingPlayerId: null,
      jumping: null,
      shownMoveNumber: latest?.moveCount ?? current.shownMoveNumber,
    }));
  }

  async function animateMove(move: MoveRecord, stillValid: () => boolean): Promise<void> {
    setView((current) => ({ ...current, rolling: true, movingPlayerId: move.playerId }));
    await sleep(DICE_SPIN_MS);
    if (!stillValid()) return;
    setView((current) => ({ ...current, rolling: false, diceValue: move.dice }));

    for (const square of move.path) {
      await sleep(STEP_MS);
      if (!stillValid()) return;
      setView((current) => ({ ...current, positions: { ...current.positions, [move.playerId]: square } }));
    }

    if (move.effect === "LADDER" || move.effect === "SNAKE") {
      await sleep(BEFORE_JUMP_MS);
      if (!stillValid()) return;
      const jumping = move.effect === "LADDER" ? "ladder" : "snake";
      setView((current) => ({
        ...current,
        jumping,
        positions: { ...current.positions, [move.playerId]: move.finalPosition },
      }));
      callbackRef.current?.(move, jumping);
      await sleep(JUMP_MS);
      if (!stillValid()) return;
    } else {
      const highlight: MoveHighlight | null = move.won
        ? "win"
        : move.effect === "OVERSHOOT"
          ? "overshoot"
          : null;
      callbackRef.current?.(move, highlight);
    }
    if (move.extraTurn) callbackRef.current?.(move, "extra-turn");

    setView((current) => ({ ...current, jumping: null, shownMoveNumber: move.moveNumber }));
    await sleep(AFTER_MOVE_MS);
  }

  return view;
}
