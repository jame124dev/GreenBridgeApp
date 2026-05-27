import { View } from 'react-native';

function Bone({ className }: { className: string }) {
  return <View className={`bg-neutral-200 rounded-lg animate-pulse ${className}`} />;
}

export function ProfileSkeleton() {
  return (
    <View>
      {/* Hero skeleton */}
      <View className="items-center py-16 px-14 bg-neutral-200" style={{ borderBottomLeftRadius: 40, borderBottomRightRadius: 40 }}>
        <Bone className="w-[76px] h-[76px] rounded-full mb-5" />
        <Bone className="w-40 h-5 mb-2" />
        <Bone className="w-56 h-4 mb-4" />
        <Bone className="w-20 h-6 rounded-full" />
      </View>

      {/* Title block skeleton */}
      <View className="px-14 pt-14 pb-1">
        <Bone className="w-32 h-7 mb-2" />
        <Bone className="w-48 h-4" />
      </View>

      {/* Card skeleton */}
      <View className="mx-8 mt-6 rounded-2xl overflow-hidden border border-border bg-white">
        <View className="flex-row items-center gap-5 px-6 py-5 border-b border-border">
          <Bone className="w-9 h-9 rounded-lg" />
          <View className="flex-1 gap-2">
            <Bone className="w-40 h-5" />
            <Bone className="w-56 h-3" />
          </View>
        </View>
        <View className="p-6 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <View key={i} className="gap-2">
              <Bone className="w-24 h-4" />
              <Bone className="w-full h-14 rounded-xl" />
            </View>
          ))}
          <Bone className="w-full h-14 rounded-2xl mt-2" />
        </View>
      </View>
    </View>
  );
}
