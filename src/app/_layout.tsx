import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { usePrefs } from '@/data/prefs';
import { useHabitStore } from '@/data/store';
import { useDayAndSync } from '@/lib/use-today';
import { useTheme } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export const unstable_settings = { anchor: 'index' };

export default function RootLayout() {
  const { scheme, colors } = useTheme();
  const ready = useHabitStore((s) => s.ready);
  const prefsLoaded = usePrefs((s) => s.loaded);

  useEffect(() => {
    void useHabitStore.getState().init();
    void usePrefs.getState().load();
    // Her ihtimale karşı açılış ekranı sonsuza dek kalmasın.
    const fallback = setTimeout(() => SplashScreen.hideAsync().catch(() => {}), 3000);
    return () => clearTimeout(fallback);
  }, []);

  useEffect(() => {
    if (ready && prefsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [ready, prefsLoaded]);

  useDayAndSync();

  const navigationTheme = useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.brand,
        background: colors.background,
        card: colors.background,
        text: colors.text,
        border: colors.border,
      },
    };
  }, [scheme, colors]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <ThemeProvider value={navigationTheme}>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
            animation: Platform.OS === 'android' ? 'fade_from_bottom' : 'default',
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="habit/[id]" />
          <Stack.Screen
            name="form"
            options={{
              presentation: 'modal',
              animation: Platform.OS === 'android' ? 'slide_from_bottom' : 'default',
              contentStyle: { backgroundColor: colors.background },
            }}
          />
          <Stack.Screen name="settings" />
        </Stack>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
