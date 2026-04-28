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
  const navigationRef = useRef(null);
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
      const navigationVisible = isRectVisible(navigationRef.current?.getBoundingClientRect?.() || null, topOffset);
      const timerVisible = isRectVisible(timerRef.current?.getBoundingClientRect?.() || null, topOffset);

      setShouldShowDock(hasScrolledPastHeader && (!navigationVisible || !timerVisible));
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
    navigationRef,
    shouldShowDock,
    timerRef,
  };
}

export default function FloatingTestDock({
  ariaLabel,
  items,
  note,
  onSelectItem,
  stats,
  title,
  visible,
}) {
  if (!visible || !Array.isArray(items) || items.length === 0) {
    return null;
  }

  return (
    <div className="test-floating-dock" role="complementary" aria-label={ariaLabel}>
      <div className="test-floating-dock-shell">
        <div className="test-floating-dock-head">
          <div className="test-floating-dock-copy">
            <p className="test-floating-dock-kicker">{title}</p>
            {note ? <p className="test-floating-dock-note">{note}</p> : null}
          </div>

          {Array.isArray(stats) && stats.length > 0 && (
            <div className="test-floating-dock-stats">
              {stats.map((stat) => (
                <div
                  key={`${stat.label}-${stat.value}`}
                  className={[
                    'test-floating-dock-stat',
                    stat.tone ? `test-floating-dock-stat-${stat.tone}` : '',
                  ].filter(Boolean).join(' ')}
                >
                  <span>{stat.label}</span>
                  <strong>{stat.value}</strong>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="test-floating-dock-strip" role="tablist" aria-label={ariaLabel}>
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectItem(item.id)}
              className={[
                'test-nav-chip',
                'test-nav-chip-button',
                item.status === 'current'
                  ? 'test-nav-chip-current'
                  : item.status === 'done'
                  ? 'test-nav-chip-done'
                  : 'test-nav-chip-empty',
                item.review ? 'test-nav-chip-review' : '',
              ].filter(Boolean).join(' ')}
              aria-label={item.ariaLabel}
              title={item.title}
            >
              {item.label}
              {item.review ? <span className="test-nav-chip-flag" aria-hidden="true" /> : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
