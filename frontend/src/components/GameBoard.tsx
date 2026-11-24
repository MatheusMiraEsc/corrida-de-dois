/**
 * TABULEIRO de 100 casas: grade CSS (10×10, zigue-zague), camada SVG com
 * escadas e serpentes e os carrinhos por cima. Tudo em porcentagem, então o
 * tabuleiro se adapta a qualquer tamanho de tela.
 */
import { useMemo } from "react";
import type { BoardDescription, RoomPlayer } from "../types/contract";
import { squaresInDisplayOrder } from "../utils/board";
import { BoardCell } from "./BoardCell";
import { Ladder } from "./Ladder";
import { PlayerCar } from "./PlayerCar";
import { Snake } from "./Snake";

interface Props {
  board: BoardDescription;
  players: RoomPlayer[];
  positions: Record<string, number>;
  currentPlayerId: string | null;
  movingPlayerId: string | null;
  jumping: "ladder" | "snake" | null;
}

export function GameBoard({ board, players, positions, currentPlayerId, movingPlayerId, jumping }: Props) {
  const cells = useMemo(() => squaresInDisplayOrder(), []);
  const ladderAt = useMemo(() => new Map(board.ladders.map((l) => [l.from, l])), [board]);
  const snakeAt = useMemo(() => new Map(board.snakes.map((s) => [s.from, s])), [board]);
  const occupied = new Set(Object.values(positions));
  const movingSquare = movingPlayerId ? positions[movingPlayerId] : null;

  const squareOf = (playerId: string) => positions[playerId] ?? board.startPosition;
  const sharing = players.length === 2 && squareOf(players[0].playerId) === squareOf(players[1].playerId);

  return (
    <div className="game-board" role="group" aria-label="Tabuleiro com 100 casas">
      <div className="game-board__grid">
        {cells.map((square) => {
          const ladder = ladderAt.get(square);
          const snake = snakeAt.get(square);
          const kind =
            square === board.size ? "finish" : square === 1 ? "start" : ladder ? "ladder" : snake ? "snake" : "normal";
          return (
            <BoardCell
              key={square}
              square={square}
              kind={kind}
              target={ladder?.to ?? snake?.to}
              highlighted={occupied.has(square)}
            />
          );
        })}
      </div>

      <svg className="game-board__overlay" viewBox="0 0 100 100" aria-hidden="true">
        {board.ladders.map((ladder) => (
          <Ladder key={`l${ladder.id}`} from={ladder.from} to={ladder.to} active={jumping === "ladder" && movingSquare === ladder.to} />
        ))}
        {board.snakes.map((snake) => (
          <Snake
            key={`s${snake.id}`}
            id={snake.id}
            from={snake.from}
            to={snake.to}
            active={jumping === "snake" && movingSquare === snake.to}
          />
        ))}
      </svg>

      <div className="game-board__cars">
        {players.map((player) => (
          <PlayerCar
            key={player.playerId}
            name={player.name}
            seat={player.seat}
            vehicle={player.vehicle}
            square={squareOf(player.playerId)}
            sharingSquare={sharing}
            moving={movingPlayerId === player.playerId}
            jumping={movingPlayerId === player.playerId ? jumping : null}
            isCurrentTurn={currentPlayerId === player.playerId}
          />
        ))}
      </div>
    </div>
  );
}
