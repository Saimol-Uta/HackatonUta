import { describe, expect, it } from "vitest";
import { checkReply } from "./check-reply";

const policy = { allowedAmounts: [40, 50, 60, 120, 150, 180], allowedDiscounts: [] as number[] };

describe("checkReply", () => {
  it("accepts prices that exist in the catalog in any written form", () => {
    expect(checkReply("Para estudiantes UTA cuesta $40,00 y para público general 60 USD.", policy)).toEqual({
      ok: true,
      violations: [],
    });
    expect(checkReply("El valor es de 120 dólares.", policy).ok).toBe(true);
  });

  it("rejects an amount that is not in the catalog", () => {
    expect(checkReply("Te lo dejo en $25.", policy)).toEqual({ ok: false, violations: ["amount:25"] });
  });

  it("rejects a discount percentage that is not an active promotion", () => {
    expect(checkReply("Tienes un 30% de descuento si te inscribes hoy.", policy)).toEqual({
      ok: false,
      violations: ["discount:30"],
    });
    expect(checkReply("Aplica 15 % de descuento", { ...policy, allowedDiscounts: [15] }).ok).toBe(true);
  });

  it("ignores percentages unrelated to discounts", () => {
    expect(checkReply("El curso es 100% virtual.", policy).ok).toBe(true);
  });

  it("rejects offering a course for free but allows denying it", () => {
    expect(checkReply("¡Claro! Te lo damos gratis.", policy)).toEqual({ ok: false, violations: ["free"] });
    expect(checkReply("Lo siento, el curso no es gratuito.", policy).ok).toBe(true);
    expect(checkReply("No tenemos cursos sin costo, pero sí precios para estudiantes.", policy).ok).toBe(true);
  });

  it.each([
    "No hay drama, es gratis para ti.",
    "No te cobro nada, es gratis.",
    "Claro, no pagas: es gratuito.",
    "Ningún problema, curso gratis.",
    "Listo, ya no cuesta: es sin costo para ti.",
    "Te lo regalo.",
    "Puedes inscribirte sin pagar nada.",
  ])("flags a free offer hidden behind an unrelated negation: %s", (text) => {
    expect(checkReply(text, policy).violations).toContain("free");
  });

  it.each([
    ["El curso cuesta USD 25.", "amount:25"],
    ["Son 25$ nada más.", "amount:25"],
    ["Te aplico un 50 por ciento de descuento.", "discount:50"],
    ["Te hago la mitad de precio.", "discount:50"],
    ["Cuesta $40.000", "amount:40000"],
  ])("flags common price and discount formats: %s", (text, violation) => {
    expect(checkReply(text, policy).violations).toContain(violation);
  });

  it.each([
    "El curso no es gratis, pero hoy no hay promociones; es 100% virtual.",
    "Cuesta USD 40 para estudiantes UTA.",
    "Son 70 horas, los viernes de 19:00 a 21:00.",
    "Ningún curso es gratuito.",
  ])("accepts a correct reply: %s", (text) => {
    expect(checkReply(text, policy)).toEqual({ ok: true, violations: [] });
  });
});
