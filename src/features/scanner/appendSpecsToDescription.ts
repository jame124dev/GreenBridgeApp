// Port of GreenBridgeSeller/src/pages/new-submission-upload/utils/mapAiToForm.ts:101-114.
//
// The backend's product schema doesn't take brand / model / year / weight /
// dimensions / co2 as separate fields — they're folded into the `product_content`
// (description) body with a `---` separator. Web does this at submit time;
// mobile does the same so listings created from either platform read identically.
//
// Behavior contract (matches web 1:1):
//   - If no spec fields are populated, return description unchanged.
//   - If the description is empty, return only the spec block.
//   - Otherwise return `<description trimmed>\n\n---\n<spec block>`.
//   - Spec lines are emitted in fixed order: Brand, Model, Year, Weight,
//     Dimensions, CO2. Lines with empty/whitespace values are dropped.

export interface SpecSource {
  description: string;
  brand?: string;
  model?: string;
  year?: string;
  weight?: string;
  dimensions?: string;
  co2Emissions?: string;
}

export function appendSpecsToDescription(form: SpecSource): string {
  const lines: string[] = [];
  if (form.brand?.trim()) lines.push(`Brand: ${form.brand.trim()}`);
  if (form.model?.trim()) lines.push(`Model: ${form.model.trim()}`);
  if (form.year?.trim()) lines.push(`Year: ${form.year.trim()}`);
  if (form.weight?.trim()) lines.push(`Weight: ${form.weight.trim()}`);
  if (form.dimensions?.trim()) lines.push(`Dimensions: ${form.dimensions.trim()}`);
  if (form.co2Emissions?.trim()) lines.push(`CO2: ${form.co2Emissions.trim()}`);

  if (lines.length === 0) return form.description;
  const block = lines.join('\n');
  if (!form.description.trim()) return block;
  return `${form.description.trim()}\n\n---\n${block}`;
}
