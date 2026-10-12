/**
 * CSV for spreadsheets (RFC 4180): fields with a comma, quote or line break
 * are quoted, quotes are doubled, and every record ends with CRLF. The file
 * starts with a UTF-8 byte-order mark so Excel reads accents and dashes.
 *
 * Formula injection: a cell starting with = + - @, a tab or a carriage return
 * could run as a formula when the file is opened, so it gets a leading `'`
 * (OWASP's advice). The bot and teammates can type anything into a name.
 */

export type CsvCell = string | number | null | undefined

/** Excel reads this byte-order mark as "this file is UTF-8". */
export const CSV_BOM = "﻿"

const FORMULA_START = /^[=+\-@\t\r]/
const NEEDS_QUOTES = /[",\r\n]/

/** One field, escaped. Empty for null or undefined. */
export function csvField(value: CsvCell): string {
  if (value === null || value === undefined) return ""
  let text = typeof value === "number" ? String(value) : value
  // Numbers are written by us, never typed in, so only text can carry a formula.
  if (typeof value === "string" && FORMULA_START.test(text)) text = `'${text}`
  return NEEDS_QUOTES.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** A whole file: the BOM, then each row as one CRLF-terminated record. */
export function toCsv(rows: readonly (readonly CsvCell[])[]): string {
  return CSV_BOM + rows.map((row) => `${row.map(csvField).join(",")}\r\n`).join("")
}
