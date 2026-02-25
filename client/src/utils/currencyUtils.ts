export const formatCurrency = (
  amount: number,
  currency: string = "",
): string => {
  const absAmount = Math.abs(Number(amount || 0));
  const normalizedCurrency = String(currency || "").trim().toUpperCase();
  const symbol = normalizedCurrency === "USD" ? "$" : "";
  const suffix = !symbol && normalizedCurrency ? ` ${normalizedCurrency}` : "";

  if (absAmount >= 1000000) {
    const millions = absAmount / 1000000;
    if (millions >= 100) return `${symbol}${Math.floor(millions)}M${suffix}`;
    if (millions >= 10) return `${symbol}${millions.toFixed(1)}M${suffix}`;
    return `${symbol}${millions.toFixed(2)}M`.replace(/\.?0+$/, "") + suffix;
  }

  if (absAmount >= 1000) {
    const thousands = absAmount / 1000;
    if (thousands >= 100) return `${symbol}${Math.floor(thousands)}k${suffix}`;
    if (thousands >= 10) return `${symbol}${thousands.toFixed(1)}k${suffix}`;
    return `${symbol}${thousands.toFixed(2)}k`.replace(/\.?0+$/, "") + suffix;
  }

  return `${symbol}${absAmount.toLocaleString()}${suffix}`;
};

export const formatBalance = (amount: number): string =>
  Number(amount || 0).toLocaleString();
