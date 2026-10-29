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

// "40", "40,00", "40.5" or thousands like "40.000".
const NUMBER = String.raw`\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?`;

const AMOUNT = new RegExp(
  String.raw`(?:\$|\busd)\s?(${NUMBER})|(${NUMBER})\s?(?:\$|usd\b|d[oó]lares\b)`,
  "gi",
);

const PERCENT = String.raw`(\d{1,3})\s?(?:%|por\s?ciento)`;
const DISCOUNT = new RegExp(
  String.raw`${PERCENT}\s?(?:de\s)?(?:descuento|rebaja|off)\b|\b(?:descuento|rebaja)\s(?:del?\s)?${PERCENT}`,
  "gi",
);
const HALF_PRICE = /\b(mitad de precio|medio precio|precio a la mitad)\b/i;

const FREE = /gratis|gratuit[oa]s?|sin costo/gi;
// Phrases that offer the course for free with no "gratis" word.
const FREE_OFFER = /\b(te lo regal\w*|se lo regal\w*|regal(o|amos|arte) el curso|sin pagar|no (te )?(cobr\w+|pag\w+) nada)\b/i;
// A denial only counts when the negation governs the "free" word directly, e.g. "no es gratuito",
// "no tenemos cursos sin costo", "ningún curso es gratis". Anything else ("No hay drama, es gratis") is an offer.
const DENIAL = new RegExp(
  String.raw`\b(no|ning[uú]n[oa]?|tampoco|nunca)\s+(?:(?:es|son|ser[aá]|est[aá]n?|hay|tiene|tienen|tenemos|ofrecemos|existe|existen|incluye|el|la|los|las|un|una|curso|cursos|realmente|totalmente)\s+){0,3}$`,
  "i",
);

const toNumber = (raw: string): number =>
  /^\d{1,3}(?:\.\d{3})+/.test(raw) ? Number(raw.replace(/\./g, "").replace(",", ".")) : Number(raw.replace(",", "."));

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

  for (const match of text.matchAll(DISCOUNT)) {
    const pct = Number(match[1] ?? match[2]);
    if (!policy.allowedDiscounts.includes(pct)) violations.push(`discount:${pct}`);
  }
  if (HALF_PRICE.test(text) && !policy.allowedDiscounts.includes(50)) violations.push("discount:50");

  const freeOffer =
    FREE_OFFER.test(text) || [...text.matchAll(FREE)].some((match) => !DENIAL.test(text.slice(0, match.index)));
  if (freeOffer) violations.push("free");

  return { ok: violations.length === 0, violations };
}
