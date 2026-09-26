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
