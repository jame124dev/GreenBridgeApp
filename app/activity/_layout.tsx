import { Stack } from 'expo-router';

export default function ActivityLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
  );
}
