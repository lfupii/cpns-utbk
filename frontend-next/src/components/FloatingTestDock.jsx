"use client";
import React, { useEffect, useRef, useState } from 'react';

const TABLET_BREAKPOINT_QUERY = '(max-width: 1024px)';

function isRectVisible(rect, topOffset) {
  if (!rect || typeof window === 'undefined') {
    return false;
  }

  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  return rect.bottom > topOffset && rect.top < (viewportHeight - 24);
}

export function useFloatingTestDock(enabled) {
  const timerRef = useRef(null);
  const [isCompactViewport, setIsCompactViewport] = useState(false);
  const [shouldShowDock, setShouldShowDock] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const mediaQuery = window.matchMedia(TABLET_BREAKPOINT_QUERY);
    const syncViewportMode = () => {
      setIsCompactViewport(mediaQuery.matches);
    };

    syncViewportMode();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', syncViewportMode);
      return () => mediaQuery.removeEventListener('change', syncViewportMode);
    }

    mediaQuery.addListener(syncViewportMode);
    return () => mediaQuery.removeListener(syncViewportMode);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    if (!enabled || !isCompactViewport) {
      setShouldShowDock(false);
      return undefined;
    }

    let animationFrameId = 0;

    const updateVisibility = () => {
      animationFrameId = 0;
      const topOffset = 96;
      const hasScrolledPastHeader = window.scrollY > 160;
      const timerVisible = isRectVisible(timerRef.current?.getBoundingClientRect?.() || null, topOffset);

      setShouldShowDock(hasScrolledPastHeader && !timerVisible);
    };

    const requestVisibilityUpdate = () => {
      if (animationFrameId) {
        return;
      }

      animationFrameId = window.requestAnimationFrame(updateVisibility);
    };

    requestVisibilityUpdate();
    window.addEventListener('scroll', requestVisibilityUpdate, { passive: true });
    window.addEventListener('resize', requestVisibilityUpdate);

    return () => {
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
      }
      window.removeEventListener('scroll', requestVisibilityUpdate);
      window.removeEventListener('resize', requestVisibilityUpdate);
    };
  }, [enabled, isCompactViewport]);

  return {
    isCompactViewport,
    shouldShowDock,
    timerRef,
  };
}

export default function FloatingTestDock({
  ariaLabel,
  stat,
  visible,
}) {
  if (!visible || !stat?.label || !stat?.value) {
    return null;
  }

  return (
    <div className="test-floating-dock" role="complementary" aria-label={ariaLabel}>
      <div className="test-floating-dock-shell">
        <div
          className={[
            'test-floating-dock-stat',
            'test-floating-dock-stat-single',
            stat.tone ? `test-floating-dock-stat-${stat.tone}` : '',
          ].filter(Boolean).join(' ')}
        >
          <span>{stat.label}</span>
          <strong>{stat.value}</strong>
        </div>
      </div>
    </div>
  );
}
