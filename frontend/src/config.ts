/**
 * ESCOLHA DO BACKEND. É a ÚNICA coisa que muda para usar o Node ou o Java.
 *
 * Ordem de prioridade:
 *  1. window.__APP_CONFIG__ (arquivo /config.js gerado pelo container do
 *     frontend em tempo de execução — troca de backend sem novo build);
 *  2. variáveis do Vite (VITE_API_URL / VITE_WS_URL, no .env ou no build);
 *  3. padrão de desenvolvimento: backend Node em localhost:3000.
 */
interface AppConfig {
  apiUrl: string;
  wsUrl: string;
}

declare global {
  interface Window {
    __APP_CONFIG__?: Partial<AppConfig>;
  }
}

const runtime = typeof window !== "undefined" ? window.__APP_CONFIG__ ?? {} : {};

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

export const config: AppConfig = {
  apiUrl: stripTrailingSlash(runtime.apiUrl || import.meta.env.VITE_API_URL || "http://localhost:3000"),
  wsUrl: stripTrailingSlash(runtime.wsUrl || import.meta.env.VITE_WS_URL || "ws://localhost:3000/ws"),
};
