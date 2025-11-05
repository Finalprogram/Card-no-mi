import { pt } from 'chrono-node';

// Função para fazer o parse de datas em formatos relativos (ex: 'Yesterday', '2 days ago')
export const parseDate = (dateString) => {
  // Tenta fazer o parse da data com o chrono-node
  const parsedDate = pt.parseDate(dateString.trim());
  if (parsedDate) {
    return parsedDate.toISOString();
  }

  // Fallback para datas que o chrono não consegue fazer o parse
  try {
    const fallbackDate = new Date(dateString.trim());
    if (!isNaN(fallbackDate.getTime())) {
      return fallbackDate.toISOString();
    }
  } catch (error) {
    // Ignora erros de parsing no fallback
  }

  // Se tudo falhar, retorna a string original
  return dateString;
};