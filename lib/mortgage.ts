/**
 * Mortgage math, kept pure so it can be reasoned about independently of React and of the
 * database. Every input is already a validated number when it gets here.
 */
import type { ScenarioInputs } from "@/lib/db";

export type MonthPoint = {
  /** 1-based payment number. */
  month: number;
  principal: number;
  interest: number;
  balance: number;
};

export type YearRow = {
  year: number;
  principal: number;
  interest: number;
  balance: number;
};

export type Amortization = {
  loanAmount: number;
  monthlyPI: number;
  monthlyExtras: number;
  monthlyTotal: number;
  months: number;
  schedule: MonthPoint[];
  years: YearRow[];
  totalInterest: number;
  totalPaid: number;
  /** Interest as a share of everything paid over the loan, in percent. */
  interestShare: number;
};

export function downPaymentInDollars(inputs: Pick<ScenarioInputs, "homePrice" | "downPayment" | "downPaymentMode">): number {
  if (inputs.downPaymentMode === "percent") {
    return clamp(inputs.homePrice * (inputs.downPayment / 100), 0, inputs.homePrice);
  }
  return inputs.downPayment;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Full amortization for the given inputs.
 *
 * Boundary cases are deliberate:
 * - a 0% rate divides the loan evenly across every month (no interest);
 * - a loan of $0 or less (down payment covering the whole price) yields a $0 payment and an
 *   empty schedule, so nothing downstream divides by zero.
 */
export function computeAmortization(inputs: ScenarioInputs): Amortization {
  const loanAmount = clamp(inputs.homePrice - downPaymentInDollars(inputs), 0, inputs.homePrice);
  const months = Math.round(inputs.termYears * 12);
  const monthlyExtras = inputs.monthlyPropertyTax + inputs.monthlyInsurance + inputs.monthlyHoa;

  if (loanAmount <= 0 || months <= 0) {
    return {
      loanAmount: 0,
      monthlyPI: 0,
      monthlyExtras,
      monthlyTotal: monthlyExtras,
      months: Math.max(months, 0),
      schedule: [],
      years: [],
      totalInterest: 0,
      totalPaid: 0,
      interestShare: 0,
    };
  }

  const rate = inputs.annualRatePct / 100 / 12;
  let monthlyPI: number;
  if (rate === 0) {
    monthlyPI = loanAmount / months;
  } else {
    const growth = Math.pow(1 + rate, months);
    monthlyPI = (loanAmount * rate) / (1 - 1 / growth);
  }

  const schedule: MonthPoint[] = [];
  const years: YearRow[] = [];
  let balance = loanAmount;
  let totalInterest = 0;
  let yearPrincipal = 0;
  let yearInterest = 0;

  for (let month = 1; month <= months; month += 1) {
    const interest = balance * rate;
    let principal = monthlyPI - interest;
    // The last payment absorbs rounding so the balance lands exactly on zero.
    if (month === months || principal > balance) principal = balance;
    balance = Math.max(balance - principal, 0);
    schedule.push({ month, principal, interest, balance });
    totalInterest += interest;
    yearPrincipal += principal;
    yearInterest += interest;
    if (month % 12 === 0 || month === months) {
      years.push({
        year: Math.ceil(month / 12),
        principal: yearPrincipal,
        interest: yearInterest,
        balance,
      });
      yearPrincipal = 0;
      yearInterest = 0;
    }
  }

  const totalPaid = loanAmount + totalInterest;
  return {
    loanAmount,
    monthlyPI,
    monthlyExtras,
    monthlyTotal: monthlyPI + monthlyExtras,
    months,
    schedule,
    years,
    totalInterest,
    totalPaid,
    interestShare: totalPaid > 0 ? (totalInterest / totalPaid) * 100 : 0,
  };
}
