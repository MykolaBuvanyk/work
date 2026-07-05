export const formatMoney = (value, currency = "\u20ac") => {
  const numeric = Number(String(value ?? "").replace(",", "."));
  const amount = Number.isFinite(numeric) ? numeric : 0;
  return `${amount.toFixed(2).replace(".", ",")} ${currency}`;
};
