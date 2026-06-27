/** Currency + date formatting for Runway (ZAR, en-ZA). */

const zar = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  maximumFractionDigits: 0,
});

const zarCents = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatZAR(amount: number, withCents = false): string {
  return (withCents ? zarCents : zar).format(amount);
}

const dateFmt = new Intl.DateTimeFormat("en-ZA", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function formatDate(value: string | Date): string {
  return dateFmt.format(typeof value === "string" ? new Date(value) : value);
}
