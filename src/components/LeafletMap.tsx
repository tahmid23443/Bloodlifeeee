import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { BloodRequest, TikaCampaign, UserProfile } from '../types';
import type { LiveGeoCoords } from '../utils/useLiveLocation';

interface LeafletMapProps {
  currentUser: UserProfile;
  providers: UserProfile[];
  activeRequest: BloodRequest | null;
  liveCoords?: LiveGeoCoords | null;
  tikaCampaigns?: TikaCampaign[];
  mapLayer?: 'all' | 'blood' | 'tika';
  centerTrigger?: number;
  pickLocationMode?: boolean;
  pickedCoords?: { lat: number; lng: number } | null;
  onMapPick?: (lat: number, lng: number) => void;
}

export function LeafletMap({
  currentUser,
  providers,
  activeRequest,
  liveCoords,
  tikaCampaigns = [],
  mapLayer = 'all',
  centerTrigger = 0,
  pickLocationMode = false,
  pickedCoords,
  onMapPick,
}: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const onMapPickRef = useRef(onMapPick);
  const pickModeRef = useRef(pickLocationMode);

  onMapPickRef.current = onMapPick;
  pickModeRef.current = pickLocationMode;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const startLat = liveCoords?.lat ?? currentUser.lat ?? 23.7465;
    const startLng = liveCoords?.lng ?? currentUser.lng ?? 90.376;

    const map = L.map(containerRef.current, {
      center: [startLat, startLng],
      zoom: 14,
      zoomControl: false,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);
    mapRef.current = map;
    layerGroupRef.current = layerGroup;

    map.on('click', (e: L.LeafletMouseEvent) => {
      if (pickModeRef.current && onMapPickRef.current) {
        onMapPickRef.current(
          Math.round(e.latlng.lat * 100000) / 100000,
          Math.round(e.latlng.lng * 100000) / 100000
        );
      }
    });

    return () => {
      map.stop();
      map.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
    };
  }, []);

  // Re-center immediately when user taps My Live Location button
  useEffect(() => {
    if (!centerTrigger || !mapRef.current) return;
    const lat = liveCoords?.lat ?? currentUser.lat;
    const lng = liveCoords?.lng ?? currentUser.lng;
    mapRef.current.setView([lat, lng], 15, { animate: false });
  }, [centerTrigger]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerGroupRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    if (containerRef.current) {
      containerRef.current.style.cursor = pickLocationMode ? 'crosshair' : 'grab';
    }

    const boundsPoints: L.LatLngExpression[] = [];

    // 0. Always render User's Real Live GPS Location Puck in Red & White
    const myLat = liveCoords?.lat ?? currentUser.lat;
    const myLng = liveCoords?.lng ?? currentUser.lng;

    if (liveCoords?.accuracy && liveCoords.accuracy > 0) {
      L.circle([myLat, myLng], {
        radius: Math.min(liveCoords.accuracy, 450),
        color: '#DC1423',
        weight: 1,
        opacity: 0.35,
        fillColor: '#DC1423',
        fillOpacity: 0.08,
      }).addTo(layer);
    }

    const myGpsIcon = L.divIcon({
      className: 'custom-blood-marker',
      html: `
        <div style="position:relative;display:flex;flex-direction:column;align-items:center;">
          <div style="position:relative;display:flex;align-items:center;justify-content:center;width:28px;height:28px;">
            <div class="marker-ring" style="position:absolute;width:28px;height:28px;border-radius:999px;background:rgba(220,20,35,0.35);"></div>
            <div style="width:16px;height:16px;border-radius:999px;background:#DC1423;border:3px solid #FFFFFF;box-shadow:0 2px 10px rgba(220,20,35,0.45);"></div>
          </div>
          <div style="margin-top:2px;background:#FFFFFF;color:#DC1423;border:1.5px solid #DC1423;border-radius:8px;padding:1px 6px;font-size:10px;font-weight:800;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.12);">
            ${liveCoords ? 'Live GPS' : 'You'}
          </div>
        </div>
      `,
      iconSize: [70, 44],
      iconAnchor: [35, 14],
    });
    L.marker([myLat, myLng], { icon: myGpsIcon, zIndexOffset: 800 })
      .bindTooltip(
        liveCoords
          ? `Your Live GPS (${myLat.toFixed(4)}, ${myLng.toFixed(4)})`
          : `Your Saved Location (${currentUser.address})`,
        { direction: 'top', offset: [0, -10] }
      )
      .addTo(layer);
    boundsPoints.push([myLat, myLng]);

    // 1. Render Matched Blood Request Participants Only (Strict Privacy Scoping)
    if (mapLayer !== 'tika') {
      const matchedIds = new Set<string>();
      if (activeRequest) {
        if (activeRequest.needer_id && activeRequest.needer_id !== currentUser.id) {
          matchedIds.add(activeRequest.needer_id);
        }
        if (activeRequest.provider_id && activeRequest.provider_id !== currentUser.id) {
          matchedIds.add(activeRequest.provider_id);
        }
        if (activeRequest.rider_id && activeRequest.rider_id !== currentUser.id) {
          matchedIds.add(activeRequest.rider_id);
        }
      }

      for (const p of providers) {
        if (!matchedIds.has(p.id)) continue;

        let html = '';
        if (p.role === 'hospital') {
          const shortName = (p.hospital_name || p.name).replace(/ Hospital| Center| Blood Bank/g, '');
          html = `
            <div style="display:inline-flex;align-items:center;gap:5px;background:#FFFFFF;border:2px solid #DC1423;border-radius:10px;padding:3px 8px;box-shadow:0 3px 10px rgba(220,20,35,0.2);white-space:nowrap;max-width:140px;">
              <span style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;background:#DC1423;color:#FFF;border-radius:5px;font-weight:800;font-size:12px;flex-shrink:0;">+</span>
              <span style="font-size:11px;font-weight:700;color:#141417;overflow:hidden;text-overflow:ellipsis;">${shortName}</span>
            </div>
          `;
        } else if (p.role === 'donor') {
          html = `
            <div style="position:relative;display:flex;align-items:center;justify-content:center;">
              <div style="width:34px;height:34px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#DC1423;border:2px solid #FFFFFF;box-shadow:0 4px 12px rgba(220,20,35,0.35);display:flex;align-items:center;justify-content:center;">
                <span style="transform:rotate(45deg);color:#FFF;font-size:10px;font-weight:800;">${p.blood_type}</span>
              </div>
            </div>
          `;
        } else if (p.role === 'rider') {
          html = `
            <div style="display:flex;align-items:center;gap:5px;background:#DC1423;color:#FFF;border:2px solid #FFF;border-radius:999px;padding:4px 10px;box-shadow:0 4px 12px rgba(220,20,35,0.35);white-space:nowrap;">
              <span style="width:7px;height:7px;border-radius:999px;background:#FFFFFF;display:inline-block;"></span>
              <span style="font-size:10px;font-weight:800;">${p.name.split(' ')[0]}</span>
            </div>
          `;
        }

        if (!html) continue;

        const icon = L.divIcon({
          className: 'custom-blood-marker',
          html,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });

        const marker = L.marker([p.lat, p.lng], { icon });
        marker.bindTooltip(`${p.hospital_name || p.name} (${p.role.toUpperCase()} · ${p.blood_type})`, {
          direction: 'top',
          offset: [0, -14],
        });
        marker.addTo(layer);
        boundsPoints.push([p.lat, p.lng]);
      }
    }

    // 2. Render Official Government Tika Camp Pins (Red & White)
    if (mapLayer !== 'blood' && !pickLocationMode) {
      for (const camp of tikaCampaigns) {
        if (camp.status !== 'ACTIVE') continue;
        const campIcon = L.divIcon({
          className: 'custom-blood-marker',
          html: `
            <div style="display:inline-flex;align-items:center;gap:5px;background:#FFFFFF;border:2px solid #DC1423;border-radius:12px;padding:4px 9px;box-shadow:0 4px 12px rgba(220,20,35,0.22);white-space:nowrap;max-width:165px;">
              <span style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;background:#DC1423;color:#FFFFFF;border-radius:6px;font-weight:800;font-size:10px;flex-shrink:0;">T</span>
              <span style="font-size:11px;font-weight:700;color:#DC1423;overflow:hidden;text-overflow:ellipsis;">${camp.vaccine_name}</span>
            </div>
          `,
          iconSize: [140, 30],
          iconAnchor: [70, 15],
        });
        L.marker([camp.lat, camp.lng], { icon: campIcon })
          .bindTooltip(`${camp.title} · ${camp.venue_name} (${camp.total_slots - camp.registered_count} slots left)`, {
            direction: 'top',
            offset: [0, -12],
          })
          .addTo(layer);
        boundsPoints.push([camp.lat, camp.lng]);
      }
    }

    // 3. Render Picked Location Pin
    if (pickedCoords) {
      const pickIcon = L.divIcon({
        className: 'custom-blood-marker',
        html: `
          <div style="position:relative;display:flex;flex-direction:column;align-items:center;">
            <div style="background:#DC1423;color:#FFF;padding:4px 10px;border-radius:8px;border:2px solid #FFFFFF;font-size:11px;font-weight:700;box-shadow:0 4px 12px rgba(220,20,35,0.4);white-space:nowrap;">Target Pin</div>
            <div style="width:14px;height:14px;border-radius:999px;background:#DC1423;border:3px solid #FFF;margin-top:2px;"></div>
          </div>
        `,
        iconSize: [110, 44],
        iconAnchor: [55, 38],
      });
      L.marker([pickedCoords.lat, pickedCoords.lng], { icon: pickIcon }).addTo(layer);
      boundsPoints.push([pickedCoords.lat, pickedCoords.lng]);
    }

    // 4. Render Active Request Route, Search Radar Radius, & Live Rider Position (Red & White)
    if (mapLayer !== 'tika' && activeRequest && activeRequest.status !== 'CANCELLED') {
      const dropoffPoint: L.LatLngExpression = [activeRequest.dropoff_lat, activeRequest.dropoff_lng];
      boundsPoints.push(dropoffPoint);

      if (activeRequest.status === 'SEARCHING') {
        L.circle(dropoffPoint, {
          radius: 1800,
          color: '#DC1423',
          weight: 1.5,
          opacity: 0.45,
          fillColor: '#DC1423',
          fillOpacity: 0.08,
        }).addTo(layer);
      } else {
        const dropIcon = L.divIcon({
          className: 'custom-blood-marker',
          html: `
            <div style="position:relative;display:flex;align-items:center;justify-content:center;">
              <div class="marker-ring" style="position:absolute;width:36px;height:36px;border-radius:999px;background:rgba(220,20,35,0.28);"></div>
              <div style="background:#DC1423;color:#FFF;padding:5px 10px;border-radius:10px;border:2px solid #FFF;font-size:11px;font-weight:800;box-shadow:0 4px 14px rgba(220,20,35,0.45);white-space:nowrap;">
                Need ${activeRequest.blood_type} (${activeRequest.units}u)
              </div>
            </div>
          `,
          iconSize: [120, 32],
          iconAnchor: [60, 16],
        });
        L.marker(dropoffPoint, { icon: dropIcon }).addTo(layer);
      }

      if (activeRequest.pickup_lat && activeRequest.pickup_lng) {
        const pickupPoint: L.LatLngExpression = [activeRequest.pickup_lat, activeRequest.pickup_lng];
        boundsPoints.push(pickupPoint);

        // White outer casing + Crimson inner route line
        L.polyline([pickupPoint, dropoffPoint], {
          color: '#FFFFFF',
          weight: 7,
          opacity: 0.9,
        }).addTo(layer);
        L.polyline([pickupPoint, dropoffPoint], {
          color: '#DC1423',
          weight: 4,
          opacity: 0.9,
          dashArray: activeRequest.status === 'IN_TRANSIT' ? undefined : '8, 8',
        }).addTo(layer);
      }

      if (activeRequest.rider_lat && activeRequest.rider_lng) {
        const riderPos: L.LatLngExpression = [activeRequest.rider_lat, activeRequest.rider_lng];
        boundsPoints.push(riderPos);

        const riderIcon = L.divIcon({
          className: 'custom-blood-marker',
          html: `
            <div style="position:relative;display:flex;align-items:center;justify-content:center;">
              <div class="marker-ring" style="position:absolute;width:44px;height:44px;border-radius:999px;background:rgba(220,20,35,0.32);"></div>
              <div style="display:flex;align-items:center;gap:6px;background:#FFFFFF;color:#DC1423;padding:6px 11px;border-radius:999px;border:2.5px solid #DC1423;box-shadow:0 6px 18px rgba(220,20,35,0.28);white-space:nowrap;">
                <span style="font-size:11px;font-weight:800;">LIVE RIDER</span>
                <span style="font-size:11px;font-weight:700;color:#141417;">${(activeRequest.rider_name || 'Courier').split(' ')[0]}</span>
              </div>
            </div>
          `,
          iconSize: [140, 34],
          iconAnchor: [70, 17],
        });
        L.marker(riderPos, { icon: riderIcon, zIndexOffset: 900 }).addTo(layer);

        if (activeRequest.status === 'RIDER_ASSIGNED' && activeRequest.pickup_lat && activeRequest.pickup_lng) {
          L.polyline([riderPos, [activeRequest.pickup_lat, activeRequest.pickup_lng]], {
            color: '#DC1423',
            weight: 3,
            dashArray: '5, 6',
          }).addTo(layer);
        } else if (activeRequest.status === 'IN_TRANSIT') {
          L.polyline([riderPos, dropoffPoint], {
            color: '#DC1423',
            weight: 4,
          }).addTo(layer);
        }
      }
    }

    if (activeRequest?.status === 'SEARCHING' && !pickLocationMode && mapLayer !== 'tika') {
      map.setView([activeRequest.dropoff_lat, activeRequest.dropoff_lng], 14, { animate: false });
    } else if (boundsPoints.length >= 2) {
      map.fitBounds(L.latLngBounds(boundsPoints), { padding: [55, 55], maxZoom: 15, animate: false });
    } else if (boundsPoints.length === 1) {
      map.setView(boundsPoints[0], 14, { animate: false });
    }
  }, [providers, activeRequest, currentUser, liveCoords, tikaCampaigns, mapLayer, pickLocationMode, pickedCoords]);

  return (
    <div className="relative w-full h-full min-h-[380px] rounded-2xl overflow-hidden border border-red-100 bg-white">
      <div ref={containerRef} data-testid="leaflet-map" className="w-full h-full min-h-[380px]" />

      {pickLocationMode && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[400] bg-[#DC1423] text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-lg">
          Tap anywhere on the map to set location
        </div>
      )}

      <div className="absolute bottom-3 left-3 z-[400] bg-white/95 backdrop-blur-sm border border-red-100 rounded-xl px-3 py-2 flex flex-wrap items-center gap-3 text-[11px] font-medium text-neutral-700 shadow-sm">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#DC1423] ring-2 ring-red-100 inline-block" />
          Live GPS / Target
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-[#DC1423] text-white text-[9px] font-bold inline-flex items-center justify-center">
            +
          </span>
          Blood Bank
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-white border border-[#DC1423] text-[#DC1423] text-[9px] font-bold inline-flex items-center justify-center">
            T
          </span>
          Tika Camp
        </span>
      </div>
    </div>
  );
}
