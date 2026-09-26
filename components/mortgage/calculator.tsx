"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { database, type DownPaymentMode, type Scenario, type ScenarioInputs } from "@/lib/db";
import { addScenario, deleteScenario, getWorkingState, saveWorkingState } from "@/lib/data/scenarios";
import { computeAmortization, type Amortization } from "@/lib/mortgage";
import { useStoredQuery, useStorageStatus } from "@/lib/storage/react";
import { AmortizationChart } from "./chart";
import { formatCurrency, groupDigits, parseAmount, sanitizeMoney, sanitizePercent } from "./format";
import { YearByYearTable } from "./year-table";

type FormState = {
  homePrice: string;
  downPayment: string;
  downPaymentMode: DownPaymentMode;
  rate: string;
  termYears: number;
  propertyTax: string;
  insurance: string;
  hoa: string;
};

const DEFAULT_FORM: FormState = {
  homePrice: "400000",
  downPayment: "80000",
  downPaymentMode: "dollars",
  rate: "6.5",
  termYears: 30,
  propertyTax: "",
  insurance: "",
  hoa: "",
};

const PRICE_MIN = 10_000;
const PRICE_MAX = 5_000_000;
const RATE_MAX = 15;

type FieldErrors = {
  homePrice?: string;
  downPayment?: string;
  rate?: string;
  propertyTax?: string;
  insurance?: string;
  hoa?: string;
};

/** Turns the typed strings into validated numbers, or per-field messages when something is off. */
function validate(form: FormState): { errors: FieldErrors; inputs: ScenarioInputs | null } {
  const errors: FieldErrors = {};

  const homePrice = parseAmount(form.homePrice);
  const priceOk = homePrice !== undefined && homePrice >= PRICE_MIN && homePrice <= PRICE_MAX;
  if (homePrice === undefined || !priceOk) {
    errors.homePrice = `Enter a home price between ${formatCurrency(PRICE_MIN)} and ${formatCurrency(PRICE_MAX)}.`;
  }

  const downPayment = parseAmount(form.downPayment);
  if (downPayment === undefined || downPayment < 0) {
    errors.downPayment =
      form.downPaymentMode === "percent"
        ? "Enter a down payment between 0% and 100% of the home price."
        : `Enter a down payment between ${formatCurrency(0)} and the home price.`;
  } else if (form.downPaymentMode === "percent" && downPayment > 100) {
    errors.downPayment = "A down payment can be at most 100% of the home price.";
  } else if (priceOk && form.downPaymentMode === "dollars" && downPayment > homePrice) {
    errors.downPayment = "The down payment can't be more than the home price.";
  }

  const rate = parseAmount(form.rate);
  if (rate === undefined || rate < 0 || rate > RATE_MAX) {
    errors.rate = `Enter an interest rate between 0% and ${RATE_MAX}%.`;
  }

  const monthlyPropertyTax = parseAmount(form.propertyTax);
  if (monthlyPropertyTax !== undefined && monthlyPropertyTax < 0) {
    errors.propertyTax = "Enter $0 or more.";
  }
  const monthlyInsurance = parseAmount(form.insurance);
  if (monthlyInsurance !== undefined && monthlyInsurance < 0) {
    errors.insurance = "Enter $0 or more.";
  }
  const monthlyHoa = parseAmount(form.hoa);
  if (monthlyHoa !== undefined && monthlyHoa < 0) {
    errors.hoa = "Enter $0 or more.";
  }

  const clean = Object.keys(errors).length === 0;
  if (!clean || homePrice === undefined || downPayment === undefined || rate === undefined) {
    return { errors, inputs: null };
  }

  return {
    errors,
    inputs: {
      homePrice,
      downPayment,
      downPaymentMode: form.downPaymentMode,
      annualRatePct: rate,
      termYears: form.termYears,
      monthlyPropertyTax: monthlyPropertyTax ?? 0,
      monthlyInsurance: monthlyInsurance ?? 0,
      monthlyHoa: monthlyHoa ?? 0,
    },
  };
}

