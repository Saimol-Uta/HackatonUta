import { describe, expect, it } from "vitest";
import { validEnrollmentDetails } from "./enrollment-details";

describe("validEnrollmentDetails", () => {
  it("normalizes complete details", () => {
    expect(validEnrollmentDetails({ fullName: " Ana  Pérez ", email: "Ana@UTA.edu.ec ", phone: "099 123 4567" })).toEqual({
      fullName: "Ana Pérez",
      email: "ana@uta.edu.ec",
      phone: "0991234567",
    });
    expect(validEnrollmentDetails({ fullName: "Ana Pérez", email: "ana@gmail.com", phone: "+593 99 123 4567" })?.phone).toBe("+593991234567");
  });

  it("waits while any field is missing or implausible", () => {
    const ok = { fullName: "Ana Pérez", email: "ana@gmail.com", phone: "0991234567" };
    expect(validEnrollmentDetails({ ...ok, fullName: null })).toBeNull();
    expect(validEnrollmentDetails({ ...ok, fullName: "Ana" })).toBeNull();
    expect(validEnrollmentDetails({ ...ok, email: "ana@gmail" })).toBeNull();
    expect(validEnrollmentDetails({ ...ok, phone: "12345" })).toBeNull();
    expect(validEnrollmentDetails({ ...ok, phone: null })).toBeNull();
  });
});
