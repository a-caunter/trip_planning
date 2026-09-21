import { useCallback, useEffect, useRef, useState } from "react";
import Globe, { type GlobeMethods } from "react-globe.gl";
import { MeshPhongMaterial } from "three";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Minus, Plus, RotateCcw } from "lucide-react";
import landSource from "../globe/land.geojson?raw";
import type { GlobeLeg, GlobeStop } from "../globe/route";

const land = JSON.parse(landSource).features as object[];
const MIN_ALTITUDE = 0.15;
const MAX_ALTITUDE = 5;

export default function GlobeSurface({ stops, legs, selectedId, focusRequest, onSelect, onFailure }: {
  stops: GlobeStop[];
  legs: GlobeLeg[];
  selectedId: string | null;
  focusRequest: { id: string; sequence: number } | null;
  onSelect: (id: string) => void;
  onFailure: () => void;
}) {
  const globe = useRef<GlobeMethods | undefined>(undefined);
  const container = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [ready, setReady] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [ocean] = useState(() => new MeshPhongMaterial({ color: "#285d86", shininess: 12 }));
  const first = stops[0];
  const initialView = useRef({ lat: first?.lat ?? 20, lng: first?.lng ?? 0, altitude: 2.5 });
  const selected = stops.find((stop) => stop.id === focusRequest?.id);

  useEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    query.addEventListener("change", update);
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: Math.round(entry.contentRect.width), height: Math.round(entry.contentRect.height) });
    });
    observer.observe(container.current!);
    return () => { observer.disconnect(); query.removeEventListener("change", update); };
  }, []);

  useEffect(() => {
    if (!ready || !globe.current) return;
    const instance = globe.current;
    const renderer = instance.renderer();
    const canvas = renderer.domElement;
    const contextLost = (event: Event) => { event.preventDefault(); onFailure(); };
    canvas.addEventListener("webglcontextlost", contextLost);
    return () => {
      canvas.removeEventListener("webglcontextlost", contextLost);
      // react-globe.gl disposes its scene, controls and renderer on unmount.
      // Also release the context so repeatedly switching tabs does not exhaust WebGL.
      instance.pauseAnimation();
      renderer.forceContextLoss();
    };
  }, [ready, onFailure]);

  useEffect(() => {
    if (ready && selected) globe.current?.pointOfView({ lat: selected.lat, lng: selected.lng, altitude: 0.8 }, reducedMotion ? 0 : 650);
  }, [ready, focusRequest, selected?.lat, selected?.lng, reducedMotion]);

  const marker = useCallback((object: object) => {
    const stop = object as GlobeStop;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `globe-marker${selectedId === stop.id ? " is-selected" : ""}`;
    button.style.setProperty("--stop-color", stop.color);
    button.textContent = String(stop.number);
    button.title = `${stop.number}. ${stop.name}`;
    button.setAttribute("aria-label", `Show stop ${stop.number}: ${stop.name}`);
    // The ordered list provides keyboard navigation, including stops on the far side.
    button.tabIndex = -1;
    button.addEventListener("click", (event) => { event.stopPropagation(); onSelect(stop.id); });
    return button;
  }, [selectedId, onSelect]);

  function move(lat = 0, lng = 0, zoom = 1) {
    const instance = globe.current;
    if (!instance) return;
    const view = instance.pointOfView();
    instance.pointOfView({
      lat: Math.max(-85, Math.min(85, view.lat + lat)),
      lng: ((view.lng + lng + 540) % 360) - 180,
      altitude: Math.max(MIN_ALTITUDE, Math.min(MAX_ALTITUDE, view.altitude * zoom)),
    }, reducedMotion ? 0 : 200);
  }

  return <div className="globe-stage">
    <div className="globe-canvas" ref={container} role="region" aria-label="Interactive trip globe"
      aria-describedby="globe-help" data-ready={ready} data-stops={stops.length} data-legs={legs.length}>
      {size.width > 0 && size.height > 0 && <Globe ref={globe}
        width={size.width} height={size.height} backgroundColor="rgba(0,0,0,0)"
        globeMaterial={ocean} animateIn={false}
        atmosphereColor="#9dc7e8" atmosphereAltitude={0.13}
        polygonsData={land} polygonCapColor={() => "#b7c6bc"}
        polygonSideColor={() => "#8fa99f"} polygonAltitude={0.002}
        polygonCapCurvatureResolution={4} polygonsTransitionDuration={0} polygonLabel={() => ""}
        htmlElementsData={stops} htmlElement={marker} htmlAltitude={0.025} htmlTransitionDuration={0}
        arcsData={legs} arcColor="color" arcStroke={0.35} arcAltitudeAutoScale={0.3}
        arcDashLength={reducedMotion ? 1 : 0.5} arcDashGap={reducedMotion ? 0 : 0.15}
        arcDashAnimateTime={reducedMotion ? 0 : 2400} arcsTransitionDuration={0}
        arcLabel={() => ""}
        onZoom={(view) => {
          if (!container.current) return;
          container.current.dataset.latitude = String(view.lat);
          container.current.dataset.longitude = String(view.lng);
          container.current.dataset.altitude = String(view.altitude);
        }}
        onGlobeReady={() => {
          const instance = globe.current;
          if (!instance) return;
          const controls = instance.controls();
          controls.autoRotate = false;
          controls.enablePan = false;
          controls.enableRotate = true;
          controls.enableZoom = true;
          controls.minDistance = instance.getGlobeRadius() * (1 + MIN_ALTITUDE);
          controls.maxDistance = instance.getGlobeRadius() * (1 + MAX_ALTITUDE);
          instance.renderer().setPixelRatio(Math.min(devicePixelRatio, 2));
          instance.pointOfView(initialView.current, 0);
          setReady(true);
        }}
      />}
    </div>
    <div className="globe-controls" role="group" aria-label="Globe camera controls">
      <button type="button" disabled={!ready} aria-label="Rotate left" title="Rotate left" onClick={() => move(0, -20)}><ArrowLeft size={17} /></button>
      <button type="button" disabled={!ready} aria-label="Rotate right" title="Rotate right" onClick={() => move(0, 20)}><ArrowRight size={17} /></button>
      <button type="button" disabled={!ready} aria-label="Rotate up" title="Rotate up" onClick={() => move(15)}><ArrowUp size={17} /></button>
      <button type="button" disabled={!ready} aria-label="Rotate down" title="Rotate down" onClick={() => move(-15)}><ArrowDown size={17} /></button>
      <span className="globe-control-divider" />
      <button type="button" disabled={!ready} aria-label="Zoom in" title="Zoom in" onClick={() => move(0, 0, 0.7)}><Plus size={17} /></button>
      <button type="button" disabled={!ready} aria-label="Zoom out" title="Zoom out" onClick={() => move(0, 0, 1.4)}><Minus size={17} /></button>
      <button type="button" disabled={!ready} className="globe-reset" onClick={() => globe.current?.pointOfView({ lat: first?.lat ?? 20, lng: first?.lng ?? 0, altitude: 2.5 }, reducedMotion ? 0 : 500)}><RotateCcw size={15} /> Reset</button>
    </div>
    <p id="globe-help" className="globe-help">Drag to rotate · Scroll or pinch to zoom</p>
  </div>;
}