function scenarioToForm(inputs: ScenarioInputs): FormState {
  return {
    homePrice: sanitizeMoney(String(inputs.homePrice)),
    downPayment: sanitizeMoney(String(inputs.downPayment)),
    downPaymentMode: inputs.downPaymentMode,
    rate: sanitizePercent(String(inputs.annualRatePct)),
    termYears: inputs.termYears,
    propertyTax: inputs.monthlyPropertyTax === 0 ? "" : sanitizeMoney(String(inputs.monthlyPropertyTax)),
    insurance: inputs.monthlyInsurance === 0 ? "" : sanitizeMoney(String(inputs.monthlyInsurance)),
    hoa: inputs.monthlyHoa === 0 ? "" : sanitizeMoney(String(inputs.monthlyHoa)),
  };
}

function defaultScenarioName(inputs: ScenarioInputs): string {
  const price = formatCurrency(inputs.homePrice);
  const dp =
    inputs.downPaymentMode === "percent"
      ? `${inputs.downPayment}% down`
      : `${formatCurrency(inputs.downPayment)} down`;
  return `${price}, ${dp}, ${inputs.annualRatePct}%, ${inputs.termYears} years`;
}

type TextFieldProps = {
  id: string;
  label: React.ReactNode;
  aside?: React.ReactNode;
  value: string;
  onValueChange: (value: string) => void;
  error?: string;
  prefix?: string;
  suffix?: string;
  placeholder?: string;
  hint?: string;
};

