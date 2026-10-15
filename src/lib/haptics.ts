/**
 * Astrovia Tactile Micro-Haptics Engine.
 *
 * Provides subtle, pressure/duration-sensitive tactile micro-feedback using
 * @capacitor/haptics. Every call degrades gracefully to a silent no-op or
 * micro-vibration on standard browsers.
 *
 * Micro-Haptic Tiers:
 *   • Light (<150ms tap): crisp mechanical tick for buttons, chips, tabs
 *   • Medium (150ms–400ms): solid confirmation for saves, toggles, form actions
 *   • Heavy (>400ms hold): deep deliberate engagement for card holds, resets
 *   • SelectionChanged: ultra-short tick for slider notches and picker dials
 *   • Success / Warning: subtle double-tick notification feedback
 */

import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

export function isHapticsAvailable(): boolean {
  return typeof window !== 'undefined' && Capacitor.isPluginAvailable('Haptics');
}

/** Crisp light micro-click (<150ms taps, tab switches, chips). */
export async function hapticLight(): Promise<void> {
  try {
    if (isHapticsAvailable()) {
      await Haptics.impact({ style: ImpactStyle.Light });
    } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(8);
    }
  } catch {
    /* ignore fallback errors */
  }
}

/** Medium confirmation (button submissions, toggles). */
export async function hapticMedium(): Promise<void> {
  try {
    if (isHapticsAvailable()) {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(18);
    }
  } catch {
    /* ignore fallback errors */
  }
}

/** Heavy engagement (long-press actions, critical actions). */
export async function hapticHeavy(): Promise<void> {
  try {
    if (isHapticsAvailable()) {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(30);
    }
  } catch {
    /* ignore fallback errors */
  }
}

/** Ultra-short notch tick for sliders, steppers, and wheel pickers. */
export async function hapticSelection(): Promise<void> {
  try {
    if (isHapticsAvailable()) {
      await Haptics.selectionChanged();
    } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(5);
    }
  } catch {
    /* ignore fallback errors */
  }
}

/** Notification success feedback (saved check-in, generated chart). */
export async function hapticSuccess(): Promise<void> {
  try {
    if (isHapticsAvailable()) {
      await Haptics.notification({ type: NotificationType.Success });
    } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([12, 40, 16]);
    }
  } catch {
    /* ignore fallback errors */
  }
}

/**
 * Pressure & duration-aware press handler.
 * Measures how long the user held the touch/mouse before release, and triggers
 * a corresponding light, medium, or heavy haptic click upon release.
 */
export function createPressurePressHandlers(
  onPress?: () => void,
  options?: {
    lightThresholdMs?: number;
    mediumThresholdMs?: number;
  },
) {
  let pressStartTime = 0;
  const lightThreshold = options?.lightThresholdMs ?? 150;
  const mediumThreshold = options?.mediumThresholdMs ?? 400;

  const onPointerDown = () => {
    pressStartTime = Date.now();
  };

  const onPointerUp = () => {
    if (!pressStartTime) return;
    const duration = Date.now() - pressStartTime;
    pressStartTime = 0;

    if (duration > mediumThreshold) {
      void hapticHeavy();
    } else if (duration > lightThreshold) {
      void hapticMedium();
    } else {
      void hapticLight();
    }

    onPress?.();
  };

  const onPointerCancel = () => {
    pressStartTime = 0;
  };

  return {
    onPointerDown,
    onPointerUp,
    onPointerCancel,
  };
}
