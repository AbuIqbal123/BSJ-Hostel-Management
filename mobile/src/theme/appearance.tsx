import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import * as SecureStore from "expo-secure-store";
import { useColorScheme } from "react-native";

const APPEARANCE_KEY = "bsj.appearance";

type Choice = "dark" | "light";

type AppearanceValue = {
  dark: boolean;
  setDark: (value: boolean) => void;
};

const AppearanceContext = createContext<AppearanceValue | null>(null);

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [choice, setChoice] = useState<Choice | null>(null);

  useEffect(() => {
    let active = true;
    SecureStore.getItemAsync(APPEARANCE_KEY)
      .then((stored) => {
        if (!active) {
          return;
        }
        if (stored === "dark" || stored === "light") {
          setChoice(stored);
        }
      })
      .catch(() => {
        // A missing preference follows the phone.
      });
    return () => {
      active = false;
    };
  }, []);

  const setDark = useCallback((value: boolean) => {
    const next: Choice = value ? "dark" : "light";
    setChoice(next);
    SecureStore.setItemAsync(APPEARANCE_KEY, next).catch(() => {
      // The screen still changes for this visit.
    });
  }, []);

  const dark = choice === null ? system === "dark" : choice === "dark";
  const value = useMemo(() => ({ dark, setDark }), [dark, setDark]);

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance(): AppearanceValue {
  const value = useContext(AppearanceContext);
  if (!value) {
    throw new Error("Appearance is missing.");
  }
  return value;
}

export function useDark(): boolean {
  const appearance = useContext(AppearanceContext);
  const system = useColorScheme();
  if (!appearance) {
    return system === "dark";
  }
  return appearance.dark;
}
