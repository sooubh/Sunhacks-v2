import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import { format } from 'date-fns';

interface CityHeatStat {
  city: string;
  lat: number;
  lng: number;
  total: number;
  high: number;
  medium: number;
  low: number;
}

interface CityHeatmapMapProps {
  selectedCity: string;
  updatedAt: Date;
  cityStats: CityHeatStat[];
  heatPoints: Array<[number, number, number]>;
  onCitySelect?: (city: string) => void;
}

type LeafletWithHeat = typeof L & {
  heatLayer: (latlngs: Array<[number, number, number]>, options?: Record<string, unknown>) => L.Layer;
};

const INDIA_CENTER: L.LatLngExpression = [22.6, 79.2];

function colorByCount(total: number): string {
  if (total >= 12) return '#ef4444';
  if (total >= 8) return '#f97316';
  if (total >= 4) return '#f59e0b';
  return '#22c55e';
}

export default function CityHeatmapMap({
  selectedCity,
  updatedAt,
  cityStats,
  heatPoints,
  onCitySelect,
}: CityHeatmapMapProps) {
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const heatLayerRef = useRef<L.Layer | null>(null);
  const onCitySelectRef = useRef<((city: string) => void) | undefined>(onCitySelect);

  const selectedStat = useMemo(
    () => cityStats.find((item) => item.city === selectedCity) ?? null,
    [cityStats, selectedCity],
  );

  useEffect(() => {
    onCitySelectRef.current = onCitySelect;
  }, [onCitySelect]);

  useEffect(() => {
    if (!mapElRef.current || mapRef.current) return;

    const map = L.map(mapElRef.current, {
      preferCanvas: true,
      zoomControl: true,
      attributionControl: true,
      minZoom: 4,
      maxZoom: 12,
      zoomAnimation: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    map.setView(INDIA_CENTER, 5);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const element = mapElRef.current;
    if (!map || !element) return;

    const observer = new ResizeObserver(() => {
      map.invalidateSize({ pan: false, debounceMoveend: true });
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (markerLayerRef.current) {
      markerLayerRef.current.remove();
      markerLayerRef.current = null;
    }

    if (heatLayerRef.current) {
      heatLayerRef.current.remove();
      heatLayerRef.current = null;
    }

    const markerLayer = L.layerGroup();
    const markerRenderer = L.canvas({ padding: 0.25 });

    cityStats.forEach((stat) => {
      const isSelected = stat.city === selectedCity;
      const radius = isSelected ? 16 : 11;
      const marker = L.circleMarker([stat.lat, stat.lng], {
        renderer: markerRenderer,
        radius,
        color: isSelected ? '#2563eb' : '#0f172a',
        weight: isSelected ? 2.6 : 1.5,
        fillColor: colorByCount(stat.total),
        fillOpacity: isSelected ? 0.7 : 0.45,
      });

      marker.bindTooltip(
        `${stat.city}<br/>Total: ${stat.total}<br/>High: ${stat.high} | Medium: ${stat.medium} | Low: ${stat.low}`,
        { direction: 'top', opacity: 0.95, sticky: true },
      );

      marker.on('click', () => onCitySelectRef.current?.(stat.city));
      marker.addTo(markerLayer);
    });

    markerLayer.addTo(map);
    markerLayerRef.current = markerLayer;

    const heatFactory = (L as LeafletWithHeat).heatLayer;
    if (typeof heatFactory === 'function' && heatPoints.length > 0) {
      const heatLayer = (L as LeafletWithHeat).heatLayer(heatPoints, {
        radius: 34,
        blur: 26,
        maxZoom: 9,
        minOpacity: 0.28,
        gradient: {
          0.2: '#22c55e',
          0.45: '#f59e0b',
          0.7: '#f97316',
          1.0: '#ef4444',
        },
      });
      heatLayer.addTo(map);
      heatLayerRef.current = heatLayer;
    }

    if (selectedStat) {
      map.setView([selectedStat.lat, selectedStat.lng], 6, { animate: false });
    } else if (cityStats.length > 1) {
      const bounds = L.latLngBounds(cityStats.map((stat) => [stat.lat, stat.lng] as [number, number]));
      map.fitBounds(bounds.pad(0.25), { animate: false });
    } else {
      map.setView(INDIA_CENTER, 5, { animate: false });
    }
  }, [cityStats, heatPoints, selectedCity, selectedStat]);

  return (
    <div className="city-heatmap-card">
      <div className="city-heatmap-head">
        <div className="chart-title" style={{ marginBottom: 0 }}>🗺 Live City Heatmap</div>
        <div className="city-live-pill">LIVE · {format(updatedAt, 'HH:mm:ss')}</div>
      </div>

      <div ref={mapElRef} className="city-heatmap-map" />

      <div className="city-heatmap-legend">
        <span><strong>Selected:</strong> {selectedCity || 'N/A'}</span>
        <span><strong>Heat:</strong> green low · red high activity</span>
        <span><strong>Click marker:</strong> switch city view</span>
      </div>
    </div>
  );
}
