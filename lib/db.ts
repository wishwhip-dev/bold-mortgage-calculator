/**
 * This application's database.
 *
 * The reusable half of the setup is in `lib/storage/` and is not edited. This file is the half
 * that describes the product: which tables exist, what is indexed, how the schema has changed over
 * time, and what a first visit starts with.
 */
import { defineDatabase } from "@/lib/storage/database";

export type DownPaymentMode = "dollars" | "percent";

/** The inputs that fully determine a calculation. */
export type ScenarioInputs = {
  homePrice: number;
  /** Dollars when `downPaymentMode` is "dollars", a percentage of the price when "percent". */
  downPayment: number;
  downPaymentMode: DownPaymentMode;
  annualRatePct: number;
  termYears: number;
  /** Optional extras, entered per month. Zero when the field was left blank. */
  monthlyPropertyTax: number;
  monthlyInsurance: number;
  monthlyHoa: number;
};

export type Scenario = ScenarioInputs & {
  id: string;
  name: string;
  /** Epoch millis. Indexed, because the list is ordered by it. */
  createdAt: number;
};

/** The scenario the visitor was last looking at, restored on the next load. */
export type WorkingState = {
  id: "working";
  inputs: ScenarioInputs;
  updatedAt: number;
};

/** Ids are generated here so the data layer never depends on an auto-increment round trip. */
export function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Five examples that demonstrate the range, written once on a first visit. */
const SAMPLE_SCENARIOS: Scenario[] = [
  {
    id: "sample-classic-30",
    name: "Classic 30-year",
    homePrice: 400_000,
    downPayment: 80_000,
    downPaymentMode: "dollars",
    annualRatePct: 6.5,
    termYears: 30,
    monthlyPropertyTax: 0,
    monthlyInsurance: 0,
    monthlyHoa: 0,
    createdAt: 1_700_000_000_000,
  },
  {
    id: "sample-15-year",
    name: "15-year, 5.75%",
    homePrice: 450_000,
    downPayment: 90_000,
    downPaymentMode: "dollars",
    annualRatePct: 5.75,
    termYears: 15,
    monthlyPropertyTax: 0,
    monthlyInsurance: 0,
    monthlyHoa: 0,
    createdAt: 1_700_000_001_000,
  },
  {
    id: "sample-first-buyer",
    name: "First-time buyer, low down",
    homePrice: 325_000,
    downPayment: 3.5,
    downPaymentMode: "percent",
    annualRatePct: 7.1,
    termYears: 30,
    monthlyPropertyTax: 0,
    monthlyInsurance: 0,
    monthlyHoa: 0,
    createdAt: 1_700_000_002_000,
  },
  {
    id: "sample-condo",
    name: "Condo with big HOA",
    homePrice: 280_000,
    downPayment: 56_000,
    downPaymentMode: "dollars",
    annualRatePct: 6.25,
    termYears: 30,
    monthlyPropertyTax: 240,
    monthlyInsurance: 90,
    monthlyHoa: 450,
    createdAt: 1_700_000_003_000,
  },
  {
    id: "sample-10-year",
    name: "10-year aggressive payoff",
    homePrice: 500_000,
    downPayment: 150_000,
    downPaymentMode: "dollars",
    annualRatePct: 6,
    termYears: 10,
    monthlyPropertyTax: 0,
    monthlyInsurance: 0,
    monthlyHoa: 0,
    createdAt: 1_700_000_004_000,
  },
];

export const database = defineDatabase<{
  scenarios: Scenario;
  state: WorkingState;
}>({
  name: "bold-mortgage-calculator",
  versions: [
    // Only the primary key and the properties queried on. `createdAt` orders the saved list.
    { version: 1, stores: { scenarios: "id, createdAt", state: "id" } },
  ],
  // Written once, inside `ready()`, in one transaction with its own marker. Do not hand-roll this:
  // no `meta` table, no flag, no promise to dedupe a double mount — see `docs/storage.md`.
  seed: {
    tables: ["scenarios"],
    run: async (db) => {
      await db.scenarios.bulkAdd(SAMPLE_SCENARIOS);
    },
  },
});
