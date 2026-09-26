"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { YearRow } from "@/lib/mortgage";
import { formatCurrency } from "./format";

/**
 * One row per loan year — 30 rows on a 30-year term — inside a fixed-height scroll, so the table
 * never stretches the page.
 */
export function YearByYearTable({ rows, termYears }: { rows: YearRow[]; termYears: number }) {
  return (
    <div className="max-h-96 overflow-y-auto rounded-lg border" tabIndex={0} aria-label={`Year-by-year loan balance, ${termYears} years`}>
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_var(--border)]">
          <TableRow>
            <TableHead className="w-16">Year</TableHead>
            <TableHead className="text-right">Principal paid</TableHead>
            <TableHead className="text-right">Interest paid</TableHead>
            <TableHead className="text-right">Balance remaining</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.year} className={row.balance <= 0 ? "bg-muted/40" : undefined}>
              <TableCell className="font-medium">{row.year}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(row.principal, true)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(row.interest, true)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(row.balance)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