/** A text input that shows money with a $ and comma grouping, or a plain percentage. */
function TextField({ id, label, aside, value, onValueChange, error, prefix, suffix, placeholder, hint }: TextFieldProps) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {aside}
      </div>
      <div className="relative">
        {prefix && (
          <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            {prefix}
          </span>
        )}
        <Input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          placeholder={placeholder}
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          className={prefix ? "pl-7" : undefined}
        />
        {suffix && (
          <span aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
      {hint && !error && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/** Money field: display value carries the $ and commas, stored value stays raw. */
function MoneyField(props: Omit<TextFieldProps, "prefix" | "suffix" | "value" | "onValueChange"> & {
  value: string;
  onValueChange: (value: string) => void;
}) {
  const display = props.value === "" ? "" : `$${groupDigits(props.value)}`;
  return (
    <TextField
      {...props}
      value={display}
      onValueChange={(next) => props.onValueChange(sanitizeMoney(next))}
    />
  );
}

/** Segmented dollars/percent switch. The arrow keys flip it, per the keyboard contract. */
function DownPaymentModeToggle({ mode, onModeChange }: { mode: DownPaymentMode; onModeChange: (mode: DownPaymentMode) => void }) {
  const flip = () => onModeChange(mode === "dollars" ? "percent" : "dollars");
  return (
    <div
      role="radiogroup"
      aria-label="Enter the down payment as dollars or percent"
      onKeyDown={(event) => {
        if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
          event.preventDefault();
          flip();
        }
      }}
      className="inline-flex rounded-lg border p-0.5"
    >
      {(["dollars", "percent"] as const).map((option) => {
        const selected = mode === option;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onModeChange(option)}
            className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
              selected ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {option === "dollars" ? "$ Dollars" : "% Percent"}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The whole product: a form whose every keystroke recomputes the payment, the amortization
 * picture underneath it, and the saved scenarios that live in the browser database.
 */
export function MortgageCalculator() {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [restored, setRestored] = useState(false);

  const status = useStorageStatus(database);
  const scenariosQuery = useStoredQuery(database, listScenarios);
  const scenarios = scenariosQuery.data ?? [];

  // Restore what the visitor was last looking at, once, after the database opens.
  useEffect(() => {
    let cancelled = false;
    void getWorkingState()
      .then((state) => {
        if (cancelled) return;
        if (state) setForm(scenarioToForm(state.inputs));
        setRestored(true);
      })
      .catch(() => {
        if (!cancelled) setRestored(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep the working scenario saved as it changes — but only valid states, so a reload can
  // never bring back a half-typed, broken form.
  useEffect(() => {
    if (!restored) return;
    const timer = setTimeout(() => {
      const { inputs } = validate(form);
      if (inputs) void saveWorkingState(inputs).catch(() => {});
    }, 400);
    return () => clearTimeout(timer);
  }, [form, restored]);

  const { errors, inputs } = useMemo(() => validate(form), [form]);
  const valid = inputs !== null;
  const result: Amortization | null = useMemo(
    () => (inputs ? computeAmortization(inputs) : null),
    [inputs],
  );

  const update = (patch: Partial<FormState>) => {
    setForm((current) => ({ ...current, ...patch }));
    setActiveScenarioId(null);
  };

  const setDownPaymentMode = (mode: DownPaymentMode) => {
    if (mode === form.downPaymentMode) return;
    const price = parseAmount(form.homePrice);
    const downPayment = parseAmount(form.downPayment);
    if (price !== undefined && price > 0 && downPayment !== undefined) {
      const converted =
        mode === "percent" ? (downPayment / price) * 100 : price * (downPayment / 100);
      const value =
        mode === "percent"
          ? sanitizePercent(converted.toFixed(3).replace(/\.?0+$/, ""))
          : sanitizeMoney(String(Math.round(converted)));
      update({ downPaymentMode: mode, downPayment: value });
      return;
    }
    update({ downPaymentMode: mode });
  };

  const loadScenario = (scenario: Scenario) => {
    setForm(scenarioToForm(scenario));
    setActiveScenarioId(scenario.id);
  };

  const handleDelete = async (id: string) => {
    await deleteScenario(id);
    setActiveScenarioId((current) => (current === id ? null : current));
  };

  const handleSave = async () => {
    if (!inputs) return;
    const saved = await addScenario(saveName.trim() || defaultScenarioName(inputs), inputs);
    setActiveScenarioId(saved.id);
    setSaveOpen(false);
    setSaveName("");
  };

  const firstError = Object.values(errors).find(Boolean);

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6 lg:pt-12">
      {status === "memory" && (
        <Alert className="mb-6">
          <AlertDescription>
            This browser is not keeping data between visits. Everything works, but saved scenarios will
            not survive closing the tab.
          </AlertDescription>
        </Alert>
      )}

      <header className="mb-8">
        <p className="text-sm font-black uppercase tracking-widest text-primary">Bold Mortgage Calculator</p>
        <h1 className="mt-1 max-w-2xl text-3xl font-black tracking-tight sm:text-4xl">
          What will a home really cost you each month?
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Type your numbers and watch the whole picture update instantly — payment, interest, the
          year-by-year story. Everything stays in your browser.
        </p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Your numbers</CardTitle>
              <CardDescription>Results update as you type — no calculate button.</CardDescription>
            </CardHeader>
            <CardContent>
              <form noValidate onSubmit={(event) => event.preventDefault()} className="space-y-5">
                <MoneyField
                  id="home-price"
                  label="Home price"
                  value={form.homePrice}
                  onValueChange={(value) => update({ homePrice: value })}
                  error={errors.homePrice}
                  placeholder="400,000"
                />
                <MoneyField
                  id="down-payment"
                  label="Down payment"
                  aside={<DownPaymentModeToggle mode={form.downPaymentMode} onModeChange={setDownPaymentMode} />}
                  value={form.downPayment}
                  onValueChange={(value) => update({ downPayment: value })}
                  error={errors.downPayment}
                  placeholder={form.downPaymentMode === "dollars" ? "80,000" : "20"}
                  hint={
                    form.downPaymentMode === "dollars"
                      ? "Dollars you put down up front."
                      : "Percentage of the home price."
                  }
                />
                <TextField
                  id="interest-rate"
                  label="Interest rate"
                  value={form.rate}
                  onValueChange={(value) => update({ rate: sanitizePercent(value) })}
                  error={errors.rate}
                  suffix="%"
                  placeholder="6.5"
                />
                <div className="space-y-1.5">
                  <Label htmlFor="loan-term">Loan term</Label>
                  <Select value={String(form.termYears)} onValueChange={(value) => update({ termYears: Number(value) })}>
                    <SelectTrigger id="loan-term" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[10, 15, 20, 30].map((years) => (
                        <SelectItem key={years} value={String(years)}>
                          {years} years
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <fieldset className="space-y-3 rounded-lg border p-4">
                  <legend className="px-1 text-sm font-semibold text-muted-foreground">Monthly costs (optional)</legend>
                  <MoneyField
                    id="property-tax"
                    label="Property tax"
                    value={form.propertyTax}
                    onValueChange={(value) => update({ propertyTax: value })}
                    error={errors.propertyTax}
                    suffix="/ mo"
                    placeholder="0"
                  />
                  <MoneyField
                    id="insurance"
                    label="Insurance"
                    value={form.insurance}
                    onValueChange={(value) => update({ insurance: value })}
                    error={errors.insurance}
                    suffix="/ mo"
                    placeholder="0"
                  />
                  <MoneyField
                    id="hoa"
                    label="HOA"
                    value={form.hoa}
                    onValueChange={(value) => update({ hoa: value })}
                    error={errors.hoa}
                    suffix="/ mo"
                    placeholder="0"
                  />
                </fieldset>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => setForm(DEFAULT_FORM)}>
                    Reset
                  </Button>
                  <Button type="button" onClick={() => setSaveOpen(true)} disabled={!valid}>
                    Save scenario
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <SavedScenarios
            scenarios={scenarios}
            isLoading={scenariosQuery.isLoading}
            activeId={activeScenarioId}
            onLoad={loadScenario}
            onDelete={handleDelete}
          />
        </div>

        <div className="space-y-6">
          <section aria-live="polite" className="rounded-2xl border bg-card px-6 py-6 shadow-sm">
            {valid && result && inputs ? (
              <>
                <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                  Estimated monthly payment
                </p>
                <p className="mt-1 text-5xl font-black tabular-nums tracking-tight sm:text-7xl">
                  {formatCurrency(result.monthlyTotal, true)}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {formatCurrency(result.loanAmount)} loan · {inputs.termYears} years at {inputs.annualRatePct}% ·{" "}
                  {formatCurrency(inputs.homePrice - result.loanAmount)} down
                </p>
                <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Readout label="Principal & interest" value={formatCurrency(result.monthlyPI, true)} highlight />
                  <Readout label="Property tax" value={formatCurrency(inputs.monthlyPropertyTax, true)} />
                  <Readout label="Insurance" value={formatCurrency(inputs.monthlyInsurance, true)} />
                  <Readout label="HOA" value={formatCurrency(inputs.monthlyHoa, true)} />
                </dl>
              </>
            ) : (
              <div className="py-8 text-center">
                <p className="text-3xl font-bold text-muted-foreground">Your payment shows up here</p>
                <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                  {firstError
                    ? `Almost there — ${firstError}`
                    : "Start typing your numbers on the left and your estimated monthly payment appears instantly."}
                </p>
              </div>
            )}
          </section>

          {valid && result ? (
            <div className="grid grid-cols-1 gap-4 rounded-2xl border bg-muted/40 px-6 py-4 sm:grid-cols-3">
              <Stat label="Total interest over the loan" value={formatCurrency(result.totalInterest)} />
              <Stat label="Total of all payments" value={formatCurrency(result.totalPaid)} />
              <Stat
                label="Principal vs interest"
                value={`${(100 - result.interestShare).toFixed(0)}% principal · ${result.interestShare.toFixed(0)}% interest`}
              />
            </div>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Principal vs interest, month by month</CardTitle>
              <CardDescription>
                How each month&apos;s payment splits as the loan ages. Hover — or focus the chart and
                use the arrow keys — to read out an exact month.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {valid && result ? (
                result.schedule.length > 0 ? (
                  <AmortizationChart
                    schedule={result.schedule}
                    monthlyPI={result.monthlyPI}
                    termYears={inputs.termYears}
                  />
                ) : (
                  <EmptyNote
                    title="No loan to chart"
                    body="Your down payment covers the whole price, so there is nothing to amortize. Enter a smaller down payment to see the schedule."
                  />
                )
              ) : (
                <EmptyNote
                  title="Waiting on valid numbers"
                  body="Fix the highlighted fields and the full amortization picture appears here."
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Year by year</CardTitle>
              <CardDescription>
                What you pay and what you still owe at the end of every loan year.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {valid && result ? (
                result.years.length > 0 ? (
                  <YearByYearTable rows={result.years} termYears={inputs.termYears} />
                ) : (
                  <EmptyNote
                    title="No loan to break down"
                    body="With the full price paid up front there are no yearly payments to list."
                  />
                )
              ) : (
                <EmptyNote
                  title="Waiting on valid numbers"
                  body="Fix the highlighted fields and the year-by-year table appears here."
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void handleSave();
            }}
          >
            <DialogHeader>
              <DialogTitle>Save scenario</DialogTitle>
              <DialogDescription>
                The current numbers are saved in this browser. Name them so you can spot them later.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5 py-2">
              <Label htmlFor="scenario-name">Name</Label>
              <Input
                id="scenario-name"
                value={saveName}
                onChange={(event) => setSaveName(event.target.value)}
                placeholder={inputs ? defaultScenarioName(inputs) : ""}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSaveOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!valid}>
                Save scenario
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function SavedScenarios({
  scenarios,
  isLoading,
  activeId,
  onLoad,
  onDelete,
}: {
  scenarios: Scenario[];
  isLoading: boolean;
  activeId: string | null;
  onLoad: (scenario: Scenario) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Saved scenarios</CardTitle>
        <CardDescription>Click one to load its numbers back into the calculator.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : scenarios.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing saved yet — set up some numbers and press “Save scenario”.
          </p>
        ) : (
          <ul className="space-y-2">
            {scenarios.map((scenario) => {
              const active = scenario.id === activeId;
              const payment = computeAmortization(scenario).monthlyTotal;
              return (
                <li
                  key={scenario.id}
                  className={`flex items-stretch justify-between gap-2 rounded-xl border p-1 transition-shadow ${
                    active ? "border-primary ring-2 ring-primary bg-accent/50" : ""
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onLoad(scenario)}
                    aria-current={active ? "true" : undefined}
                    className="flex-1 rounded-lg px-3 py-2 text-left"
                  >
                    <span className="flex items-center gap-2 font-semibold">
                      {scenario.name}
                      {active && <span className="text-xs font-medium text-primary">viewing</span>}
                    </span>
                    <span className="mt-0.5 block text-sm text-muted-foreground tabular-nums">
                      {formatCurrency(scenario.homePrice)} · {scenario.annualRatePct}% ·{" "}
                      {scenario.termYears} yr · {formatCurrency(payment, true)}/mo
                    </span>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="my-1 mr-1 text-destructive hover:text-destructive"
                    onClick={() => onDelete(scenario.id)}
                  >
                    Delete
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function Readout({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg px-3 py-2 ${highlight ? "bg-primary text-primary-foreground" : "bg-muted/60"}`}>
      <dt className="text-xs font-medium opacity-80">{label}</dt>
      <dd className="text-base font-bold tabular-nums">{value}</dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function EmptyNote({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-dashed px-6 py-10 text-center">
      <p className="font-semibold text-muted-foreground">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

