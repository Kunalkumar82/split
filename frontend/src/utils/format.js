/**
 * Formats an amount with currency symbol using Indian grouping system (lakhs/crores).
 * E.g., 150000 -> ₹ 1,50,000.00
 * @param {number} amount - The numeric amount
 * @param {string} currency - Currency code (INR, USD, EUR, GBP, etc.)
 * @returns {string} - Formatted currency string
 */
export const formatAmount = (amount, currency = 'INR') => {
  const symbols = {
    'INR': '₹',
    'USD': '$',
    'EUR': '€',
    'GBP': '£'
  };
  const symbol = symbols[currency] || currency;

  try {
    const formattedNumber = new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);

    return `${symbol} ${formattedNumber}`;
  } catch (e) {
    return `${symbol} ${Number(amount).toFixed(2)}`;
  }
};
