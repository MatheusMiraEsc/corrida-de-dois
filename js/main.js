/**
 * Ponto de entrada de jogo.html.
 * Nesta etapa: lê os nomes dos jogadores pela URL, valida a presença
 * deles, cria as instâncias de Jogador/Carrinho/Jogo e exibe os nomes
 * no placar. A mecânica do dado e a manipulação dinâmica de tabela/lista
 * serão adicionadas nas próximas etapas.
 */

const TOTAL_DE_CASAS = 20;

const parametros = new URLSearchParams(window.location.search);
const nomeJogador1 = parametros.get("jogador1");
const nomeJogador2 = parametros.get("jogador2");

// Se a página foi aberta sem os parâmetros esperados (por exemplo,
// digitando a URL diretamente), voltamos para a configuração.
if (!nomeJogador1 || !nomeJogador2) {
    window.location.href = "index.html";
}

// --- Criação dos jogadores ---
const jogador1 = new Jogador(nomeJogador1, 1);
const jogador2 = new Jogador(nomeJogador2, 2);

// --- Criação dos carrinhos (elementos visuais) ---
const elementoCarrinho1 = document.getElementById("carrinho1");
const elementoCarrinho2 = document.getElementById("carrinho2");

const carrinho1 = new Carrinho(elementoCarrinho1, TOTAL_DE_CASAS);
const carrinho2 = new Carrinho(elementoCarrinho2, TOTAL_DE_CASAS);

// --- Criação do jogo ---
const jogo = new Jogo(jogador1, jogador2, TOTAL_DE_CASAS);

// --- Exibição inicial dos nomes no placar ---
document.getElementById("nome-jogador1").textContent = jogador1.nome;
document.getElementById("nome-jogador2").textContent = jogador2.nome;

document.getElementById("posicao-jogador1").textContent = jogador1.posicao;
document.getElementById("posicao-jogador2").textContent = jogador2.posicao;

document.getElementById("vez-atual").textContent =
    `Vez de: ${jogo.obterJogadorAtual().nome}`;

// --- Referências usadas pela mecânica do jogo ---
const carrinhos = [carrinho1, carrinho2];

const botaoRolar = document.getElementById("botao-rolar");
const resultadoDado = document.getElementById("resultado-dado");
const botaoReiniciar = document.getElementById("botao-reiniciar");
const areaFinal = document.getElementById("area-final");
const mensagemFinal = document.getElementById("mensagem-final");

// --- Referências usadas pelo DOM dinâmico (tabela, lista e destaque) ---
const painelJogador1 = document.getElementById("painel-jogador1");
const painelJogador2 = document.getElementById("painel-jogador2");
const paineis = [painelJogador1, painelJogador2];

const corpoHistorico = document.getElementById("corpo-historico");
const listaEventos = document.getElementById("lista-eventos");

const LIMITE_LINHAS_HISTORICO = 8;
const LIMITE_ITENS_EVENTOS = 6;

/**
 * Aplica a classe ".vez-atual" apenas ao painel do jogador da vez,
 * removendo-a do painel do adversário.
 */
function atualizarDestaqueTurno() {
    paineis.forEach((painel, indice) => {
        if (indice === jogo.indiceJogadorAtual) {
            painel.classList.add("vez-atual");
        } else {
            painel.classList.remove("vez-atual");
        }
    });
}

/**
 * Adiciona uma nova linha ao histórico de jogadas e remove a mais antiga
 * quando o limite de linhas é ultrapassado.
 * @param {string} nomeJogador
 * @param {number} valorDado
 * @param {number} casasMovidas
 * @param {number} posicaoFinal
 */
function registrarHistorico(nomeJogador, valorDado, casasMovidas, posicaoFinal) {
    const novaLinha = corpoHistorico.insertRow();

    novaLinha.insertCell().textContent = nomeJogador;
    novaLinha.insertCell().textContent = valorDado;
    novaLinha.insertCell().textContent = casasMovidas;
    novaLinha.insertCell().textContent = posicaoFinal;

    if (corpoHistorico.rows.length > LIMITE_LINHAS_HISTORICO) {
        corpoHistorico.deleteRow(0);
    }
}

