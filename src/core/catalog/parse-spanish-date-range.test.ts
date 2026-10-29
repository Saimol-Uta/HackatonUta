import { describe, expect, it } from "vitest";
import { parseSpanishDateRange } from "./parse-spanish-date-range";

describe("parseSpanishDateRange", () => {
  it.each([
    ["Del 01 de octubre de 2026 al 15 de octubre de 2026", "2026-10-01", "2026-10-15"],
    ["Del 19 de mayo al 04 de junio de 2025", "2025-05-19", "2025-06-04"],
    ["Del 07 al 30 de junio de 2025", "2025-06-07", "2025-06-30"],
    ["Del 31-mayo al 05-julio-2025", "2025-05-31", "2025-07-05"],
    ["5-abril a 18-mayo-2025", "2025-04-05", "2025-05-18"],
    ["Del 14 de Mayo al 03 de Junio de 2025", "2025-05-14", "2025-06-03"],
    ["Del 05 de abril al 04 de mayo del 2025", "2025-04-05", "2025-05-04"],
    ["15 de febrero al 02 de marzo de 2025", "2025-02-15", "2025-03-02"],
    ["20-marzo al 22-abril-2025", "2025-03-20", "2025-04-22"],
  ])("parses %s", (text, start, end) => {
    expect(parseSpanishDateRange(text)).toEqual({ start, end });
  });

  it("returns null when the text holds no complete range", () => {
    expect(parseSpanishDateRange("A elección del participante")).toBeNull();
    expect(parseSpanishDateRange("Del 07 al 30")).toBeNull();
  });
});
