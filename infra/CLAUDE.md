# Infra conventions

## Writing style

Sentence case everywhere — chat replies, doc prose, button labels, headings,
status messages, badges, toast text, error strings.

**Standalone words are ALWAYS capitalized.** Single-word headings, single-word
button labels, single-word badges, single-word card titles — capitalize the
word. No exceptions.

Inside a multi-word sentence, only the first letter is capitalized; the rest
stay lowercase unless the term is a proper noun or canonically lowercase
(`cico-api`, `cloudflared`, `pnpm`, `shadcn/ui`, env-var keys, file paths,
code identifiers).

Examples
- "Even" / "Surplus" / "Deficit" — single words, capitalized
- "Today" / "Body" / "Trends" — section titles, capitalized
- "Add public hostname" — sentence case
- "No daily total" — first letter capitalized even when the underlying
  value comes from a snake_case enum like `no_daily_total`
- "Restart `cico-api` after the env change" — first letter capitalized,
  code identifier stays lowercase
- "Run `pnpm install`" — first letter capitalized, `pnpm` stays lowercase

When rendering values that come from a snake_case server enum, transform to
sentence case at the boundary: replace underscores with spaces and uppercase
the first character.
