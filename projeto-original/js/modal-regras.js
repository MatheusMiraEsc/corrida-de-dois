/**
 * Controla a janela (modal) de regras.
 * Este arquivo é usado tanto em index.html quanto em jogo.html,
 * por isso fica separado: assim não repetimos o mesmo código duas vezes.
 *
 * A ideia é simples: o modal já existe no HTML, mas começa com a
 * classe "oculto" (display: none). Abrir = remover a classe.
 * Fechar = adicionar a classe de volta.
 */

const botaoAbrirRegras = document.getElementById("botao-abrir-regras");
const botaoFecharRegras = document.getElementById("botao-fechar-regras");
const modalRegras = document.getElementById("modal-regras");

/**
 * Mostra o modal de regras (e o fundo escuro atrás dele).
 */
function abrirRegras() {
    modalRegras.classList.remove("oculto");
}

/**
 * Esconde o modal de regras e devolve o jogador à tela.
 */
function fecharRegras() {
    modalRegras.classList.add("oculto");
}

botaoAbrirRegras.addEventListener("click", abrirRegras);
botaoFecharRegras.addEventListener("click", fecharRegras);

// Clicar na parte escura (fora da caixa) também fecha o modal.
// "evento.target" é o elemento exato que recebeu o clique: se for o
// próprio fundo escuro (e não algo dentro da caixa), fechamos.
modalRegras.addEventListener("click", (evento) => {
    if (evento.target === modalRegras) {
        fecharRegras();
    }
});
