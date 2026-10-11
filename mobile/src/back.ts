import { router, type Href } from "expo-router";

export function goBackOr(navigation: { canGoBack(): boolean; goBack(): void }, fallback: Href) {
  if (navigation.canGoBack()) {
    navigation.goBack();
    return;
  }
  router.navigate(fallback);
}
