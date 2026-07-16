// Barrel for the (lab) chat surface (thread screen + card renderer).
export { ChatMessage, type ChatMessageProps } from './ChatMessage';
export { ThinkingDots } from './ThinkingDots';
export { renderCard, LabProductCard } from './cards';
export { useStreamReveal } from './hooks/useStreamReveal';
export { newMsgId } from './types';
// A2 §12 domain model (PR-6). Legacy `AiMsg` is retired in PR-11.
export {
  type Message,
  type ContentPart,
  type CompletionReason,
  messageText,
  isErrorMessage,
} from './types/message';
