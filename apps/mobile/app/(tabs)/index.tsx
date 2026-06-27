import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BathroomBottomCard } from "../../src/components/map/BathroomBottomCard";
import { FilterChips, type FilterOption } from "../../src/components/map/FilterChips";
import { MapView } from "../../src/components/map/MapView";
import { SearchBar } from "../../src/components/map/SearchBar";
import { MOCK_BATHROOMS } from "../../src/features/bathrooms/mockData";
import { cardShadow, colors, radii, spacing } from "../../src/theme";

// TODO(map): swap MOCK_BATHROOMS for src/features/bathrooms/api.ts's
// getNearbyBathrooms() once Supabase is wired up. MapView resolves to a real
// MapLibre GL JS map on web (MapView.web.tsx) and the mock layout on native
// (MapView.native.tsx) until native MapLibre is wired up too.

const FILTER_OPTIONS: FilterOption[] = [
  { key: "free", label: "Free" },
  { key: "wheelchair", label: "Wheelchair accessible" },
  { key: "bidet", label: "Bidet" },
  { key: "public_only", label: "Public only" },
];

export default function MapScreen() {
  const [searchText, setSearchText] = useState("");
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  function toggleFilter(key: string) {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const visibleBathrooms = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    return MOCK_BATHROOMS.filter((bathroom) => {
      if (query) {
        const haystack = [bathroom.name, bathroom.venue_name, bathroom.city, ...bathroom.tags]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      if (activeFilters.has("free") && bathroom.cost_type !== "free") return false;
      if (activeFilters.has("wheelchair") && !bathroom.amenities.wheelchair_accessible) return false;
      if (activeFilters.has("bidet") && bathroom.toilet_type !== "bidet" && !bathroom.tags.includes("bidet")) {
        return false;
      }
      if (activeFilters.has("public_only") && bathroom.access_type !== "public") return false;

      return true;
    });
  }, [searchText, activeFilters]);

  const selectedBathroom = visibleBathrooms.find((b) => b.id === selectedId) ?? null;

  function handleUseMyLocation() {
    Alert.alert(
      "Use my location",
      "This is a placeholder - location access will be requested here once the Map tab is connected to real data. Lav never stores or shares your live location."
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.topControls}>
        <SearchBar value={searchText} onChangeText={setSearchText} />
        <View style={styles.filtersRow}>
          <FilterChips options={FILTER_OPTIONS} activeKeys={activeFilters} onToggle={toggleFilter} />
        </View>
      </View>

      <View style={styles.mapArea}>
        <MapView
          bathrooms={visibleBathrooms}
          selectedId={selectedId}
          onSelectPin={setSelectedId}
          onPressBackground={() => setSelectedId(null)}
        />

        <Pressable
          style={[styles.locationButton, cardShadow("md")]}
          onPress={handleUseMyLocation}
          hitSlop={8}
        >
          <Ionicons name="locate" size={20} color={colors.accent} />
        </Pressable>
      </View>

      {selectedBathroom ? (
        <BathroomBottomCard bathroom={selectedBathroom} onClose={() => setSelectedId(null)} />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topControls: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  filtersRow: {
    marginBottom: spacing.xs,
  },
  mapArea: {
    flex: 1,
    marginTop: spacing.sm,
  },
  locationButton: {
    position: "absolute",
    bottom: spacing.lg,
    right: spacing.lg,
    width: 44,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
});
