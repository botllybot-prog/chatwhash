import { useEffect, useMemo, useState } from 'react';
import { fetchStationsWithServices } from '../lib/stations';
import type { MobileStation } from '../types';

export function useStations() {
  const [stations, setStations] = useState<MobileStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<'live' | 'mock'>('mock');
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const result = await fetchStationsWithServices();
    setStations(result.stations);
    setSource(result.source);
    setError(result.error || null);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const mapRegion = useMemo(() => {
    const first = stations[0];
    if (!first) {
      return { latitude: 33.3152, longitude: 44.3661, latitudeDelta: 0.12, longitudeDelta: 0.12 };
    }
    return { latitude: first.latitude, longitude: first.longitude, latitudeDelta: 0.12, longitudeDelta: 0.12 };
  }, [stations]);

  return { stations, loading, source, error, reload: load, mapRegion };
}
