import type { PrismaClient } from "@prisma/client";
import type { PlayerRecord, PlayerRepository } from "./types";

export class PrismaPlayerRepository implements PlayerRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(player: PlayerRecord): Promise<PlayerRecord> {
    return this.prisma.player.create({ data: player });
  }

  findById(id: string): Promise<PlayerRecord | null> {
    return this.prisma.player.findUnique({ where: { id } });
  }

  updateName(id: string, name: string): Promise<PlayerRecord> {
    return this.prisma.player.update({ where: { id }, data: { name } });
  }
}
