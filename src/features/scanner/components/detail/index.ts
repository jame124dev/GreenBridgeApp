// Barrel for the decomposed scan-detail card components + helpers + controller.
// Each card calls `useFormContext()` against the shared RHF form set up in the
// route via `<FormProvider>`. Behavior is 1:1 with the prior monolithic
// detail.tsx for S2.1; new field UIs (brand/model/year/grade/specs) land in S2.2.

export { CategoryConditionCard } from './CategoryConditionCard';
export { DescriptionCard } from './DescriptionCard';
export { DetailAppBar } from './DetailAppBar';
export { DetailFooter } from './DetailFooter';
export { DocumentsCard } from './DocumentsCard';
export { FieldLabel } from './FieldLabel';
export { FooterButton } from './FooterButton';
export { IdentityCard } from './IdentityCard';
export { LocationCard } from './LocationCard';
export { MarketplaceCard } from './MarketplaceCard';
export { PhotosCard } from './PhotosCard';
export { PricingCard } from './PricingCard';
export { RequiredChecklist } from './RequiredChecklist';
export { SpecsCard } from './SpecsCard';
export { VisibilityCard } from './VisibilityCard';
export { useDetailController } from './useDetailController';
export type { DetailController } from './useDetailController';
