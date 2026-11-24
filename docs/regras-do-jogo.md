# Regras do jogo

Corrida dos Dois mistura corrida de carrinhos com Serpentes e Escadas. Todas as
regras são aplicadas **pelo servidor**; o navegador só mostra o resultado.

| Onde está no código | Node | Java |
|---|---|---|
| Tabuleiro, escadas e serpentes | `src/game/board.ts` | `game/Board.java` |
| Movimento de um lance | `src/game/rules.ts` | `game/Rules.java` |
| Turnos, jogada extra, vitória | `src/game/GameMatch.ts` | `game/GameMatch.java` |
| Pontuação | `src/game/scoring.ts` | `game/Scoring.java` |

## Preparação
- Exatamente **dois** jogadores humanos, cada um no seu dispositivo.
- Cada um informa o nome e escolhe um veículo (carro, picape, moto ou bicicleta).
  A cor vem do assento: vermelho (1) e azul (2).
- Os dois começam na **casa 1**.
- A ordem é **sorteada** pelo servidor na largada e a interface mostra quem começa.

## Tabuleiro
100 casas em 10 linhas, numeradas em zigue-zague a partir de baixo:
1→10, 20←11, 21→30, … até a casa 100 (linha de chegada, canto superior esquerdo).

| Escadas (base → topo) | Serpentes (cabeça → cauda) |
|---|---|
| 4 → 14 | 17 → 7 |
| 21 → 42 | 54 → 34 |
| 51 → 67 | 87 → 24 |
| 71 → 91 | 98 → 79 |

## Um lance
1. Só o jogador da vez pode lançar; o dado (1 a 6) é sorteado no servidor com
   gerador criptográfico.
2. **Passou de 100?** O carrinho fica onde está (efeito `OVERSHOOT`).
3. Senão anda casa a casa até `posição + dado`.
4. Parou na **base de uma escada** → sobe até o topo.
   Parou na **cabeça de uma serpente** → desce até a cauda.
5. Chegou **exatamente** à casa 100 → vence e a partida termina.
6. Tirou **6** (e não venceu) → joga de novo. Vale também quando o 6 passaria
   de 100 ou levou a uma serpente (leitura literal da regra "se tirar 6, joga
   novamente").
7. Caso contrário, a vez passa para o outro jogador.

## Fim da partida
- O primeiro a chegar à casa 100 vence; o servidor encerra a partida e recusa
  novos lances (`GAME_NOT_IN_PROGRESS`).
- Pontos no ranking global: **vitória +100**, **derrota +20**.
- **Jogar novamente**: na mesma sala, posições voltam à casa 1, histórico zera,
  nova ordem é sorteada. O ranking global não é alterado.

## Desconexão e abandono
- Se um jogador cai, a partida **pausa** e ele tem 60 s (configurável) para voltar.
- Se sair pelo botão ou não voltar a tempo, a partida termina como **abandonada**:
  ninguém pontua (nem quem ficou — para não premiar quem derruba a conexão do
  outro, nem punir quem teve queda de internet).
