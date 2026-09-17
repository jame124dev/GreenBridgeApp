# Open decisions

Fifteen things waiting on a person, ordered by how much they unblock. Six are
one-word answers. Nothing here is blocked on work — each is blocked on an
answer, and I have deliberately not guessed any of them.

Re-verified against the code on 2026-09-16, so none is stale.

## Blocking a whole surface

**1 · Turn the v2 door on, or leave it shut?**
Mostly answered. Option A is **built**: a row at the bottom of the old Account
screen behind `V2_UI_ENABLED` (`EXPO_PUBLIC_V2_UI=1`, default OFF, unset
everywhere). Nothing changes for anyone until that env var is set, and setting
it needs a **Metro restart** — `EXPO_PUBLIC_*` is inlined at bundle time.

What is left for you: set the flag in a dev build and let people in, or leave it
shut. The launch route was deliberately not touched — that file carries an App
Review rejection from 2026-08-24 under Guideline 5.1.1(v), so it deserves more
care than a flag.

⚠️ Built and tested, **not yet pressed on a phone** — adb was wedging. Verify
before relying on it.

**2 · Detection mechanism for 7a: (a) or (b)?**
(a) wire `POST /recognition-jobs` so 7a starts its own run — the drawn design,
needs background recognition enabled server-side. (b) rebuild 7a around
`useSmartDetect` — less work, proven in production. Today the camera hands off
to the *shipped* processing screen, so the flow works but drops v2 chrome
mid-journey.

**3 · A go to wire the three real writes.**
Publish/save-draft, send message, profile-delete. The hooks exist and work; they
write real data, so none was touched.

**4 · Where v2 lands in git.**
Everything is uncommitted on `feat/app-store-account-deletion`, which is not a
v2 branch. Recommend its own feature branch.

## Product / content

**5 · The country picker omits every market this app is localised for.**
96 entries, missing Taiwan, China, Japan, India, Thailand, Vietnam, Indonesia
and Malaysia; Singapore is the only Asian one. Against the six shipped locales
(`en ja th vi zh-Hans zh-Hant`) every non-English locale's home country is
absent. On device: the draft's country is Taiwan and searching returns *"No
countries match 'Taiwan'"*; 7e's own **Use my location** wrote **India** from a
real GPS fix — also unselectable; and the backend *defaults* to Taiwan. So the
app writes countries it cannot then edit. Extend the list, or allow free text?
The list is a verbatim port from web, so both change together.

**6 · The `EN` badge is a control on two screens and a label on four.**
Opens the language sheet on Home and the assistant; inert text on Matches,
Messages, Account, Browse — identical in appearance on all six. Nothing is
broken (`BrandBar` renders a plain label when given no handler), but someone who
changes language from Home will tap it on Messages and get nothing. One prop,
six screens. Asserted at "exactly two" by the inventory test, so wiring the
others will fail that test and bring you back here.

**7 · 6b's banner is addressed to two different people.**
Eyebrow **FOR BUYERS** over the headline *"Skip the valuation — we price it for
you"*. Valuation is the seller flow. One of the two is wrong; I have not guessed
which.

**8 · English-only at launch: yes or no?**
~305 string sites × 6 locales. Deferring is a real choice with a growing price —
every screen finished in English adds ~20 strings to a later extraction.

## Design sign-off (Tehreem)

**9 · Ship below WCAG AA: yes or no?** If no, `inkSubtle` `#8B9A92` →
**`#65736B`**. 60 sites. The current value fails AA *and* AA-large on all three
grounds; the replacement clears everywhere (4.98 / 4.69 / 4.52) at the same hue
and saturation. Verified still unfixed on 2026-09-16.

**10 · Palette sign-off** — built as drawn (`#2E7D5B`); the brand guide says
turquoise `#35C3AA` + navy. Every screen. Cheap now, expensive after launch.

**11 · Dark-mode sign-off** — the canvas has no dark variant, so the whole dark
palette was derived. Contrast-tested, never design-reviewed.

**12 · `Bubble`: ramp or stay flat?** One component. `TintedRow`, its analogue,
ramps — but nothing forces it either way, which is why I did not decide it.

## Assets and access

**13 · The banner image** (`uploads/surplus into capital-banner image.webp` and
the buying equivalent). Both `BANNER_PHOTO` constants are still `null` and
neither asset is in the repo; the banners fall back to a flat ground.

**14 · A plain BUYER account.** The highest-value thing after the seller login,
which turned up eight bugs in an hour. The buyer half of Matches, Messages and
the bid flow has never been exercised by a real account.

**15 · One scan of a real nameplate** — point the phone at any equipment plate
and shoot. Populates 7b–7e with something other than a resumed draft.
*(Workaround: display a nameplate photo on a monitor and shoot that — the
pipeline cannot tell.)*
