import { describe, expect, it } from "vitest";
import { isValidCpf, normalizeCpf } from "../../server/domain/auth/cpf.js";
import { calculateAge } from "../../server/domain/auth/age.js";

describe("cpf validation", () => {
  it("aceita um CPF com dígitos verificadores corretos", () => {
    expect(isValidCpf("100.000.000-19")).toBe(true);
    expect(isValidCpf("10000000019")).toBe(true);
  });

  it("rejeita dígitos verificadores incorretos", () => {
    expect(isValidCpf("100.000.000-00")).toBe(false);
  });

  it("rejeita sequências repetidas e tamanhos inválidos", () => {
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCpf("123")).toBe(false);
    expect(isValidCpf("")).toBe(false);
  });

  it("normaliza removendo pontuação", () => {
    expect(normalizeCpf("100.000.000-19")).toBe("10000000019");
  });
});

describe("calculateAge", () => {
  it("calcula idade completa quando já fez aniversário no ano", () => {
    expect(calculateAge("2000-01-01", new Date("2026-06-01"))).toBe(26);
  });

  it("não conta o aniversário ainda não ocorrido no ano", () => {
    expect(calculateAge("2000-12-31", new Date("2026-06-01"))).toBe(25);
  });
});
