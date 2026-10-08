# Reference screens for the item-review form (`app/scan/detail.tsx`)

Gathered 2026-10-07, after the user said the form "is so texty, looks weird".

**These are REFERENCES, not assets.** They are screenshots of other companies'
shipped apps, collected by [Page Flows](https://pageflows.com/). Nothing here
is ours and nothing here is licensed for reuse — do not copy pixels, icons,
copy or imagery out of them. Take the *pattern*, build it with our tokens.

## Why these and not Dribbble

Dribbble serves a human-verification wall to automated browsers, and Collect UI
returned 404s on its own category URLs. Page Flows was reachable and is a
better source for this anyway: these are **real production flows**, not concept
art, so the patterns in them survived contact with real sellers.

| File | App | Screen | Why it is here |
|---|---|---|---|
| `ref-vinted-add-details.png` | Vinted | "Sell an item" | The closest thing to our screen, and the sharpest contrast |
| `ref-mercari-list-an-item.jpg` | Mercari | "Sell an item" → Details / Delivery | How to group many fields without boxing each one |
| `ref-stockx-sell.png` | StockX | Sell / Place Ask | The price section, with comps and a payout breakdown |

Sources (flow pages, each links the full set):
[Vinted](https://pageflows.com/post/ios/general-browsing/vinted/) ·
[Mercari](https://pageflows.com/post/ios/listing-a-product/mercari/) ·
[StockX](https://pageflows.com/post/ios/general-browsing/stockx/)

## What they do that we do not

Both Vinted and Mercari solve "texty" the same way, and it is not by writing
less — it is by **removing the chrome around the text**.

1. **No bordered card per field group.** Ours stacks eight white rounded
   rectangles with 1px borders. Theirs uses full-bleed white with a grey
   spacer band between groups, titled in plain sentence case ("Details",
   "Delivery"). One divider does the work our eight borders are doing.
2. **No ALL-CAPS letterspaced labels.** Ours: `TITLE *`, `DESCRIPTION *`,
   `CONDITION *`. Vinted: "Title", "Describe your item" — sentence case, grey,
   normal weight. Caps is the heaviest possible way to label a field and we
   use it on every single one.
3. **No asterisks at all.** Neither app marks required fields. They either ask
   only for what they need, or they tell you at the point of failure. Our six
   red asterisks are six pieces of permanent visual noise.
4. **Pickers are disclosure ROWS, not inline controls.** Category, Brand and
   Condition are one-line rows: label left, current value right, chevron. Our
   Condition is five wrapped chips occupying four lines; Mercari shows the
   chosen value on one line and moves the choosing to its own screen.
5. **Placeholders carry the example.** "e.g. White COS Jumper", "e.g. only worn
   a few times, true to size". We have this on Year and Brand but not where it
   matters most — the empty Description.
6. **Photo guidance lives with the photos.** Vinted: "Add up to 20 photos.
   See photo tips." and "Click and drag to rearrange" directly under the strip.
   That is the photo-coverage nudge both reviewers asked for, in two lines.
7. **StockX on price:** "Highest Bid: $254 | Lowest Ask: $266" above the input,
   then a fee breakdown to "Total Payout: $220.98". This is the comps answer to
   our removed "No price estimate" card — and note its Place Ask / Sell Now
   toggle is the same shape as our Buy now / Make offer, but with the market
   numbers sitting right above it.

## The one thing to copy first

Kill the per-card borders and the caps labels. That is a presentation change
across `IdentityCard`, `DescriptionCard`, `CategoryConditionCard`,
`PricingCard`, `SpecsCard` and `LocationCard` plus `FieldLabel` — no logic, no
new fields, no backend — and it is the single change that takes the screen from
"a form" to "a list of things about your item".
