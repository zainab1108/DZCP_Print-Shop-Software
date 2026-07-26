import { describe, expect, it } from "vitest";

import {
  BOARD_COLUMNS,
  canTransition,
  isTerminal,
  nextStatus,
  PIPELINE,
  prevStatus,
} from "./production";

describe("pipeline structure", () => {
  it("board columns are the pipeline plus ON_HOLD at the end", () => {
    expect(BOARD_COLUMNS).toEqual([...PIPELINE, "ON_HOLD"]);
    expect(PIPELINE).not.toContain("ON_HOLD");
  });

  it("starts at QUEUED and ends at SHIPPED", () => {
    expect(PIPELINE[0]).toBe("QUEUED");
    expect(PIPELINE[PIPELINE.length - 1]).toBe("SHIPPED");
  });
});

describe("nextStatus / prevStatus", () => {
  it("advances through the pipeline", () => {
    expect(nextStatus("QUEUED")).toBe("ARTWORK");
    expect(nextStatus("QC")).toBe("READY");
  });

  it("returns null past the ends", () => {
    expect(nextStatus("SHIPPED")).toBeNull();
    expect(prevStatus("QUEUED")).toBeNull();
  });

  it("steps back through the pipeline", () => {
    expect(prevStatus("ARTWORK")).toBe("QUEUED");
    expect(prevStatus("SHIPPED")).toBe("READY");
  });

  it("has no next/prev for the off-pipeline ON_HOLD", () => {
    expect(nextStatus("ON_HOLD")).toBeNull();
    expect(prevStatus("ON_HOLD")).toBeNull();
  });
});

describe("isTerminal", () => {
  it("only SHIPPED is terminal", () => {
    expect(isTerminal("SHIPPED")).toBe(true);
    expect(isTerminal("ON_HOLD")).toBe(false);
    expect(isTerminal("READY")).toBe(false);
  });
});

describe("canTransition", () => {
  it("allows single steps forward and back", () => {
    expect(canTransition("PRINTING", "CURING")).toBe(true);
    expect(canTransition("PRINTING", "PREPRESS")).toBe(true);
  });

  it("rejects no-op and multi-step jumps", () => {
    expect(canTransition("QUEUED", "QUEUED")).toBe(false);
    expect(canTransition("QUEUED", "PRINTING")).toBe(false);
    expect(canTransition("ARTWORK", "SHIPPED")).toBe(false);
  });

  it("lets any active stage go on hold, but not on-hold to on-hold", () => {
    expect(canTransition("QUEUED", "ON_HOLD")).toBe(true);
    expect(canTransition("QC", "ON_HOLD")).toBe(true);
    expect(canTransition("ON_HOLD", "ON_HOLD")).toBe(false);
  });

  it("lets on-hold return to any pipeline stage", () => {
    expect(canTransition("ON_HOLD", "QUEUED")).toBe(true);
    expect(canTransition("ON_HOLD", "PRINTING")).toBe(true);
    expect(canTransition("ON_HOLD", "SHIPPED")).toBe(true);
  });
});
