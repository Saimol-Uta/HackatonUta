import { describe, expect, it } from "vitest";
import { conversationTurns, parseClassification, renderTranscript } from "./shared";

const SLUGS = ["curso21", "curso16"];

describe("parseClassification", () => {
  it("parses the model's JSON and keeps a known course slug", () => {
    expect(
      parseClassification(
        '{"intentState":"hot_lead","wantsHuman":false,"injectionSuspected":false,"courseSlug":"curso21"}',
        SLUGS,
      ),
    ).toEqual({ intentState: "hot_lead", wantsHuman: false, injectionSuspected: false, courseSlug: "curso21" });
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
