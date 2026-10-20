# 🏁 Corrida dos Dois

Jogo de corrida por turnos para **dois jogadores**, desenvolvido em **HTML5, CSS3 e JavaScript**.

Cada jogador controla um carrinho em uma pista. Os jogadores se revezam rolando um dado; o carrinho avança a quantidade de casas sorteada. O primeiro a cruzar a linha de chegada vence.

---

## 🎮 Como jogar

1. Abra `index.html` em um navegador.
2. Digite o nome do Jogador 1 e do Jogador 2.
3. Clique em **Iniciar jogo**.
4. Na página do jogo, o jogador da vez clica em **🎲 Rolar dado** para avançar.
5. O jogo alterna os turnos automaticamente até que um jogador alcance a linha de chegada.
6. Ao final, clique em **Jogar novamente** para reiniciar a partida (mantendo os nomes).

---

## 📁 Estrutura do projeto

```
projeto/
├── index.html          # Página de configuração (nomes dos jogadores)
├── jogo.html            # Página do jogo (pista, placar, histórico)
│
├── css/
│   └── estilo.css        # Todo o estilo visual do projeto
│
└── js/
    ├── jogador.js        # Classe Jogador — estado lógico (nome, posição, pontos)
    ├── carrinho.js        # Classe Carrinho — elemento visual e animação
    ├── jogo.js            # Classe Jogo — turnos, dado e condição de vitória
    ├── configuracao.js    # Lógica da página inicial (validação e redirecionamento)
    ├── modal-regras.js    # Abre/fecha a janela de regras (usado nas duas páginas)
    └── main.js            # Ponto de entrada da página do jogo (liga tudo)
```

---

## 🧩 Arquitetura

O projeto segue a seguinte separação de responsabilidades:

- **`Jogador`** — guarda apenas dados (nome, posição, pontuação).
- **`Carrinho`** — traduz a posição lógica do jogador em posição visual na pista, aplicando a animação via `transform` + `transition` (CSS).
- **`Jogo`** — orquestra a partida: sorteio do dado, troca de turnos e verificação de vitória. Não manipula tabela, lista ou destaque visual diretamente.
- **`main.js`** — "cola" tudo: lê os nomes da URL, instancia as classes, escuta os eventos de clique e atualiza a interface (placar, tabela de histórico, lista de eventos, destaque do jogador da vez).

```
Jogo
 ├── Jogador (x2)
 ├── Carrinho (x2)
 ├── Estado da partida (emAndamento / finalizado)
 └── Regras (dado, turno, vitória)
```

---

## 🛠️ Tecnologias

- HTML5
- CSS3 (variáveis CSS, `transition`, `@keyframes`, Flexbox, media query)
- JavaScript (ES6+: `class`, `const`/`let`, template literals, `URLSearchParams`, `classList`, `addEventListener`)
