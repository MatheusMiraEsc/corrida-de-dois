/**
 * Orquestra a lógica central da partida: turnos, dado e condição de vitória.
 * Propositalmente não manipula tabela, lista ou destaque visual do painel —
 * essa parte (DOM dinâmico) será adicionada na Etapa 7, para manter cada
 * etapa do desenvolvimento focada em uma responsabilidade por vez.
 */
class Jogo {
    /**
     * @param {Jogador} jogador1
     * @param {Jogador} jogador2
     * @param {number} totalDeCasas - tamanho da pista (linha de chegada)
     */
    constructor(jogador1, jogador2, totalDeCasas) {
        this.jogadores = [jogador1, jogador2];
        this.totalDeCasas = totalDeCasas;
        this.indiceJogadorAtual = 0;
        this.estado = "emAndamento"; // ou "finalizado"
    }

    /**
     * @returns {Jogador} o jogador da vez
     */
    obterJogadorAtual() {
        return this.jogadores[this.indiceJogadorAtual];
    }

    /**
     * @returns {Jogador} o jogador que não está na vez
     */
    obterJogadorAdversario() {
        const indiceAdversario = this.indiceJogadorAtual === 0 ? 1 : 0;
        return this.jogadores[indiceAdversario];
    }

    /**
     * Gera um valor de dado entre 1 e 6.
     * @returns {number}
     */
    rolarDado() {
        return Math.floor(Math.random() * 6) + 1;
    }

    /**
     * Avança o jogador da vez em uma quantidade de casas.
     * @param {number} casas
     * @returns {number} a nova posição do jogador da vez
     */
    avancarJogadorAtual(casas) {
        return this.obterJogadorAtual().mover(casas);
    }

    /**
     * Passa a vez para o outro jogador.
     */
    trocarTurno() {
        this.indiceJogadorAtual = this.indiceJogadorAtual === 0 ? 1 : 0;
    }

    /**
     * Verifica se o jogador da vez alcançou ou ultrapassou a linha de chegada.
     * Se sim, marca o jogo como finalizado e concede o ponto da vitória.
     * @returns {Jogador|null} o jogador vencedor, ou null se ninguém venceu ainda
     */
    verificarVencedor() {
        const jogadorAtual = this.obterJogadorAtual();

        if (jogadorAtual.posicao >= this.totalDeCasas) {
            this.estado = "finalizado";
            jogadorAtual.adicionarPonto();
            return jogadorAtual;
        }

        return null;
    }

    /**
     * @returns {boolean} true se a partida já terminou
     */
    partidaFinalizada() {
        return this.estado === "finalizado";
    }

    /**
     * Restaura o jogo para uma nova partida, preservando os nomes
     * e pontuações acumuladas dos jogadores.
     */
    reiniciarPartida() {
        this.jogadores.forEach((jogador) => jogador.reiniciar());
        this.indiceJogadorAtual = 0;
        this.estado = "emAndamento";
    }
}