import { describe, expect, it } from "vitest";
import { toConversation, toConversationRow, toCourse } from "./rows";

describe("Supabase row mappers", () => {
  it("maps a course row, building the price tiers only when all three exist", () => {
    const row = {
      id: 21,
      slug: "curso21",
      name: "FUNDAMENTOS DE PYTHON 2",
      full_title: null,
      training_hours: 40,
      url: "u",
      image_url: null,
      description: null,
      objectives: null,
      location: null,
      organizers: null,
      enrollment_start: "2026-10-30",
      enrollment_end: "2026-11-15",
      start_date: "2026-11-16",
      end_date: "2026-12-16",
      schedule: null,
      modality: "Virtual",
      certificate: null,
      price_uta_student: "40.00",
      price_uta_staff: "50.00",
      price_public: "60.00",
      details_text: "Módulo 1",
    };

    expect(toCourse(row)).toMatchObject({ id: 21, prices: { utaStudent: 40, utaStaff: 50, public: 60 }, detailsText: "Módulo 1" });
    expect(toCourse({ ...row, price_public: null }).prices).toBeNull();
  });

  it("maps a conversation joined with its contact", () => {
    expect(
      toConversation({
        id: 3,
        mode: "human",
        intent_state: "hot_lead",
        needs_attention: true,
        interested_course_id: 21,
        summary: "s",
        summarized_until_message_id: "40",
        contacts: { telegram_chat_id: "555" },
      }),
    ).toEqual({
      id: 3,
      telegramChatId: 555,
      mode: "human",
      intentState: "hot_lead",
      needsAttention: true,
      interestedCourseId: 21,
      summary: "s",
      summarizedUntilMessageId: 40,
    });
  });

  it("maps only the fields present in a patch", () => {
    expect(toConversationRow({ mode: "ai", needsAttention: false })).toEqual({ mode: "ai", needs_attention: false });
    expect(toConversationRow({ summary: "x", summarizedUntilMessageId: 9 })).toEqual({
      summary: "x",
      summarized_until_message_id: 9,
    });
  });
});
