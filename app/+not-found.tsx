import { Link, Stack } from 'expo-router';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';


// Fork the "home" target the same way the rest of the app does — the seller
// tabs vs the customer (lab) home — instead of always dropping into the seller
// group.
const HOME_ROUTE = '/(lab)/(tabs)/home';

export default function NotFoundScreen() {
  const { t } = useTranslation();
  return (
    <>
      <Stack.Screen options={{ title: t('mobile.notFound.title', { defaultValue: 'Not found' }) }} />
      <View className="flex-1 items-center justify-center bg-background px-6">
        <Text className="text-xl font-semibold text-foreground">
          {t('mobile.notFound.heading', { defaultValue: 'Page not found' })}
        </Text>
        <Link href={HOME_ROUTE as never} className="mt-4 text-brand-primary font-semi">
          {t('mobile.notFound.goHome', { defaultValue: 'Go home' })}
        </Link>
      </View>
    </>
  );
}
