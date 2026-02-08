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

function validateCNPJ(cnpj) {
  cnpj = String(cnpj).replace(/[^\d]+/g, '');
  if (cnpj.length !== 14 || !!cnpj.match(/(\d)\1{13}/)) return false;

  const digits = cnpj.split('').map(Number);
  const calcDigit = (slice, weights) => {
    const sum = slice.reduce((acc, digit, index) => acc + digit * weights[index], 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const weights1 = [5,4,3,2,9,8,7,6,5,4,3,2];
  const d1 = calcDigit(digits.slice(0, 12), weights1);
  if (d1 !== digits[12]) return false;

  const weights2 = [6,5,4,3,2,9,8,7,6,5,4,3,2];
  const d2 = calcDigit(digits.slice(0, 13), weights2);
  if (d2 !== digits[13]) return false;

  return true;
}

function validateEmail(email) {
  if (!email) return false;
  const value = String(email).trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validatePhoneBR(phone) {
  if (!phone) return false;
  const digits = String(phone).replace(/[^\d]+/g, '');
  return digits.length === 10 || digits.length === 11;
}

function validateWhatsApp(whatsapp) {
  if (!whatsapp) return false;
  const value = String(whatsapp).trim();
  if (/^https?:\/\/(www\.)?wa\.me\/\d{10,15}$/.test(value)) return true;
  const digits = value.replace(/[^\d]+/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

module.exports = { validateCPF, validateCNPJ, validateEmail, validatePhoneBR, validateWhatsApp };
