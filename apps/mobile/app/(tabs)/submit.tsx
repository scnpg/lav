import { Redirect } from "expo-router";

// This tab slot was a placeholder ahead of the real submission flow - now
// built at app/bathrooms/submit.tsx (the map-pin wizard, also reachable from
// the map's FAB and a bathroom's "Suggest edit" action). Redirect rather
// than render inline: the wizard expects to be a pushed stack screen (its
// own back button, router.back() on success) which doesn't map cleanly onto
// being a tab's own root content.
export default function SubmitTab() {
  return <Redirect href="/bathrooms/submit" />;
}
