import React from "react";
import { Tabs } from "expo-router";
import { ChronoTabBar } from "../../components/ChronoTabBar";
import { chronoTheme } from "../../theme/colors";

const { colors } = chronoTheme;

// Stabil referans: her render'da yeni tabBar fonksiyonu üretilmez
const renderTabBar = (props: any) => <ChronoTabBar {...props} />;

// Kısa ve hafif çapraz geçiş (sadece opacity, native driver) — 'shift' animasyonundan çok daha ucuz
const TAB_SCREEN_OPTIONS = {
  headerShown: false,
  sceneStyle: {
    backgroundColor: colors.background,
  },
  animation: "none",
  lazy: true,
} as const;

export default function TabLayout() {
  return (
    <Tabs tabBar={renderTabBar} screenOptions={TAB_SCREEN_OPTIONS}>
      <Tabs.Screen
        name="index"
        options={{
          title: "Sohbetler",
        }}
      />
      <Tabs.Screen
        name="contacts"
        options={{
          title: "Kişiler",
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
        }}
      />
    </Tabs>
  );
}
