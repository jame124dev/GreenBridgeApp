import { normalizeCondition, normalizeOperationStatus } from './normalize';
import { DEFAULT_OPERATION_STATUS } from './constants';
import type { AiResult } from '@/stores/scanDraftStore';

export function mapAnalyzeResponse(data: Record<string, unknown>): AiResult {
  const price = data.price as { reselling_price?: string } | undefined;
  const currencyRaw = data.currency as string | undefined;

  const operationStatus = normalizeOperationStatus(
    data.operation_status as string | string[] | undefined,
  );

  return {
    name: String(data.name ?? ''),
    description: String(data.equipment_description ?? ''),
    condition: normalizeCondition(data.condition as string | string[] | undefined),
    operationStatus: operationStatus.length ? operationStatus : [...DEFAULT_OPERATION_STATUS],
    suggestedPrice: price?.reselling_price != null ? String(price.reselling_price) : null,
    currency: currencyRaw === 'TWD' ? 'TWD' : 'USD',
  };
}
