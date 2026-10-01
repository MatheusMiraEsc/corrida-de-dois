/**
 * Representa um jogador humano na partida.
 * Não conhece nada sobre DOM, HTML ou animação —
 * apenas guarda e manipula o estado lógico do jogador.
 */
class Jogador {
    /**
     * @param {string} nome - nome informado na página de configuração
     * @param {number} id - identificador do jogador (1 ou 2)
     */
    constructor(nome, id) {
        this.nome = nome;
        this.id = id;
        this.posicao = 0;
        this.pontuacao = 0;
        this.numeroDeJogadas = 0;
    }

    /**
     * Avança o jogador uma quantidade de casas.
     * @param {number} casas
     * @returns {number} a nova posição do jogador
     */
    mover(casas) {
        this.posicao += casas;
        this.numeroDeJogadas += 1;
        return this.posicao;
    }

    /**
     * Adiciona um ponto à pontuação do jogador.
     * Usado, por exemplo, quando o jogador vence a partida.
     */
    adicionarPonto() {
        this.pontuacao += 1;
    }

    /**
     * Restaura o jogador ao estado inicial, preservando nome e id.
     * Útil para o botão "Jogar novamente".
     */
    reiniciar() {
        this.posicao = 0;
        this.numeroDeJogadas = 0;
    }
}