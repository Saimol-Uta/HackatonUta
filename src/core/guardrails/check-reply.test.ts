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
});
