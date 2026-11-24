/**
 * Controla o formulário da página inicial: valida os nomes informados
 * e, se estiverem corretos, redireciona para jogo.html passando os
 * nomes como parâmetros na URL.
 */

const formulario = document.getElementById("form-configuracao");
const inputJogador1 = document.getElementById("input-jogador1");
const inputJogador2 = document.getElementById("input-jogador2");
const erroJogador1 = document.getElementById("erro-jogador1");
const erroJogador2 = document.getElementById("erro-jogador2");


formulario.addEventListener("submit", (evento) => {
    evento.preventDefault();

    const nomeJogador1 = inputJogador1.value.trim();
    const nomeJogador2 = inputJogador2.value.trim();

    const nomesValidos = validarNomes(nomeJogador1, nomeJogador2);

    if (nomesValidos) {
        redirecionarParaJogo(nomeJogador1, nomeJogador2);
    }
});


// Veículos selecionados por cada jogador.
const veiculosSelecionados = {
    1: "fa-car-side",
    2: "fa-car-side"
};

// Permite selecionar um veículo para cada jogador.
document.querySelectorAll(".selecao-veiculos").forEach((selecao) => {
    const numeroJogador = selecao.dataset.jogador;

    selecao.addEventListener("click", (evento) => {
        const botao = evento.target.closest(".opcao-veiculo");

        if (!botao || !selecao.contains(botao)) {
            return;
        }

        veiculosSelecionados[numeroJogador] = botao.dataset.icone;

        // Atualiza o destaque visual da seleção.
        selecao.querySelectorAll(".opcao-veiculo").forEach((opcao) => {
            const selecionado = opcao === botao;

            opcao.classList.toggle("selecionado", selecionado);
            opcao.setAttribute("aria-pressed", String(selecionado));
        });
    });
});

/**
 * Valida os dois nomes informados, exibindo mensagens de erro
 * quando necessário.
 * @param {string} nome1
 * @param {string} nome2
 * @returns {boolean} true se ambos os nomes forem válidos
 */
function validarNomes(nome1, nome2) {
    let valido = true;

    if (nome1 === "") {
        erroJogador1.textContent = "Digite um nome para o Jogador 1.";
        valido = false;
    } else {
        erroJogador1.textContent = "";
    }

    if (nome2 === "") {
        erroJogador2.textContent = "Digite um nome para o Jogador 2.";
        valido = false;
    } else {
        erroJogador2.textContent = "";
    }

    return valido;
}

/**
 * Monta a URL de jogo.html com os nomes codificados e redireciona
 * o navegador para lá.
 * @param {string} nome1
 * @param {string} nome2
 */
function redirecionarParaJogo(nome1, nome2) {
    const parametros = new URLSearchParams({
        jogador1: nome1,
        jogador2: nome2,
        veiculo1: veiculosSelecionados[1],
        veiculo2: veiculosSelecionados[2]
    });

    window.location.href = `jogo.html?${parametros.toString()}`;
}