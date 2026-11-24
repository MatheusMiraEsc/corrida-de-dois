/**
 * E2E: dois pilotos em navegadores separados jogam uma partida completa.
 * Os valores do dado são fixados pela rota de teste do backend para que a
 * partida seja previsível; todo o resto (turnos, animação, sincronização,
 * vitória, ranking) é o fluxo real.
 */
import { expect, test, type Browser, type Page } from "@playwright/test";

const BACKEND_URL = process.env.E2E_BACKEND_URL ?? "http://localhost:3101";
const SHOTS = process.env.E2E_SCREENSHOTS_DIR;

/** Sequência intercalada: o primeiro a jogar vence (sem tirar 6). */
const WINNER_ROLLS = [3, 5, 2, 5, 4, 4, 5, 4];
const WINNER_POSITIONS = [14, 19, 42, 47, 67, 91, 96, 100];
const LOSER_POSITIONS = [2, 3, 14, 15, 16, 7, 8];

async function newPilot(browser: Browser, name: string): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: 1400, height: 950 } });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByLabel("Seu nome de piloto").fill(name);
  return page;
}

async function carSquare(page: Page, name: string): Promise<number> {
  const label = await page.getByRole("img", { name: new RegExp(`^${name} na casa`) }).getAttribute("aria-label");
  return Number(/casa (\d+)/.exec(label ?? "")?.[1]);
}

