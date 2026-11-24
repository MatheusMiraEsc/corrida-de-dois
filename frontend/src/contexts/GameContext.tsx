/**
 * Conexão em tempo real com o servidor e estado da sala.
 *
 * - Abre o WebSocket quando existe um jogador local e se identifica.
 * - Converte mensagens do servidor em estado (gameReducer).
 * - Expõe as AÇÕES do jogador; cada uma é só um pedido ao servidor, que
 *   decide se ela é válida e devolve o novo estado.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import { config } from "../config";
import { GameSocket, SocketRequestError } from "../services/gameSocket";
import type { Vehicle } from "../types/contract";
import { gameReducer, initialGameState, type GameState, type NoticeKind } from "./gameReducer";
import { useSession } from "./SessionContext";

interface GameActions {
  createRoom(vehicle: Vehicle): Promise<void>;
  joinRoom(code: string, vehicle: Vehicle): Promise<void>;
  leaveRoom(): Promise<void>;
  setReady(ready: boolean): Promise<void>;
  setVehicle(vehicle: Vehicle): Promise<void>;
  startGame(): Promise<void>;
  rollDice(expectedMoveCount: number): Promise<void>;
  restartGame(): Promise<void>;
  reconnectHere(): void;
}

interface GameContextValue {
  state: GameState;
  actions: GameActions;
  notify(kind: NoticeKind, text: string): void;
  dismissNotice(id: number): void;
  clearLobbyNotice(): void;
}

const GameContext = createContext<GameContextValue | null>(null);
const IDENTIFY_TIMEOUT_MS = 10_000;

export function GameProvider({ children }: { children: ReactNode }) {
  const { player, recreatePlayer } = useSession();
  const [state, dispatch] = useReducer(gameReducer, initialGameState);
  const socketRef = useRef<GameSocket | null>(null);
  const identifiedRef = useRef(false);
  const identifyWaiters = useRef<Array<() => void>>([]);

  // Uma conexão por jogador local. Trocar de jogador abre uma conexão nova.
  useEffect(() => {
    if (!player) return;
    const socket = new GameSocket(config.wsUrl);
    socketRef.current = socket;

    const offMessage = socket.onMessage((message) => {
      if (message.type === "session:identified") {
        identifiedRef.current = true;
        identifyWaiters.current.splice(0).forEach((resolve) => resolve());
      }
      dispatch({ type: "server", message });
    });

    const offStatus = socket.onStatus((status) => {
      identifiedRef.current = false;
      dispatch({ type: "connection", status });
      if (status !== "open") return;
      socket.request("session:identify", { playerId: player.id, token: player.token }).catch((error) => {
        // Identidade não reconhecida (ex.: banco recriado): cadastra de novo.
        if (error instanceof SocketRequestError && error.code === "UNAUTHORIZED") void recreatePlayer();
      });
    });

    socket.connect();
    return () => {
      offMessage();
      offStatus();
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [player?.id, player?.token]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Espera a identificação terminar (necessário logo após cadastrar o jogador). */
  const waitUntilIdentified = useCallback(
    () =>
      new Promise<void>((resolve, reject) => {
        if (identifiedRef.current) return resolve();
        const timer = setTimeout(
          () => reject(new SocketRequestError({ code: "TIMEOUT", message: "Não foi possível conectar ao servidor." })),
          IDENTIFY_TIMEOUT_MS,
        );
        identifyWaiters.current.push(() => {
          clearTimeout(timer);
          resolve();
        });
      }),
    [],
  );

  const send = useCallback(
    async (type: string, payload: unknown = {}) => {
      await waitUntilIdentified();
      const socket = socketRef.current;
      if (!socket) throw new SocketRequestError({ code: "NOT_CONNECTED", message: "Sem conexão com o servidor." });
      return socket.request(type, payload);
    },
    [waitUntilIdentified],
  );

  const actions = useMemo<GameActions>(
    () => ({
      createRoom: (vehicle) => send("room:create", { vehicle }),
      joinRoom: (code, vehicle) => send("room:join", { code, vehicle }),
      leaveRoom: () => send("room:leave"),
      setReady: (ready) => send("room:ready", { ready }),
      setVehicle: (vehicle) => send("room:set-vehicle", { vehicle }),
      startGame: () => send("game:start"),
      rollDice: (expectedMoveCount) => send("game:roll-dice", { expectedMoveCount }),
      restartGame: () => send("game:restart"),
      reconnectHere: () => socketRef.current?.connect(),
    }),
    [send],
  );

  const notify = useCallback((kind: NoticeKind, text: string) => dispatch({ type: "notify", kind, text }), []);
  const dismissNotice = useCallback((id: number) => dispatch({ type: "dismiss", id }), []);
  const clearLobbyNotice = useCallback(() => dispatch({ type: "clear-lobby-notice" }), []);

  const value = useMemo(
    () => ({ state, actions, notify, dismissNotice, clearLobbyNotice }),
    [state, actions, notify, dismissNotice, clearLobbyNotice],
  );
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const value = useContext(GameContext);
  if (!value) throw new Error("useGame precisa estar dentro de <GameProvider>");
  return value;
}
