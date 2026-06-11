interface MoneyOptions {
  currency?: string | null;
  symbol?: string | null;
  locale?: string;
}

export function formatMoney(amount: number, options: MoneyOptions = {}): string {
  const currency = (options.currency || "GTQ").toUpperCase();
  const locale = options.locale || "es-GT";

  if (options.symbol) {
    return `${options.symbol}${new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)}`;
  }

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("es-GT").format(new Date(date));
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat("es-GT", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length >= 8) {
    return cleaned.replace(/(\d{4})(\d{4})/, "$1-$2");
  }
  return phone;
}