async function shot(page: Page, file: string) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${file}.png`, fullPage: false });
}

async function forceDice(code: string, values: number[]) {
  const response = await fetch(`${BACKEND_URL}/api/test/rooms/${code}/dice`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ values }),
  });
  expect(response.status).toBe(204);
}

/** Cria a sala com Ana, Bia entra pelo código, ambos ficam prontos e a corrida começa. */
async function startRace(browser: Browser, suffix: string) {
  const ana = await newPilot(browser, `Ana ${suffix}`);
  const bia = await newPilot(browser, `Bia ${suffix}`);

  await ana.getByRole("radio", { name: "Picape" }).click();
  await ana.getByRole("button", { name: "Criar nova sala" }).click();
  await expect(ana).toHaveURL(/\/sala\/[A-Z0-9]{6}$/);
  const code = ana.url().split("/").pop()!;
  await shot(ana, "02-sala-espera");

  await bia.getByRole("radio", { name: "Moto" }).click();
  await bia.getByLabel("Código da sala").fill(code.toLowerCase());
  await bia.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(bia).toHaveURL(new RegExp(`/sala/${code}$`));
  await expect(ana.getByText(`Bia ${suffix}`).first()).toBeVisible();

  await ana.getByRole("button", { name: "Estou pronto!" }).click();
  await bia.getByRole("button", { name: "Estou pronto!" }).click();
  await expect(bia.getByText("Quem criou a sala dá a largada.")).toBeVisible();
  await ana.getByRole("button", { name: "Dar a largada" }).click();

  await expect(ana.getByRole("group", { name: "Tabuleiro com 100 casas" })).toBeVisible();
  await expect(bia.getByRole("group", { name: "Tabuleiro com 100 casas" })).toBeVisible();
  return { ana, bia, code };
}

/** Descobre quem começa (sorteio do servidor) pelo indicador de vez. */
async function whoStarts(ana: Page, bia: Page): Promise<[Page, Page]> {
  const hasTurn = (page: Page) => page.getByText("Sua vez! Lance o dado").isVisible();
  await expect.poll(async () => (await hasTurn(ana)) || (await hasTurn(bia))).toBe(true);
  return (await hasTurn(ana)) ? [ana, bia] : [bia, ana];
}

test("partida completa entre dois navegadores, com ranking e revanche", async ({ browser }) => {
  const suffix = Date.now().toString().slice(-5);
  const home = await newPilot(browser, "Visitante");
  await shot(home, "01-inicio");
  await home.context().close();

  const { ana, bia, code } = await startRace(browser, suffix);
  const [first, second] = await whoStarts(ana, bia);
  const firstName = first === ana ? `Ana ${suffix}` : `Bia ${suffix}`;
  const secondName = first === ana ? `Bia ${suffix}` : `Ana ${suffix}`;

  // Jogar fora da vez: o botão do segundo jogador fica desabilitado.
  await expect(second.getByRole("button", { name: "Aguarde sua vez" })).toBeDisabled();

  const sequence: number[] = [];
  WINNER_ROLLS.forEach((roll, i) => {
    sequence.push(roll);
    if (i < WINNER_ROLLS.length - 1) sequence.push(1);
  });
  await forceDice(code, sequence);

  for (let i = 0; i < sequence.length; i += 1) {
    const mover = i % 2 === 0 ? first : second;
    const button = mover.getByRole("button", { name: "Lançar dado" });
    await expect(button).toBeEnabled({ timeout: 20_000 });
    await button.click();

    const winnerAt = WINNER_POSITIONS[Math.floor(i / 2)];
    const loserAt = i === 0 ? 1 : LOSER_POSITIONS[Math.floor((i - 1) / 2)];
    // Os DOIS navegadores mostram as mesmas posições depois da animação.
    for (const page of [ana, bia]) {
      await expect.poll(() => carSquare(page, firstName), { timeout: 20_000 }).toBe(winnerAt);
      await expect.poll(() => carSquare(page, secondName), { timeout: 20_000 }).toBe(loserAt);
    }
    if (i === 4) {
      await shot(ana, "03-jogo-andamento");
      // A serpente da casa 17 aparece no histórico do segundo jogador mais adiante;
      // aqui conferimos a escada que o primeiro subiu.
      await expect(ana.getByText(/subiu a escada até a 42/).first()).toBeVisible();
    }
  }

  await expect(first.getByText("Você venceu!")).toBeVisible();
  await expect(second.getByText("Fim de corrida")).toBeVisible();
  for (const page of [first, second]) {
    await expect(page.getByRole("cell", { name: "+100" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "+20" })).toBeVisible();
    await expect(page.getByText("resultado salvo no ranking global")).toBeVisible();
  }
  await shot(first, "04-resultado");

  // Histórico do perdedor registra a serpente da casa 17.
  await first.getByRole("button", { name: "Fechar" }).click();
  await expect(first.getByText(/foi atingido pela serpente até a 7/).first()).toBeVisible();

  // Revanche: posições voltam à casa 1 e a partida nº 2 começa.
  await second.getByRole("button", { name: "Jogar novamente" }).click();
  await expect(ana.getByText("Partida 2")).toBeVisible();
  for (const page of [ana, bia]) {
    await expect.poll(() => carSquare(page, firstName)).toBe(1);
    await expect.poll(() => carSquare(page, secondName)).toBe(1);
    await expect(page.getByText("A largada foi dada. Os lances aparecem aqui.")).toBeVisible();
  }

  // Ranking global mostra os dois com a pontuação certa.
  await ana.goto("/ranking");
  await expect(ana.getByRole("heading", { name: "Ranking global" })).toBeVisible();
  await expect(ana.getByText(firstName).first()).toBeVisible();
  await expect(ana.getByText(secondName).first()).toBeVisible();
  await shot(ana, "05-ranking");
});

test("queda de conexão pausa a partida e a reconexão retoma de onde parou", async ({ browser }) => {
  const suffix = Date.now().toString().slice(-5);
  const { ana, bia, code } = await startRace(browser, suffix);
  const [first, second] = await whoStarts(ana, bia);
  await forceDice(code, [2]);
  await first.getByRole("button", { name: "Lançar dado" }).click();
  await expect(second.getByRole("button", { name: "Lançar dado" })).toBeEnabled({ timeout: 20_000 });

  // O segundo jogador "cai" (fecha a aba).
  const context = second.context();
  await second.close();
  await expect(first.getByText("Partida pausada")).toBeVisible();
  await shot(first, "06-pausada");

  // Volta pelo mesmo navegador: identidade salva → reconecta à mesma sala.
  const back = await context.newPage();
  await back.goto(`/sala/${code}`);
  await expect(back.getByRole("group", { name: "Tabuleiro com 100 casas" })).toBeVisible();
  await expect(first.getByText("Partida pausada")).toBeHidden();
  await expect(back.getByRole("button", { name: "Lançar dado" })).toBeEnabled();
});

test("terceiro piloto não entra em sala cheia", async ({ browser }) => {
  const suffix = Date.now().toString().slice(-5);
  const { code } = await startRace(browser, suffix);
  const caio = await newPilot(browser, `Caio ${suffix}`);
  await caio.getByLabel("Código da sala").fill(code);
  await caio.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(caio.getByRole("alert")).toHaveText("Essa sala já tem dois pilotos.");
});

test("layout do jogo no celular", async ({ browser }) => {
  const suffix = Date.now().toString().slice(-5);
  const { ana, code } = await startRace(browser, suffix);
  await ana.setViewportSize({ width: 390, height: 844 });
  const board = ana.getByRole("group", { name: "Tabuleiro com 100 casas" });
  const box = await board.boundingBox();
  expect(box!.width).toBeLessThanOrEqual(390);
  expect(box!.width).toBeGreaterThan(300);
  await shot(ana, "07-celular");
  expect(code).toMatch(/^[A-Z0-9]{6}$/);
});
