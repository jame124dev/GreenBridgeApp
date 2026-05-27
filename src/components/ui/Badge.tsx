import { View } from 'react-native';
import { Text } from './Text';

export type BadgeVariant =
  | 'live'
  | 'pending'
  | 'sold'
  | 'review'
  | 'inspect'
  | 'inactive'
  | 'submitted'
  | 'ai'
  | 'neutral'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info';

export type BadgeSize = 'sm' | 'md';

type Props = {
  variant: BadgeVariant;
  label: string;
  size?: BadgeSize;
  dot?: boolean;
  leftIcon?: React.ReactNode;
  className?: string;
};

const variantClasses: Record<BadgeVariant, { container: string; dot: string; tone: 'primary' | 'secondary' | 'brand' | 'danger' }> = {
  live:      { container: 'bg-green-50 border border-green-200',   dot: 'bg-success',   tone: 'brand' },
  success:   { container: 'bg-green-50 border border-green-200',   dot: 'bg-success',   tone: 'brand' },
  sold:      { container: 'bg-green-50 border border-green-300',   dot: 'bg-success',   tone: 'brand' },
  pending:   { container: 'bg-amber-50 border border-amber-200',   dot: 'bg-warning',   tone: 'secondary' },
  warning:   { container: 'bg-amber-50 border border-amber-200',   dot: 'bg-warning',   tone: 'secondary' },
  review:    { container: 'bg-amber-50 border border-amber-200',   dot: 'bg-warning',   tone: 'secondary' },
  ai:        { container: 'bg-amber-50 border border-amber-200',   dot: 'bg-warning',   tone: 'secondary' },
  inspect:   { container: 'bg-blue-50 border border-blue-200',     dot: 'bg-info',      tone: 'secondary' },
  submitted: { container: 'bg-blue-50 border border-blue-200',     dot: 'bg-info',      tone: 'secondary' },
  info:      { container: 'bg-blue-50 border border-blue-200',     dot: 'bg-info',      tone: 'secondary' },
  danger:    { container: 'bg-red-50 border border-red-200',       dot: 'bg-danger',    tone: 'danger' },
  inactive:  { container: 'bg-neutral-100 border border-neutral-200', dot: 'bg-neutral-400', tone: 'secondary' },
  neutral:   { container: 'bg-neutral-100 border border-neutral-200', dot: 'bg-neutral-400', tone: 'secondary' },
};

const sizeClasses: Record<BadgeSize, { container: string; dot: string }> = {
  sm: { container: 'px-md py-[2px] gap-xs', dot: 'w-[6px] h-[6px] rounded-full' },
  md: { container: 'px-lg py-xs gap-sm',    dot: 'w-[7px] h-[7px] rounded-full' },
};

export function Badge({ variant, label, size = 'sm', dot = false, leftIcon, className = '' }: Props) {
  const v = variantClasses[variant];
  const s = sizeClasses[size];

  return (
    <View
      className={`flex-row items-center self-start rounded-full ${v.container} ${s.container} ${className}`}
    >
      {dot ? <View className={`${s.dot} ${v.dot}`} /> : null}
      {leftIcon ? <View className="mr-[2px]">{leftIcon}</View> : null}
      <Text
        variant={size === 'md' ? 'bodySm' : 'caption'}
        tone={v.tone}
        className="font-bold uppercase tracking-wide"
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}
