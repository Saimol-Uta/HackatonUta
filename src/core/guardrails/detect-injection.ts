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

const AUTHORITY_ROLE =
  "(director|directora|decano|decana|rector|rectora|administrador|administradora|jefe|jefa|duen[oa]|coordinador|coordinadora|gerente)";

// Words that turn a claimed role into pressure. A coordinator enrolling students is a lead, not an attack.
const PRESSURE = /\b(gratis|gratuit\w*|sin costo|descuento|rebaja|beca|regal\w*|autoriz\w*|orden\w*|exij\w*|obligo)\b/;

// Patterns run on lowercased text without accents. Plain questions about prices,
// discounts or "is it free?" are legitimate and must not match.
const RULES: [InjectionCategory, RegExp[]][] = [
  [
    "instruction_override",
    [
      /\b(ignora|olvida|omite|salta|desobedece|cambia|modifica|reemplaza|anula|borra)\w*\b.{0,30}\b(instrucciones|reglas|indicaciones|directrices|restricciones|politicas|lo anterior|lo que te dijeron)\b/,
      /\b(ignore|forget|disregard)\b.{0,30}\b(instructions|rules|prompt|above)\b/,
      /\bnuev[oa]s? (instrucciones|reglas|directrices|ordenes|politicas|indicaciones)\b/,
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
      /\b(a partir de ahora|desde ahora|de ahora en adelante|desde hoy) (eres|seras|actuas)\b/,
      /\beres (un|una) (asistente|bot|ia|modelo|chatbot)\b.{0,20}\b(sin|libre de)\b/,
      /\b(actua|finge|haz de cuenta|pretende)\w*\b.{0,15}\b(como|que eres|ser)\b/,
      /\bmodo (desarrollador|developer|dios|admin|sin restricciones)\b/,
      /\b(jailbreak|dan mode)\b/,
    ],
  ],
  [
    "authority_claim",
    [
      new RegExp(String.raw`\b(soy|como) (el|la)? ?${AUTHORITY_ROLE}\b`),
      new RegExp(String.raw`\b(el|la|mi) ${AUTHORITY_ROLE}\b.{0,20}\b(me dijo|dijo|autoriz\w*|orden\w*|aprob\w*)\b`),
    ],
  ],
  [
    "discount_pressure",
    [
      /\b(dame|deme|da me|aplicame|apliqueme|hazme|hagame|exijo)\b.{0,30}\b(descuento|gratis|gratuit\w*|rebaja|beca|sin costo)\b/,
      /\b(regalame|regaleme|regalenme|regalanos)\b/,
      /\b(quiero|necesito|exijo)\s+(que me \w+\s+)?(el|un|una|los)?\s*(curso|cursos|inscripcion)?\s*(gratis|gratuit\w*|sin costo)\b/,
      /\b(quiero|necesito|exijo) que me (des|den|hagas|haga|dejes|dejen) .{0,20}\b(descuento|rebaja|gratis)\b/,
      /\b(descuento|rebaja) del? \d{1,3} ?(%|por ?ciento)/,
      /\b\d{2,3} ?(%|por ?ciento) de (descuento|rebaja)\b/,
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
  const categories = RULES.filter(([category, patterns]) => {
    const matched = patterns.some((p) => p.test(normalized));
    return category === "authority_claim" ? matched && PRESSURE.test(normalized) : matched;
  }).map(([category]) => category);
  return { suspected: categories.length > 0, categories };
}
