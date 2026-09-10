import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { resolveApiAddress } from './api-address';

export const routesApiUrl = resolveApiAddress({
  explicit: process.env.EXPO_PUBLIC_ROUTES_API_URL,
  platform: Platform.OS,
  isDevice: Device.isDevice,
  host: Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : Constants.expoConfig?.hostUri,
});
