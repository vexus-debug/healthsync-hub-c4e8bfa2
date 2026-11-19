import { describe, it, expect } from "vitest";
import { normalizeNgPhone, buildResultSms } from "./sms.functions";

describe("sms", () => {
  it("normalizes Nigerian numbers", () => {
    expect(normalizeNgPhone("09027788925")).toBe("2349027788925");
    expect(normalizeNgPhone("+234 902 778 8925")).toBe("2349027788925");
    expect(normalizeNgPhone("123")).toBeNull();
  });
  it("links to greenlabs results page with serial", () => {
    expect(buildResultSms("Ada Obi", "GL-001")).toContain("https://greenlabs.com.ng/results?serial=GL-001");
  });
});
