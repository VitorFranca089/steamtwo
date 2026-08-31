import { describe, expect, it } from "vitest";
import { loginSchema, passwordSchema, profileSchema, signupSchema, usernameSchema } from "../../server/domain/auth/validation.js";

describe("usernameSchema", () => {
  it("aceita nomes de usuário válidos", () => {
    expect(usernameSchema.parse("Jogador_1")).toBe("Jogador_1");
  });

  it("rejeita caracteres não permitidos e tamanhos inválidos", () => {
    expect(() => usernameSchema.parse("ab")).toThrow();
    expect(() => usernameSchema.parse("nome com espaço")).toThrow();
    expect(() => usernameSchema.parse("a".repeat(25))).toThrow();
  });
});

describe("passwordSchema", () => {
  it("aceita senha forte", () => {
    expect(passwordSchema.parse("Senha@123")).toBe("Senha@123");
  });

  it.each([
    ["curta", "S@1a"],
    ["sem maiúscula", "senha@123"],
    ["sem minúscula", "SENHA@123"],
    ["sem número", "Senha@abc"],
    ["sem caractere especial", "Senha1234"],
  ])("rejeita senha %s", (_label, value) => {
    expect(() => passwordSchema.parse(value)).toThrow();
  });
});

describe("signupSchema", () => {
  it("normaliza e-mail para minúsculas", () => {
    const result = signupSchema.parse({ username: "jogador1", email: "Jogador@Exemplo.com", password: "Senha@123" });
    expect(result.email).toBe("jogador@exemplo.com");
  });
});

describe("loginSchema", () => {
  it("exige identificador e senha não vazios", () => {
    expect(() => loginSchema.parse({ identifier: "", password: "" })).toThrow();
    expect(loginSchema.parse({ identifier: "jogador1", password: "qualquer" })).toEqual({ identifier: "jogador1", password: "qualquer" });
  });
});

describe("profileSchema", () => {
  const base = { fullName: "Fulano da Silva", cpf: "100.000.000-19" };

  it("aceita perfil com maioridade e CPF válido", () => {
    const result = profileSchema.parse({ ...base, birthDate: "2000-01-01" });
    expect(result.cpf).toBe("10000000019");
  });

  it("rejeita menor de 18 anos", () => {
    const veryRecentBirthDate = new Date();
    veryRecentBirthDate.setFullYear(veryRecentBirthDate.getFullYear() - 10);
    expect(() => profileSchema.parse({ ...base, birthDate: veryRecentBirthDate.toISOString().slice(0, 10) })).toThrow();
  });

  it("rejeita CPF inválido", () => {
    expect(() => profileSchema.parse({ ...base, cpf: "111.111.111-11", birthDate: "2000-01-01" })).toThrow();
  });
});
