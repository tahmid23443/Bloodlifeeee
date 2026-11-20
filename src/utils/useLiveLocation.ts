import { useCallback, useEffect, useRef, useState } from 'react';
import { haversineKm } from '../shared/bloodLogic';

export type LocationPermissionState =
  | 'idle'
  | 'requesting'
  | 'active'
  | 'denied'
  | 'unsupported';

export interface LiveGeoCoords {
  lat: number;
  lng: number;
  accuracy: number | null;
  updatedAt: number;
}

export function useLiveLocation(enabled: boolean) {
  const [status, setStatus] = useState<LocationPermissionState>(() =>
    typeof navigator !== 'undefined' && 'geolocation' in navigator ? 'idle' : 'unsupported'
  );
  const [coords, setCoords] = useState<LiveGeoCoords | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const watchIdRef = useRef<number | null>(null);
  const lastCoordsRef = useRef<{ lat: number; lng: number } | null>(null);

  const handlePosition = useCallback((pos: GeolocationPosition) => {
    const lat = Math.round(pos.coords.latitude * 100000) / 100000;
    const lng = Math.round(pos.coords.longitude * 100000) / 100000;
    const accuracy = pos.coords.accuracy ? Math.round(pos.coords.accuracy) : null;

    const prev = lastCoordsRef.current;
    if (!prev || haversineKm(prev.lat, prev.lng, lat, lng) >= 0.015) {
      lastCoordsRef.current = { lat, lng };
      setCoords({ lat, lng, accuracy, updatedAt: Date.now() });
    }
    setStatus('active');
    setErrorMessage('');
  }, []);

  const handleError = useCallback((err: GeolocationPositionError) => {
    if (err.code === err.PERMISSION_DENIED) {
      setStatus('denied');
      setErrorMessage('Location access denied. Enable GPS in browser settings to track live.');
    } else if (err.code === err.POSITION_UNAVAILABLE) {
      setStatus('denied');
      setErrorMessage('Live GPS signal unavailable right now.');
    } else {
      setStatus('idle');
      setErrorMessage('Location request timed out. Tap Enable GPS to retry.');
    }
  }, []);

  const startWatching = useCallback(() => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setStatus('unsupported');
      return;
    }
    if (watchIdRef.current !== null) return;

    watchIdRef.current = navigator.geolocation.watchPosition(handlePosition, handleError, {
      enableHighAccuracy: true,
      maximumAge: 10000,
      timeout: 12000,
    });
  }, [handleError, handlePosition]);

  const requestLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setStatus('unsupported');
      return;
    }
    setStatus('requesting');
    setErrorMessage('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        handlePosition(pos);
        startWatching();
      },
      handleError,
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
  }, [handleError, handlePosition, startWatching]);

  useEffect(() => {
    if (!enabled) {
      if (watchIdRef.current !== null && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    // Automatically request live location access when authenticated
    requestLocation();

    return () => {
      if (watchIdRef.current !== null && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [enabled, requestLocation]);

  return {
    liveCoords: coords,
    locationStatus: status,
    locationError: errorMessage,
    requestLocation,
  };
}
