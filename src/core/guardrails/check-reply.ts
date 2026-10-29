export interface ReplyPolicy {
  /** Every price published in the catalog. */
  allowedAmounts: number[];
  /** Discount percentages of active promotions. */
  allowedDiscounts: number[];
}

export interface ReplyCheck {
  ok: boolean;
  /** e.g. "amount:25", "discount:30", "free". */
  violations: string[];
}

const AMOUNT = /\$\s?(\d+(?:[.,]\d{1,2})?)|(\d+(?:[.,]\d{1,2})?)\s?(?:usd|d[oó]lares)\b/gi;
const PERCENT = /(\d{1,3})\s?%/g;
const DISCOUNT_CONTEXT = /descuento|rebaja|promo|beca|off\b/i;
const FREE = /gratis|gratuit[oa]s?|sin costo/gi;
const NEGATION = /\b(no|ning[uú]n[oa]?|tampoco|nunca|sin embargo)\b/i;

const toNumber = (raw: string): number => Number(raw.replace(",", "."));

/**
 * Deterministic output guard: the model may only quote catalog prices and active promotions,
 * and may never offer a course for free.
 */
export function checkReply(text: string, policy: ReplyPolicy): ReplyCheck {
  const violations: string[] = [];

  for (const match of text.matchAll(AMOUNT)) {
    const amount = toNumber(match[1] ?? match[2]);
    if (!policy.allowedAmounts.includes(amount)) violations.push(`amount:${amount}`);
  }

  for (const match of text.matchAll(PERCENT)) {
    const around = text.slice(Math.max(0, match.index - 30), match.index + match[0].length + 30);
    const pct = Number(match[1]);
    if (DISCOUNT_CONTEXT.test(around) && !policy.allowedDiscounts.includes(pct)) violations.push(`discount:${pct}`);
  }

  for (const match of text.matchAll(FREE)) {
    const before = text.slice(Math.max(0, match.index - 25), match.index);
    if (!NEGATION.test(before)) {
      violations.push("free");
      break;
    }
  }

  return { ok: violations.length === 0, violations };
}
