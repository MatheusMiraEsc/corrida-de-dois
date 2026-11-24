import { afterEach, describe, expect, it, vi } from "vitest";
import { createRequestId } from "./gameSocket";

describe("createRequestId", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("gera ids aleatórios de 32 caracteres hexadecimais", () => {
    const ids = new Set(Array.from({ length: 100 }, createRequestId));
    expect(ids.size).toBe(100);
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{32}$/);
  });

  it("funciona fora de contexto seguro (sem crypto.randomUUID), como em http://192.168.x.x", () => {
    vi.stubGlobal("crypto", { getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto) });
    expect(createRequestId()).toMatch(/^[0-9a-f]{32}$/);
  });
});
