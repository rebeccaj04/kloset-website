import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import * as Linking from 'expo-linking';
import { Stack, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_700Bold,
} from '@expo-google-fonts/playfair-display';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';

import { useColorScheme } from '@/components/useColorScheme';
import { supabase } from '@/lib/supabase';
import { LocaleProvider } from '@/lib/LocaleContext';
import { ONBOARDING_KEY } from '@/app/onboarding';
import { initPurchases } from '@/lib/revenuecat';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    PlayfairDisplay_400Regular,
    PlayfairDisplay_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  // Handle Supabase auth deep links.
  // In Expo Go (SDK 50+): exp+kloset://?code=XXXX
  // In production (standalone): kloset://?code=XXXX
  // Use Linking.createURL('/') when sending auth emails so the scheme always matches.
  useEffect(() => {
    const handleAuthUrl = async (url: string) => {
      const { queryParams } = Linking.parse(url);
      const code = queryParams?.code as string | undefined;
      if (code) {
        await supabase.auth.exchangeCodeForSession(code);
      }
    };

    // App opened cold by a deep link
    Linking.getInitialURL().then(url => {
      if (url) handleAuthUrl(url);
    });

    // App already open, deep link arrives
    const sub = Linking.addEventListener('url', ({ url }) => handleAuthUrl(url));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <LocaleProvider>
      <RootLayoutNav />
    </LocaleProvider>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  useEffect(() => {
    const checkAndGate = async () => {
      // Check if user is authenticated first
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // Authenticated — check Supabase onboarded flag (persists across reinstalls)
        const { data: profile } = await supabase
          .from('users')
          .select('onboarded')
          .eq('id', user.id)
          .single();

        if (profile?.onboarded) {
          // Returning authenticated user — skip onboarding
          setOnboardingChecked(true);
          return;
        }

        // Authenticated but Supabase flag not set — check AsyncStorage
        // (covers the case where onboarding ran before user signed up)
        const stored = await AsyncStorage.getItem(ONBOARDING_KEY);
        if (stored) {
          // Seen onboarding — backfill Supabase flag for next login
          await supabase.from('users').update({ onboarded: true }).eq('id', user.id);
          setOnboardingChecked(true);
          return;
        }
      } else {
        // Not authenticated — AsyncStorage is the only signal
        const stored = await AsyncStorage.getItem(ONBOARDING_KEY);
        if (stored) {
          setOnboardingChecked(true);
          return;
        }
      }

      // No signal found → first-time user, show onboarding
      router.replace('/onboarding');
      setOnboardingChecked(true);
    };

    checkAndGate();

    // Initialise RevenueCat with the authenticated user's ID (if signed in)
    supabase.auth.getUser().then(({ data: { user } }) => {
      initPurchases(user?.id);
    });

    // After sign-in: if user has seen onboarding, write flag to Supabase
    // so that future logins (new device / reinstall) also skip onboarding.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          const stored = await AsyncStorage.getItem(ONBOARDING_KEY);
          if (stored) {
            await supabase
              .from('users')
              .update({ onboarded: true })
              .eq('id', session.user.id);
          }
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="trip" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
        <Stack.Screen name="paywall" options={{ headerShown: false, presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="favourites" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}
