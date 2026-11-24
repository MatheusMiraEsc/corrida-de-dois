/**
 * Identidade do jogador NESTE navegador: { id, name, token } guardado no
 * localStorage. O token é o que prova ao servidor que este navegador é
 * aquele jogador (não há login). Limpar o navegador cria um jogador novo.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { ApiError, api } from "../services/api";

export interface LocalPlayer {
  id: string;
  name: string;
  token: string;
}

interface SessionValue {
  player: LocalPlayer | null;
  /** Garante um jogador com este nome (cadastra ou renomeia) e o devolve. */
  ensurePlayer(name: string): Promise<LocalPlayer>;
  /** Descarta a identidade salva e cadastra de novo (ex.: banco foi apagado). */
  recreatePlayer(): Promise<LocalPlayer | null>;
}

const STORAGE_KEY = "corrida-dos-dois:jogador";
const SessionContext = createContext<SessionValue | null>(null);

function loadPlayer(): LocalPlayer | null {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    return saved && saved.id && saved.token && saved.name ? saved : null;
  } catch {
    return null;
  }
}

export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [player, setPlayer] = useState<LocalPlayer | null>(loadPlayer);

  const save = useCallback((next: LocalPlayer | null) => {
    if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else localStorage.removeItem(STORAGE_KEY);
    setPlayer(next);
    return next;
  }, []);

  const register = useCallback(
    async (name: string) => {
      const created = await api.createPlayer(name);
      return save({ id: created.id, name: created.name, token: created.token })!;
    },
    [save],
  );

  const ensurePlayer = useCallback(
    async (rawName: string) => {
      const name = normalizeName(rawName);
      const current = loadPlayer();
      if (!current) return register(name);
      if (current.name === name) return current;
      try {
        const renamed = await api.renamePlayer(current.id, current.token, name);
        return save({ ...current, name: renamed.name })!;
      } catch (error) {
        // Identidade salva não existe mais no servidor: cria outra.
        if (error instanceof ApiError && [401, 403, 404].includes(error.status)) return register(name);
        throw error;
      }
    },
    [register, save],
  );

  const recreatePlayer = useCallback(async () => {
    const current = loadPlayer();
    save(null);
    return current ? register(current.name) : null;
  }, [register, save]);

  const value = useMemo(() => ({ player, ensurePlayer, recreatePlayer }), [player, ensurePlayer, recreatePlayer]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession precisa estar dentro de <SessionProvider>");
  return value;
}
