/**
 * Representa o elemento visual (carrinho) de um jogador na pista.
 * É a única classe que manipula diretamente o estilo do carrinho,
 * mantendo a animação isolada do resto da lógica do jogo.
 */
class Carrinho {
    /**
     * @param {HTMLElement} elemento - elemento DOM do carrinho (ex: #carrinho1)
     * @param {number} totalDeCasas - tamanho total da pista, usado para
     *        calcular a posição proporcional do carrinho
     */
    constructor(elemento, totalDeCasas) {
        this.elemento = elemento;
        this.totalDeCasas = totalDeCasas;
    }

    /**
     * Move o carrinho visualmente até a casa correspondente à posição
     * lógica do jogador. A suavização do movimento é feita pelo CSS
     * (propriedade "transition" definida em .carrinho no estilo.css);
     * aqui apenas calculamos e aplicamos o novo "transform", além de
     * ativar a classe que dispara o efeito de destaque durante o trajeto.
     * @param {number} posicao - posição lógica atual do jogador (em casas)
     */
    moverPara(posicao) {
        const posicaoLimitada = Math.min(posicao, this.totalDeCasas);
        const percentualPercorrido = posicaoLimitada / this.totalDeCasas;

        // A distância real em pixels será calculada com base na largura
        // da pista no momento da chamada, garantindo que o carrinho nunca
        // ultrapasse visualmente a linha de chegada.
        const larguraPista = this.elemento.parentElement.clientWidth;
        const larguraCarrinho = this.elemento.offsetWidth;
        const distanciaMaxima = larguraPista - larguraCarrinho - 8; // margem de segurança

        const distancia = percentualPercorrido * distanciaMaxima;

        this.elemento.style.transform = `translateX(${distancia}px)`;

        this.elemento.classList.add("em-movimento");
        this.elemento.addEventListener(
            "transitionend",
            () => this.elemento.classList.remove("em-movimento"),
            { once: true }
        );
    }

    /**
     * Retorna o carrinho para a posição inicial da pista.
     * Usado no botão "Jogar novamente".
     */
    reiniciar() {
        this.elemento.style.transform = "translateX(0px)";
    }
}