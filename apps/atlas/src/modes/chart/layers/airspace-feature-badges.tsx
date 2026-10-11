import { useMap } from '@vis.gl/react-maplibre';
import { MercatorCoordinate } from 'maplibre-gl';
import type { CustomLayerInterface, CustomRenderMethodInput } from 'maplibre-gl';
import { useLayoutEffect, useMemo, useRef } from 'react';
import type { CSSProperties, ReactElement } from 'react';

import { useAirspaceDataset } from '../../../shared/data/airspace-dataset.ts';
import { useChartColors } from '../../../shared/styles/chart-colors.ts';
import { useActiveHighlightRef, useHoveredFeatureIndex } from '../highlight-context.ts';

import {
  extrusionCeilingMeters,
  extrusionExaggerationForZoom,
  quantizeMapZoom,
} from './airspace-extrusion-scale.ts';
import { airspaceBadgeGroups } from './airspace-source-projection.ts';
import type { AirspaceFeatureBadge } from './airspace-source-projection.ts';
import { projectMercatorPoint } from './elevated-projection.ts';
import type { ProjectionFrame } from './elevated-projection.ts';

/**
 * MapLibre layer id of the custom layer that supplies the badge
 * projection. The layer draws nothing; it exists because a custom
 * layer's render arguments are where MapLibre hands out the matrix
 * that projects a location at altitude, and because MapLibre calls it
 * on every frame it paints, which is exactly when badge positions can
 * change.
 */
export const AIRSPACE_BADGE_PROJECTION_LAYER_ID = 'atlas-airspace-badge-projection';

/**
 * Numbered badges for the features of the selected multi-feature
 * airspace (Class B rings, ARTCC strata), one per feature, labelled to
 * match the inspector's "Feature N" sections. Rendered as positioned
 * DOM elements over the map rather than as a MapLibre symbol layer for
 * two reasons: a symbol layer places a polygon's label per tile, so a
 * ring that spans tiles gets a badge wherever the tile boundary cuts
 * it, and a symbol cannot be lifted off the ground, so in the tilted
 * view it would sit on the ground beneath the box it labels. Here each
 * badge is anchored at its polygon's pole of inaccessibility (computed
 * once at projection time) and, whenever the camera is tilted, placed
 * at the box's top-face altitude using the same exaggeration the
 * extrusion layer draws with.
 *
 * The projection comes from MapLibre's custom-layer interface, its
 * documented route into the camera: a no-op custom layer is added to
 * the style and its `render` callback, which MapLibre invokes on every
 * painted frame, receives `defaultProjectionData.mainMatrix`. Each
 * badge's anchor is converted with `MercatorCoordinate.fromLngLat` at
 * the badge's altitude and pushed through that matrix to canvas
 * pixels. Positions are written straight to the DOM from the callback:
 * the camera moves every frame during a gesture, and re-rendering a
 * component per frame buys nothing over updating a transform. React
 * still owns the element set, the labels, the colors, and the hover
 * emphasis.
 *
 * MapLibre drops custom layers when the style is replaced (the theme
 * swap does this), so the layer is re-added on `styledata`, the same
 * way the highlight hatch image is re-registered.
 *
 * Mounted as a sibling of the map canvas inside `MapProvider`, so it
 * reaches the map through `useMap()` like the other chart chrome and
 * sits above the canvas but below every later sibling.
 */
export function AirspaceFeatureBadges(): ReactElement | null {
  const state = useAirspaceDataset();
  const activeRef = useActiveHighlightRef();
  const hoveredFeatureIndex = useHoveredFeatureIndex();
  const colors = useChartColors();
  const map = useMap();
  const mapRef = map.current ?? map.default;

  const badges = useMemo<readonly AirspaceFeatureBadge[] | undefined>(() => {
    if (activeRef?.type !== 'airspace' || activeRef.id.length === 0) {
      return undefined;
    }
    return airspaceBadgeGroups(state)?.get(activeRef.id);
  }, [state, activeRef]);

  const elementsRef = useRef<Array<HTMLSpanElement | null>>([]);

  // Layout effect so the projection layer is in place before the
  // browser paints the freshly mounted (still invisible) badges.
  useLayoutEffect((): (() => void) | undefined => {
    if (mapRef === undefined || badges === undefined) {
      return undefined;
    }
    const m = mapRef.getMap();
    const group = badges;

    function placeBadges(frame: ProjectionFrame): void {
      const exaggeration = extrusionExaggerationForZoom(quantizeMapZoom(m.getZoom()));
      const tilted = m.getPitch() > 0;
      group.forEach((badge, index) => {
        const element = elementsRef.current[index];
        if (element === null || element === undefined) {
          return;
        }
        const elevationMeters = tilted
          ? extrusionCeilingMeters(badge.ceiling, badge.type, exaggeration)
          : 0;
        const point = projectMercatorPoint(
          frame,
          MercatorCoordinate.fromLngLat([badge.anchor[0], badge.anchor[1]], elevationMeters),
        );
        if (point === undefined) {
          element.style.visibility = 'hidden';
          return;
        }
        element.style.visibility = 'visible';
        element.style.transform = `translate(${point.x}px, ${point.y}px) translate(-50%, -50%) translateY(${badge.columnOffsetEm}em)`;
      });
    }

    const projectionLayer: CustomLayerInterface = {
      id: AIRSPACE_BADGE_PROJECTION_LAYER_ID,
      type: 'custom',
      renderingMode: '2d',
      render: (_gl: WebGL2RenderingContext, options: CustomRenderMethodInput): void => {
        const canvas = m.getCanvas();
        placeBadges({
          mainMatrix: options.defaultProjectionData.mainMatrix,
          width: canvas.clientWidth,
          height: canvas.clientHeight,
        });
      },
    };

    function ensureProjectionLayer(): void {
      if (!m.isStyleLoaded() || m.getLayer(AIRSPACE_BADGE_PROJECTION_LAYER_ID) !== undefined) {
        return;
      }
      m.addLayer(projectionLayer);
    }
    ensureProjectionLayer();
    m.on('styledata', ensureProjectionLayer);
    // A new badge set with an unchanged camera still needs one frame to
    // be placed; MapLibre only renders when something asks it to.
    m.triggerRepaint();
    return (): void => {
      m.off('styledata', ensureProjectionLayer);
      if (m.getLayer(AIRSPACE_BADGE_PROJECTION_LAYER_ID) !== undefined) {
        m.removeLayer(AIRSPACE_BADGE_PROJECTION_LAYER_ID);
      }
    };
  }, [mapRef, badges]);

  if (badges === undefined) {
    return null;
  }

  const badgeStyle: CSSProperties = {
    color: colors.airspaceBadge.text,
    backgroundColor: colors.airspaceBadge.halo,
  };

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {badges.map((badge, index) => (
        // The outer span is the positioned element: the render callback
        // writes its transform. The pill and the hover emphasis live on
        // an inner span because the standalone CSS `scale` property
        // composes outside `transform`, so scaling the positioned element
        // would scale its translation and move the badge off its feature.
        <span
          key={badge.featureIndex}
          ref={(element): void => {
            elementsRef.current[index] = element;
          }}
          data-feature-index={badge.featureIndex}
          className="invisible absolute top-0 left-0"
        >
          <span
            className={`block rounded-sm px-1 text-[13px] leading-tight font-bold whitespace-nowrap ${hoveredFeatureIndex === badge.featureIndex ? 'scale-125' : ''}`}
            style={badgeStyle}
          >
            {badge.label}
          </span>
        </span>
      ))}
    </div>
  );
}
