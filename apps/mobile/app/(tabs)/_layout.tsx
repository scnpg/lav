import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";

import { colors } from "../../src/theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accentStrong,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Map",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "map" : "map-outline"} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="feed"
        options={{
          title: "Feed",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "newspaper" : "newspaper-outline"} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="submit"
        options={{
          title: "Submit",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "add-circle" : "add-circle-outline"} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="lists"
        options={{
          title: "Lists",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "albums" : "albums-outline"} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "person" : "person-outline"} size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
