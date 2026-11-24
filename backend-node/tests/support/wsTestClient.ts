/**
 * Cliente WebSocket de teste: guarda todas as mensagens recebidas e permite
 * esperar por um evento específico ou fazer "requisições" (aguarda ack/erro).
 */
import { randomUUID } from "node:crypto";
import WebSocket from "ws";

export interface ServerMessage {
  type: string;
  requestId?: string;
  payload: any;
}

export class WsTestClient {
  readonly messages: ServerMessage[] = [];
  private waiters: Array<{ match: (m: ServerMessage) => boolean; resolve: (m: ServerMessage) => void }> = [];
  private cursor = 0;

  private constructor(readonly socket: WebSocket) {
    socket.on("message", (data) => {
      const message = JSON.parse(data.toString()) as ServerMessage;
      this.messages.push(message);
      this.waiters = this.waiters.filter((waiter) => {
        if (waiter.match(message)) {
          waiter.resolve(message);
          return false;
        }
        return true;
      });
    });
  }

  static connect(url: string): Promise<WsTestClient> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(url);
      socket.once("open", () => resolve(new WsTestClient(socket)));
      socket.once("error", reject);
    });
  }

  send(type: string, payload: unknown = {}, requestId?: string): void {
    this.socket.send(JSON.stringify(requestId ? { type, requestId, payload } : { type, payload }));
  }

  /** Envia e espera ack (resolve) ou error (rejeita com o código) do mesmo requestId. */
  async request(type: string, payload: unknown = {}): Promise<ServerMessage> {
    const requestId = randomUUID();
    // A resposta é localizada pelo requestId e NÃO avança o cursor de leitura,
    // para que eventos recebidos antes do ack continuem disponíveis ao waitFor.
    const reply = this.waitFor(
      (m) => m.requestId === requestId && (m.type === "ack" || m.type === "error"),
      `resposta de ${type}`,
      3000,
      false,
    );
    this.send(type, payload, requestId);
    const message = await reply;
    if (message.type === "error") {
      const error = new Error(`${message.payload.code}: ${message.payload.message}`) as Error & { code: string };
      error.code = message.payload.code;
      throw error;
    }
    return message;
  }

  /** Espera a próxima mensagem (a partir do cursor) que satisfaça o critério. */
  waitFor(
    match: ((m: ServerMessage) => boolean) | string,
    label?: string,
    timeoutMs = 3000,
    moveCursor = true,
  ): Promise<ServerMessage> {
    const predicate = typeof match === "string" ? (m: ServerMessage) => m.type === match : match;
    const existing = this.messages.slice(moveCursor ? this.cursor : 0).find(predicate);
    if (existing) {
      if (moveCursor) this.cursor = this.messages.indexOf(existing) + 1;
      return Promise.resolve(existing);
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`Tempo esgotado esperando ${label ?? String(match)}`)),
        timeoutMs,
      );
      this.waiters.push({
        match: predicate,
        resolve: (message) => {
          clearTimeout(timer);
          if (moveCursor) this.cursor = this.messages.indexOf(message) + 1;
          resolve(message);
        },
      });
    });
  }

  /** Último snapshot room:state recebido. */
  lastState(): any {
    const states = this.messages.filter((m) => m.type === "room:state");
    return states[states.length - 1]?.payload;
  }

  /** Espera um room:state com versão maior que a informada. */
  waitForState(minVersionExclusive: number): Promise<ServerMessage> {
    return this.waitFor(
      (m) => m.type === "room:state" && m.payload.version > minVersionExclusive,
      `room:state > v${minVersionExclusive}`,
    );
  }

  close(): Promise<void> {
    return new Promise((resolve) => {
      if (this.socket.readyState === WebSocket.CLOSED) return resolve();
      this.socket.once("close", () => resolve());
      this.socket.close();
    });
  }

  waitForClose(): Promise<number> {
    return new Promise((resolve) => this.socket.once("close", (code) => resolve(code)));
  }
}
