// Public mascot-state interface. UI-only: no API/business logic lives here.
//
// Components call setMascotState(...) (e.g. the Scan Gmail button) and the
// MascotRig reacts to the window event. Ready for future wiring from the
// explorer's approve/scan flows without touching their handlers' logic.

export type MascotState = "idle" | "scan" | "opportunity-found" | "approved";

export const MASCOT_EVENT = "oppsync:mascot";

export function setMascotState(state: MascotState) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(MASCOT_EVENT, { detail: state }));
  }
}
