export type MemberId = string;

/** ISO 4217 幣別代碼，例如 'TWD'、'JPY' */
export type CurrencyCode = string;

export interface Member {
  readonly id: MemberId;
}

export interface Ledger {
  readonly id: string;
  readonly baseCurrency: CurrencyCode;
  /**
   * 依加入順序排列。
   * 尾數分配與債務簡化遇到平手時，都以這個順序決定，確保結果可重現。
   */
  readonly members: readonly Member[];
}

export interface ExactShare {
  readonly memberId: MemberId;
  /** 原幣（expense.currency）的最小單位整數 */
  readonly amountMinor: number;
}

export type SplitRule =
  | { readonly kind: "equal"; readonly participantIds: readonly MemberId[] }
  | { readonly kind: "exact"; readonly shares: readonly ExactShare[] };

export interface Expense {
  readonly id: string;
  readonly payerId: MemberId;
  /** 原幣金額，以該幣別最小單位表示的正整數 */
  readonly amountMinor: number;
  readonly currency: CurrencyCode;
  /**
   * 1 單位原幣可換多少單位基準幣，用十進位字串表示以避免浮點誤差（例如 '0.2134'）。
   * 原幣與基準幣相同時必須省略。
   */
  readonly fxRateToBase?: string;
  readonly split: SplitRule;
  readonly deletedAt?: string | null;
}

export interface Settlement {
  readonly id: string;
  /** 付錢的人 */
  readonly fromId: MemberId;
  /** 收錢的人 */
  readonly toId: MemberId;
  /** 基準幣最小單位的正整數 */
  readonly amountMinor: number;
  readonly deletedAt?: string | null;
}

/** 每位成員應負擔的金額（基準幣最小單位） */
export type Shares = ReadonlyMap<MemberId, number>;

/** 每位成員的淨額（基準幣最小單位）：正數 = 別人欠他，負數 = 他欠別人 */
export type Balances = ReadonlyMap<MemberId, number>;

export interface Transfer {
  readonly fromId: MemberId;
  readonly toId: MemberId;
  readonly amountMinor: number;
}
