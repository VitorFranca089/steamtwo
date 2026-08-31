/** Standard Brazilian CPF checksum (mod 11), same algorithm Receita Federal uses. */
export function normalizeCpf(raw) {
  return String(raw ?? "").replace(/\D/g, "");
}

export function isValidCpf(raw) {
  const cpf = normalizeCpf(raw);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  const digits = cpf.split("").map(Number);
  const checkDigit = (length) => {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += digits[i] * (length + 1 - i);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return checkDigit(9) === digits[9] && checkDigit(10) === digits[10];
}
