function validateCPF(cpf) {
  cpf = String(cpf).replace(/[^\d]+/g, '');
  if (cpf.length !== 11 || !!cpf.match(/(\d)\1{10}/)) return false;

  const digits = cpf.split('').map(Number);

  const calcDigit = (slice) => {
    let sum = slice.reduce((acc, digit, index) => acc + digit * (slice.length + 1 - index), 0);
    let remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const d1 = calcDigit(digits.slice(0, 9));
  if (d1 !== digits[9]) return false;

  const d2 = calcDigit(digits.slice(0, 10));
  if (d2 !== digits[10]) return false;

  return true;
}

module.exports = { validateCPF };
