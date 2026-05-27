import {
  View,
  type ViewProps,
} from 'react-native';
import { Text } from './Text';
import { elevation } from '@/constants/theme';

export type CardVariant = 'elevated' | 'outlined' | 'flat';

type CardProps = ViewProps & {
  children: React.ReactNode;
  variant?: CardVariant;
};

const variants: Record<CardVariant, string> = {
  flat:     'bg-surface',
  elevated: 'bg-white',
  outlined: 'bg-white border border-border',
};

export function Card({
  children,
  variant = 'elevated',
  className = '',
  style,
  ...rest
}: CardProps) {
  const shadowStyle = variant === 'elevated' ? elevation.sm : undefined;

  return (
    <View
      className={`rounded-2xl overflow-hidden ${variants[variant]} ${className}`}
      style={[shadowStyle, style]}
      {...rest}
    >
      {children}
    </View>
  );
}

type CardHeaderProps = {
  icon?: React.ReactNode;
  iconBg?: string;
  title: string;
  description?: string;
  right?: React.ReactNode;
};

Card.Header = function CardHeader({
  icon,
  iconBg,
  title,
  description,
  right,
}: CardHeaderProps) {
  // Use soft emerald/green background if none provided
  const bgStyle = iconBg ? { backgroundColor: iconBg } : { backgroundColor: '#ECFDF5' };

  return (
    <View className="flex-row items-center gap-xl px-2xl py-xl border-b border-border">
      {icon ? (
        <View style={bgStyle} className="w-[36px] h-[36px] rounded-lg items-center justify-center">
          {icon}
        </View>
      ) : null}
      <View className="flex-1">
        <Text variant="subtitle" tone="primary" numberOfLines={1}>
          {title}
        </Text>
        {description ? (
          <Text variant="bodySm" tone="secondary" numberOfLines={2} className="mt-[2px]">
            {description}
          </Text>
        ) : null}
      </View>
      {right ? <View className="flex-shrink-0">{right}</View> : null}
    </View>
  );
};

Card.Body = function CardBody({
  children,
  className = '',
  style,
}: ViewProps) {
  return (
    <View className={`p-2xl gap-xl ${className}`} style={style}>
      {children}
    </View>
  );
};
