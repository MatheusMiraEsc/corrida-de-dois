/** Uma casa do tabuleiro. Escadas, serpentes, largada e chegada têm visual próprio. */
interface Props {
  square: number;
  kind: "start" | "finish" | "ladder" | "snake" | "normal";
  /** Destino da escada/serpente, mostrado como dica. */
  target?: number;
  highlighted: boolean;
}

export function BoardCell({ square, kind, target, highlighted }: Props) {
  const tone = (Math.floor((square - 1) / 10) + square) % 2 === 0 ? "a" : "b";
  const label =
    kind === "ladder"
      ? `Casa ${square}: escada até a ${target}`
      : kind === "snake"
        ? `Casa ${square}: serpente até a ${target}`
        : kind === "finish"
          ? "Casa 100: linha de chegada"
          : `Casa ${square}`;

  return (
    <div
      className={`board-cell board-cell--${tone} board-cell--${kind}${highlighted ? " board-cell--highlight" : ""}`}
      title={label}
    >
      <span className="board-cell__number">{square}</span>
      {kind === "finish" && <span className="board-cell__flag" aria-hidden="true" />}
      {kind === "start" && <span className="board-cell__start">LARGADA</span>}
    </div>
  );
}
