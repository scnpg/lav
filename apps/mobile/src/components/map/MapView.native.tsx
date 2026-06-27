// Native (iOS/Android) MapView - intentionally still the mock map layout.
// Real native MapLibre (@maplibre/maplibre-react-native) needs a custom dev
// client build (expo prebuild + expo run:ios/android), which hasn't been
// attempted in this repo yet. See MapView.web.tsx for the real MapLibre GL
// JS implementation, which only runs on web via Metro's `.web.tsx`
// platform-extension resolution.
export { MockMapView as MapView } from "./MockMapView";