/**
 * Adiciona um novo item à lista de últimos acontecimentos, inserindo-o
 * no topo e removendo o item mais antigo quando o limite é ultrapassado.
 * @param {string} texto
 */
function registrarEvento(texto) {
    const novoItem = document.createElement("li");
    novoItem.textContent = texto;
    listaEventos.prepend(novoItem);

    while (listaEventos.children.length > LIMITE_ITENS_EVENTOS) {
        listaEventos.removeChild(listaEventos.lastElementChild);
    }
}

atualizarDestaqueTurno();

/**
 * @returns {Carrinho} o carrinho correspondente ao jogador da vez
 */
function obterCarrinhoAtual() {
    return carrinhos[jogo.indiceJogadorAtual];
}

/**
 * Atualiza os números de posição exibidos no placar para os dois jogadores.
 */
function atualizarPlacar() {
    document.getElementById("posicao-jogador1").textContent = jogador1.posicao;
    document.getElementById("posicao-jogador2").textContent = jogador2.posicao;
}

/**
 * Trata o clique no botão "Rolar dado": sorteia o valor, move o jogador
 * da vez (lógica e visualmente), verifica se houve vencedor e, se não
 * houve, passa a vez para o outro jogador.
 */
function tratarRolagemDeDado() {
    const jogadorDaVez = jogo.obterJogadorAtual();
    const carrinhoDaVez = obterCarrinhoAtual();

    const valorDado = jogo.rolarDado();
    resultadoDado.textContent = `Resultado: ${valorDado}`;
    registrarEvento(`${jogadorDaVez.nome} rolou o dado e tirou ${valorDado}.`);

    jogo.avancarJogadorAtual(valorDado);
    carrinhoDaVez.moverPara(jogadorDaVez.posicao);
    atualizarPlacar();
    registrarEvento(`${jogadorDaVez.nome} avançou ${valorDado} casas.`);
    registrarHistorico(jogadorDaVez.nome, valorDado, valorDado, jogadorDaVez.posicao);

    const vencedor = jogo.verificarVencedor();

    if (vencedor) {
        finalizarPartida(vencedor);
    } else {
        jogo.trocarTurno();
        document.getElementById("vez-atual").textContent =
            `Vez de: ${jogo.obterJogadorAtual().nome}`;
        registrarEvento(`Agora é a vez de ${jogo.obterJogadorAtual().nome}.`);
        atualizarDestaqueTurno();
    }
}

/**
 * Exibe a mensagem de vitória e desabilita o botão de rolar dado.
 * @param {Jogador} vencedor
 */
function finalizarPartida(vencedor) {
    mensagemFinal.textContent = `🏆 ${vencedor.nome} venceu a corrida!`;
    registrarEvento(`${vencedor.nome} venceu a corrida! 🏆`);
    areaFinal.classList.remove("oculto");
    botaoRolar.disabled = true;
}

/**
 * Reinicia a partida: zera posições, esconde a mensagem final,
 * reabilita o botão de rolar dado e retorna os carrinhos ao início.
 */
function tratarReinicio() {
    jogo.reiniciarPartida();
    carrinho1.reiniciar();
    carrinho2.reiniciar();

    atualizarPlacar();
    resultadoDado.textContent = "Resultado: —";
    areaFinal.classList.add("oculto");
    botaoRolar.disabled = false;

    corpoHistorico.innerHTML = "";
    listaEventos.innerHTML = "";

    document.getElementById("vez-atual").textContent =
        `Vez de: ${jogo.obterJogadorAtual().nome}`;
    atualizarDestaqueTurno();
}

botaoRolar.addEventListener("click", tratarRolagemDeDado);
botaoReiniciar.addEventListener("click", tratarReinicio);

// Como moverPara() calcula a distância com base na largura atual da pista,
// redimensionar a janela pode desalinhar visualmente os carrinhos em
// relação à posição lógica. Recalculamos a posição visual ao redimensionar.
window.addEventListener("resize", () => {
    carrinho1.moverPara(jogador1.posicao);
    carrinho2.moverPara(jogador2.posicao);
});