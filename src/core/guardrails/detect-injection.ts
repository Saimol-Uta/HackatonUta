export type InjectionCategory =
  | "instruction_override"
  | "prompt_leak"
  | "role_play"
  | "authority_claim"
  | "discount_pressure";

export interface InjectionVerdict {
  suspected: boolean;
  categories: InjectionCategory[];
}

// Patterns run on lowercased text without accents. Plain questions about prices,
// discounts or "is it free?" are legitimate and must not match.
const RULES: [InjectionCategory, RegExp[]][] = [
  [
    "instruction_override",
    [
      /\b(ignora|olvida|omite|salta|desobedece)\w*\b.{0,30}\b(instrucciones|reglas|indicaciones|directrices|restricciones|politicas)\b/,
      /\b(ignore|forget|disregard)\b.{0,30}\b(instructions|rules|prompt)\b/,
      /\bnuevas? (instrucciones|reglas)\b/,
    ],
  ],
  [
    "prompt_leak",
    [
      /\b(prompt|mensaje) (del|de) sistema\b/,
      /\bsystem prompt\b/,
      /\b(cuales|dime|muestra\w*|revela\w*|repite)\b.{0,20}\btus (instrucciones|reglas|directrices)\b/,
    ],
  ],
  [
    "role_play",
    [
      /\b(a partir de ahora|desde ahora|ahora) eres\b/,
      /\b(actua|finge|haz de cuenta|pretende)\w*\b.{0,15}\b(como|que eres|ser)\b/,
      /\bmodo (desarrollador|developer|dios|admin|sin restricciones)\b/,
      /\b(jailbreak|dan mode)\b/,
    ],
  ],
  [
    "authority_claim",
    [/\bsoy (el|la) (director|directora|decano|decana|rector|rectora|administrador|administradora|jefe|jefa|duen[oa]|coordinador|coordinadora)\b/],
  ],
  [
    "discount_pressure",
    [
      /\b(dame|deme|da me|aplica\w*|exijo|regala\w*|quiero que me (des|den|hagas))\b.{0,30}\b(descuento|gratis|gratuito|rebaja|beca|sin costo)\b/,
      /\bdescuento del? \d{2,3} ?%/,
      /\b\d{2,3} ?% de descuento\b/,
    ],
  ],
];

const normalize = (text: string): string =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/** Deterministic first line of defense against prompt injection; the classifier adds a second opinion. */
export function detectInjection(text: string): InjectionVerdict {
  const normalized = normalize(text);
  const categories = RULES.filter(([, patterns]) => patterns.some((p) => p.test(normalized))).map(
    ([category]) => category,
  );
  return { suspected: categories.length > 0, categories };
}
