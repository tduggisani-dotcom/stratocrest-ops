/**
 * Parses the TEAM_EMAILS setting: "Name <email>, Name <email>, …".
 *
 * Read by `pnpm seed` (plain Node), so this file must stay self-contained:
 * no "@/…" imports and only erasable TypeScript.
 *
 * Tolerated: extra spaces, line breaks, a trailing comma, and quoted names
 * ("John LaRocco" <john@example.com>). Emails are lowercased. Every problem
 * throws an Error that names the entry, so it can be fixed in .env.local.
 */

export type TeamEmail = { name: string; email: string }

const FORMAT_HELP = "Write each person as Name <email>, separated by commas."
const MAX_EMAIL_LENGTH = 254
const MAX_NAME_LENGTH = 120

// Same shape the database accepts (people.email CHECK), minus characters that
// would mean the entry was mistyped.
const EMAIL = /^[^\s@<>,"]+@[^\s@<>,"]+\.[^\s@<>,"]+$/

// One "Name <email>" entry. The name part also swallows the comma and spaces
// left over from the previous entry; they are trimmed below.
const ENTRY = /([^<>]*)<([^<>]*)>/g

export function parseTeamEmails(value: string): TeamEmail[] {
  const people: TeamEmail[] = []
  const byEmail = new Map<string, TeamEmail>()
  const byName = new Map<string, TeamEmail>()
  let end = 0

  for (const match of value.matchAll(ENTRY)) {
    // Text the pattern skipped over (a stray "<" or ">") means a typo.
    if (match.index !== end) {
      throw new Error(`Couldn't read "${value.slice(end, match.index).trim()}". ${FORMAT_HELP}`)
    }
    const raw = match[0].replace(/^[\s,]+/, "").trim()
    const label = `Entry ${people.length + 1} ("${raw}")`
    const name = match[1]
      .replace(/^[\s,]+/, "")
      .trim()
      .replace(/^"(.*)"$/s, "$1")
      .replace(/\s+/g, " ")
      .trim()
    const email = match[2].trim().toLowerCase()

    if (/[,@"]/.test(name)) {
      throw new Error(`Couldn't read ${label}. ${FORMAT_HELP}`)
    }
    if (name === "") {
      throw new Error(`${label} has no name. ${FORMAT_HELP}`)
    }
    if (name.length > MAX_NAME_LENGTH) {
      throw new Error(`${label} has a name longer than ${MAX_NAME_LENGTH} characters.`)
    }
    if (!EMAIL.test(email) || email.length > MAX_EMAIL_LENGTH) {
      throw new Error(`${label} has an invalid email address "${match[2].trim()}".`)
    }

    const sameEmail = byEmail.get(email)
    if (sameEmail) {
      throw new Error(`${label} repeats the email ${email}, already used by ${sameEmail.name}.`)
    }
    const sameName = byName.get(name.toLowerCase())
    if (sameName) {
      throw new Error(`${label} repeats the name ${name}, already used with ${sameName.email}.`)
    }

    const person = { name, email }
    people.push(person)
    byEmail.set(email, person)
    byName.set(name.toLowerCase(), person)
    end = match.index + match[0].length
  }

  const rest = value
    .slice(end)
    .replace(/^[\s,]+/, "")
    .trim()
  if (rest !== "") {
    throw new Error(`Couldn't read "${rest}" in TEAM_EMAILS. ${FORMAT_HELP}`)
  }
  if (people.length === 0) {
    throw new Error(`TEAM_EMAILS is empty. ${FORMAT_HELP}`)
  }
  return people
}
