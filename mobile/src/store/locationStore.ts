import { create } from 'zustand';
import * as Location from 'expo-location';

interface LocationState {
  latitude: number | null;
  longitude: number | null;
  permission: 'unknown' | 'granted' | 'denied';
  fetchLocation: () => Promise<void>;
}

export const useLocationStore = create<LocationState>((set) => ({
  latitude: null,
  longitude: null,
  permission: 'unknown',

  fetchLocation: async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        set({ permission: 'denied' });
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      set({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        permission: 'granted',
      });
    } catch {
      set({ permission: 'denied' });
    }
  },
}));
