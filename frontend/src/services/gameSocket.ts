/**
 * COMUNICAÇÃO WEBSOCKET com o backend (Node ou Java — mesmo protocolo).
 *
 * - Envelope JSON: { type, requestId?, payload }.
 * - request(): envia e devolve uma Promise resolvida no "ack" ou rejeitada no
 *   "error" com o mesmo requestId.
 * - Reconecta sozinho (espera crescente: 1s, 2s, 4s… até 10s) e avisa quem
 *   estiver ouvindo, para que a sessão seja identificada de novo.
 *
 * Esta classe NÃO toca na interface: ela só emite eventos para o React.
 */
import type { ErrorBody, ServerMessage } from "../types/contract";

export type ConnectionStatus = "connecting" | "open" | "reconnecting" | "replaced" | "closed";

export class SocketRequestError extends Error {
  readonly code: string;
  readonly details?: ErrorBody["details"];

  constructor(body: ErrorBody) {
    super(body.details?.[0]?.message ?? body.message);
    this.code = body.code;
    this.details = body.details;
  }
}

/**
 * Id aleatório para correlacionar pedido e resposta. Não usa crypto.randomUUID()
 * porque ele só existe em "contexto seguro" (https ou localhost): abrindo o jogo
 * pelo IP da rede local (http://192.168.x.x) ele não está disponível.
 */
export function createRequestId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

type MessageListener =(message: ServerMessage<any>) => void;
type StatusListener = (status: ConnectionStatus) => void;

interface Pending {
  resolve: () => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RECONNECT_DELAY_MS = 10_000;
/** Código de fechamento enviado pelo servidor quando o jogo é aberto em outra janela. */
const CLOSE_SESSION_REPLACED = 4001;

export class GameSocket {
  private socket: WebSocket | null = null;
  private readonly pending = new Map<string, Pending>();
  private readonly messageListeners = new Set<MessageListener>();
  private readonly statusListeners = new Set<StatusListener>();
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;
  status: ConnectionStatus = "closed";
  private readonly url: string;

  constructor(url: string) {
    this.url = url;
  }

  connect(): void {
    this.stopped = false;
    this.open();
  }

  disconnect(): void {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.socket?.close(1000, "bye");
    this.socket = null;
    this.setStatus("closed");
  }

  onMessage(listener: MessageListener): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  onStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  request(type: string, payload: unknown = {}): Promise<void> {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return Promise.reject(
        new SocketRequestError({ code: "NOT_CONNECTED", message: "Sem conexão com o servidor. Tentando reconectar…" }),
      );
    }
    const requestId = createRequestId();
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new SocketRequestError({ code: "TIMEOUT", message: "O servidor demorou para responder." }));
      }, REQUEST_TIMEOUT_MS);
      this.pending.set(requestId, { resolve, reject, timer });
      this.socket!.send(JSON.stringify({ type, requestId, payload }));
    });
  }

  private open(): void {
    this.setStatus(this.reconnectAttempts === 0 ? "connecting" : "reconnecting");
    const socket = new WebSocket(this.url);
    this.socket = socket;

    socket.onopen = () => {
      this.reconnectAttempts = 0;
      this.setStatus("open");
    };
    socket.onmessage = (event) => this.handleMessage(event.data);
    socket.onclose = (event) => {
      if (this.socket !== socket) return;
      this.failPending();
      if (event.code === CLOSE_SESSION_REPLACED) {
        this.stopped = true;
        this.setStatus("replaced");
        return;
      }
      if (!this.stopped) this.scheduleReconnect();
    };
  }

  private scheduleReconnect(): void {
    this.setStatus("reconnecting");
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, MAX_RECONNECT_DELAY_MS);
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => this.open(), delay);
  }

  private handleMessage(raw: unknown): void {
    let message: ServerMessage<any>;
    try {
      message = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (message.requestId && this.pending.has(message.requestId)) {
      const pending = this.pending.get(message.requestId)!;
      this.pending.delete(message.requestId);
      clearTimeout(pending.timer);
      if (message.type === "error") pending.reject(new SocketRequestError(message.payload as ErrorBody));
      else pending.resolve();
    }
    this.messageListeners.forEach((listener) => listener(message));
  }

  private failPending(): void {
    this.pending.forEach(({ reject, timer }) => {
      clearTimeout(timer);
      reject(new SocketRequestError({ code: "NOT_CONNECTED", message: "A conexão caiu. Tentando reconectar…" }));
    });
    this.pending.clear();
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    this.statusListeners.forEach((listener) => listener(status));
  }
}
