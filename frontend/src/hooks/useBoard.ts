/** Carrega a configuração do tabuleiro (escadas e serpentes) do servidor, uma vez. */
import { useEffect, useState } from "react";
import { api } from "../services/api";
import type { BoardDescription } from "../types/contract";

let cached: BoardDescription | null = null;

export function useBoard(): { board: BoardDescription | null; error: string | null } {
  const [board, setBoard] = useState<BoardDescription | null>(cached);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cached) return;
    let active = true;
    api
      .getBoard()
      .then((result) => {
        cached = result;
        if (active) setBoard(result);
      })
      .catch(() => active && setError("Não foi possível carregar o tabuleiro."));
    return () => {
      active = false;
    };
  }, []);

  return { board, error };
}
