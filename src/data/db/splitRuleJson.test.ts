import type { SplitRule } from "../../domain/ledger";
import { unwrap, unwrapErr } from "../../domain/ledger/testFixtures";
import { decodeSplitRule, encodeSplitRule } from "./splitRuleJson";

describe("splitRuleJson", () => {
  it.each<SplitRule>([
    { kind: "equal", participantIds: ["a", "b"] },
    {
      kind: "exact",
      shares: [
        { memberId: "a", amountMinor: 100 },
        { memberId: "b", amountMinor: 200 },
      ],
    },
  ])("round-trips a $kind rule", (rule) => {
    expect(unwrap(decodeSplitRule(encodeSplitRule(rule)))).toEqual(rule);
  });

  it("does not store extra properties", () => {
    const rule = {
      kind: "equal",
      participantIds: ["a"],
      extra: "x",
    } as SplitRule;
    expect(JSON.parse(encodeSplitRule(rule))).toEqual({
      kind: "equal",
      participantIds: ["a"],
    });
  });

  it.each([
    ["not JSON", "{"],
    ["not an object", "[]"],
    ["unknown kind", '{"kind":"percent"}'],
    ["non-string participant", '{"kind":"equal","participantIds":[1]}'],
    ["missing participants", '{"kind":"equal"}'],
    ["share without amount", '{"kind":"exact","shares":[{"memberId":"a"}]}'],
  ])("rejects %s", (_, json) => {
    expect(unwrapErr(decodeSplitRule(json)).code).toBe("INVALID_SPLIT_JSON");
  });
});
