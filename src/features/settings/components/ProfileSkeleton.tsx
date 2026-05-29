import { View } from 'react-native';

function Bone({ className }: { className: string }) {
  return <View className={`bg-neutral-200 rounded-lg animate-pulse ${className}`} />;
}

// Mirrors the post-W3 layout: hero → quick-actions strip → 3 section groups
// (Account, Preferences, Security). Each group is a small-caps header bone
// followed by 1–2 card bones. Section counts intentionally match the live
// composition so the layout shift on data-ready is minimal.
export function ProfileSkeleton() {
  return (
    <View>
      {/* Hero */}
      <View className="items-center py-16 px-14 bg-neutral-200 rounded-b-hero">
        <Bone className="w-[76px] h-[76px] rounded-full mb-5" />
        <Bone className="w-40 h-5 mb-2" />
        <Bone className="w-56 h-4 mb-4" />
        <Bone className="w-20 h-6 rounded-full" />
      </View>

      {/* Quick-actions strip */}
      <View className="mx-lg -mt-2xl bg-white rounded-2xl border border-neutral-200 h-20 flex-row items-center px-md gap-md">
        <Bone className="flex-1 h-10 rounded-lg" />
        <Bone className="flex-1 h-10 rounded-lg" />
        <Bone className="flex-1 h-10 rounded-lg" />
        <Bone className="flex-1 h-10 rounded-lg" />
      </View>

      {/* Account — 3 cards (Verification + ProfileInfo + Address) */}
      <View className="mx-8">
        <Bone className="w-24 h-3 mt-8 mb-3" />
        <View className="gap-6">
          <Bone className="w-full h-44 rounded-2xl" />
          <Bone className="w-full h-56 rounded-2xl" />
          <Bone className="w-full h-48 rounded-2xl" />
        </View>
      </View>

      {/* Preferences — 2 cards (LanguageRegion + Notifications) */}
      <View className="mx-8">
        <Bone className="w-28 h-3 mt-8 mb-3" />
        <View className="gap-6">
          <Bone className="w-full h-44 rounded-2xl" />
          <Bone className="w-full h-44 rounded-2xl" />
        </View>
      </View>

      {/* Security — 1 card + danger button */}
      <View className="mx-8">
        <Bone className="w-24 h-3 mt-8 mb-3" />
        <View className="gap-6">
          <Bone className="w-full h-44 rounded-2xl" />
          <Bone className="w-full h-12 rounded-2xl" />
        </View>
      </View>
    </View>
  );
}
