import { describe, expect, test } from "vitest"
import { CSV_BOM, csvField, toCsv } from "./csv"

describe("csvField", () => {
  test("plain text and numbers as they are; empty for nothing", () => {
    expect(csvField("Example Seed Fund")).toBe("Example Seed Fund")
    expect(csvField(4)).toBe("4")
    expect(csvField(0)).toBe("0")
    expect(csvField(null)).toBe("")
    expect(csvField(undefined)).toBe("")
    expect(csvField("")).toBe("")
  })

  test("quotes fields with commas, quotes or line breaks, doubling the quotes", () => {
    expect(csvField("Columbus, OH")).toBe('"Columbus, OH"')
    expect(csvField('Said "maybe"')).toBe('"Said ""maybe"""')
    expect(csvField("Line one\nLine two")).toBe('"Line one\nLine two"')
    expect(csvField("Line one\r\nLine two")).toBe('"Line one\r\nLine two"')
  })

  test("defuses cells a spreadsheet would run as a formula", () => {
    expect(csvField('=HYPERLINK("http://evil")')).toBe('"\'=HYPERLINK(""http://evil"")"')
    expect(csvField("+1 614 555 0100")).toBe("'+1 614 555 0100")
    expect(csvField("-2+3")).toBe("'-2+3")
    expect(csvField("@SUM(A1)")).toBe("'@SUM(A1)")
    expect(csvField("\tcmd")).toBe("'\tcmd")
    expect(csvField("\rcmd")).toBe('"\'\rcmd"')
  })

  test("only the first character matters", () => {
    expect(csvField("a=b")).toBe("a=b")
    expect(csvField("Series A - seed")).toBe("Series A - seed")
  })

  test("keeps non-ASCII text", () => {
    expect(csvField("Zürich – Ünternehmen")).toBe("Zürich – Ünternehmen")
  })
})

describe("toCsv", () => {
  test("starts with the UTF-8 BOM and ends every record with CRLF", () => {
    const csv = toCsv([
      ["Company", "Rating"],
      ["Example, Inc.", 5],
      ["Other", null],
    ])
    expect(csv.startsWith(CSV_BOM)).toBe(true)
    expect(csv).toBe(`${CSV_BOM}Company,Rating\r\n"Example, Inc.",5\r\nOther,\r\n`)
  })

  test("an empty file is just the BOM", () => {
    expect(toCsv([])).toBe(CSV_BOM)
  })

  test("a quoted line break stays inside its record", () => {
    const csv = toCsv([["a\nb", "c"]])
    expect(csv.slice(1).split("\r\n")).toEqual(['"a\nb",c', ""])
  })
})
