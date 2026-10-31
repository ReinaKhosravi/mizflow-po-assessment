import { expect, it } from "vitest";
import { resolvePanelRole } from "./panel";
it("only owners may choose another panel; forged preferences cannot elevate staff", () => {
  expect(resolvePanelRole("owner", "waiter")).toBe("waiter");
  expect(resolvePanelRole("owner", "kitchen")).toBe("kitchen");
  expect(resolvePanelRole("owner", "unknown")).toBe("owner");
  expect(resolvePanelRole("waiter", "owner")).toBe("waiter");
  expect(resolvePanelRole("kitchen", "owner")).toBe("kitchen");
});
