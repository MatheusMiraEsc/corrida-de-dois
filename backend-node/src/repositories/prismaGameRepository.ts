import type { PrismaClient } from "@prisma/client";
import type { GameRecordInput, GameRepository } from "./types";

export class PrismaGameRepository implements GameRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /** Grava a partida e as participações em uma única transação. */
  async save(game: GameRecordInput): Promise<void> {
    const { participants, ...gameData } = game;
    await this.prisma.game.create({
      data: {
        ...gameData,
        participants: { create: participants },
      },
    });
  }
}
