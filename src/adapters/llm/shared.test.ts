import { describe, expect, it } from "vitest";
import { classifierInput, conversationTurns, parseClassification, renderTranscript } from "./shared";

const SLUGS = ["curso21", "curso16"];

describe("parseClassification", () => {
  it("parses the model's JSON and keeps a known course slug", () => {
    expect(
      parseClassification(
        '{"intentState":"hot_lead","wantsHuman":false,"injectionSuspected":false,"courseSlug":"curso21"}',
        SLUGS,
      ),
    ).toEqual({ intentState: "hot_lead", wantsHuman: false, injectionSuspected: false, courseSlug: "curso21", contact: { fullName: null, email: null, phone: null } });
  });

  it("parses the enrollment data the prospect gave", () => {
    const raw =
      '{"intentState":"hot_lead","wantsHuman":false,"injectionSuspected":false,"courseSlug":null,"contact":{"fullName":"Ana Pérez","email":"ana@gmail.com","phone":null}}';
    expect(parseClassification(raw, SLUGS).contact).toEqual({ fullName: "Ana Pérez", email: "ana@gmail.com", phone: null });
  });

  it("drops a course slug that is not in the catalog", () => {
    expect(
      parseClassification(
        '{"intentState":"interested","wantsHuman":false,"injectionSuspected":false,"courseSlug":"curso999"}',
        SLUGS,
      ).courseSlug,
    ).toBeNull();
  });

  it("throws on malformed output so the caller can fall back to another provider", () => {
    expect(() => parseClassification("not json", SLUGS)).toThrow();
    expect(() => parseClassification('{"intentState":"angry"}', SLUGS)).toThrow();
  });
});

describe("conversationTurns", () => {
  it("drops leading assistant turns: both providers require the conversation to start with the user", () => {
    expect(
      conversationTurns([
        { role: "assistant", content: "a" },
        { role: "user", content: "u" },
        { role: "assistant", content: "b" },
        { role: "user", content: "v" },
      ]),
    ).toEqual([
      { role: "user", content: "u" },
      { role: "assistant", content: "b" },
      { role: "user", content: "v" },
    ]);
  });

  it("drops trailing assistant turns: a concurrent reply must not become an assistant prefill", () => {
    expect(
      conversationTurns([
        { role: "user", content: "u" },
        { role: "user", content: "v" },
        { role: "assistant", content: "respuesta a u" },
      ]),
    ).toEqual([
      { role: "user", content: "u" },
      { role: "user", content: "v" },
    ]);
  });

  it("throws when nothing is left to answer", () => {
    expect(() => conversationTurns([{ role: "assistant", content: "a" }])).toThrow("no user turn");
  });
});

describe("renderTranscript", () => {
  it("labels each side for the classifier and summarizer", () => {
    expect(
      renderTranscript([
        { role: "user", content: "<user_message>hola</user_message>" },
        { role: "assistant", content: "¡Hola!" },
      ]),
    ).toBe("PROSPECT: <user_message>hola</user_message>\nADVISOR: ¡Hola!");
  });
});

describe("classifierInput", () => {
  it("lists each course with its name and real state so editions are not confused", () => {
    const input = classifierInput([{ role: "user", content: "<user_message>Python 2</user_message>" }], [
      { slug: "curso2", name: "Fundamentos de Python 2", state: "finalizado" },
      { slug: "curso21", name: "FUNDAMENTOS DE PYTHON 2", state: "inscripciones abren el 2026-10-30" },
    ]);

    expect(input).toContain("- curso2: Fundamentos de Python 2 (finalizado)");
    expect(input).toContain("- curso21: FUNDAMENTOS DE PYTHON 2 (inscripciones abren el 2026-10-30)");
  });
});
