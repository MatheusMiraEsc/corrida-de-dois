/**
 * Teste rápido contra um ambiente JÁ NO AR (ex.: docker compose ou deploy),
 * sem usar rotas de teste: dois navegadores entram na mesma sala, a corrida
 * começa e uma jogada real (dado sorteado pelo servidor) aparece igual nos dois.
 *
 *   E2E_FRONTEND_URL=http://localhost:8081 npx playwright test smoke
 */
import { expect, test, type Browser, type Page } from "@playwright/test";

async function pilot(browser: Browser, name: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/");
  await page.getByLabel("Seu nome de piloto").fill(name);
  return page;
}

async function carSquare(page: Page, name: string): Promise<number> {
  const label = await page.getByRole("img", { name: new RegExp(`^${name} na casa`) }).getAttribute("aria-label");
  return Number(/casa (\d+)/.exec(label ?? "")?.[1]);
}

test("smoke: dois navegadores, uma sala, uma jogada sincronizada", async ({ browser }) => {
  const id = Date.now().toString().slice(-4);
  const ana = await pilot(browser, `Smoke A${id}`);
  const bia = await pilot(browser, `Smoke B${id}`);

  await ana.getByRole("button", { name: "Criar nova sala" }).click();
  await expect(ana).toHaveURL(/\/sala\/[A-Z0-9]{6}$/);
  const code = ana.url().split("/").pop()!;
  await bia.getByLabel("Código da sala").fill(code);
  await bia.getByRole("button", { name: "Entrar", exact: true }).click();

  await ana.getByRole("button", { name: "Estou pronto!" }).click();
  await bia.getByRole("button", { name: "Estou pronto!" }).click();
  await ana.getByRole("button", { name: "Dar a largada" }).click();

  const hasTurn = (page: Page) => page.getByRole("button", { name: "Lançar dado" }).isEnabled();
  await expect.poll(async () => (await hasTurn(ana)) || (await hasTurn(bia))).toBe(true);
  const [mover, name] = (await hasTurn(ana)) ? [ana, `Smoke A${id}`] : [bia, `Smoke B${id}`];
  await mover.getByRole("button", { name: "Lançar dado" }).click();

  // A posição muda (ou fica, se o dado passar de 100 — impossível na 1ª jogada) e é igual nos dois.
  await expect.poll(() => carSquare(ana, name), { timeout: 15_000 }).toBeGreaterThan(1);
  await expect.poll(() => carSquare(bia, name), { timeout: 15_000 }).toBe(await carSquare(ana, name));

  // Sair encerra a partida como abandonada (não pontua) e o outro é avisado.
  await mover.getByRole("button", { name: "Sair da partida" }).click();
  await mover.getByRole("button", { name: "Sair", exact: true }).click();
  const other = mover === ana ? bia : ana;
  await expect(other.getByText(/Ninguém pontuou/).first()).toBeVisible();
});
