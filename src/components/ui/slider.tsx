"use client";

import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";
import { hapticSelection } from "@/lib/haptics";

interface SliderProps extends React.ComponentProps<typeof SliderPrimitive.Root> {
  showTicks?: boolean;
  tickCount?: number;
  enableHaptics?: boolean;
}

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  step = 1,
  showTicks = false,
  tickCount,
  enableHaptics = true,
  onValueChange,
  ...props
}: SliderProps) {
  const _values = React.useMemo(
    () =>
      Array.isArray(value)
        ? value
        : Array.isArray(defaultValue)
          ? defaultValue
          : [min, max],
    [value, defaultValue, min, max]
  );

  const lastValueRef = React.useRef<number | null>(null);

  const handleValueChange = React.useCallback(
    (newValues: number[]) => {
      const current = newValues[0];
      if (enableHaptics && current !== lastValueRef.current) {
        lastValueRef.current = current;
        void hapticSelection();
      }
      onValueChange?.(newValues);
    },
    [enableHaptics, onValueChange]
  );

  const ticks = React.useMemo(() => {
    if (!showTicks) return [];
    const count = tickCount ?? Math.floor((max - min) / step) + 1;
    if (count <= 1 || count > 20) return [];
    return Array.from({ length: count }, (_, i) => min + i * step);
  }, [showTicks, tickCount, min, max, step]);

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      step={step}
      onValueChange={handleValueChange}
      className={cn(
        "relative flex w-full touch-none select-none items-center py-2.5",
        "data-[disabled]:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col",
        className
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className={cn(
          "relative grow overflow-hidden rounded-full transition-all",
          "bg-[#2a2420]/10 border border-gold/25 shadow-inner",
          "data-[orientation=horizontal]:h-2.5 data-[orientation=horizontal]:w-full",
          "data-[orientation=vertical]:h-full data-[orientation=vertical]:w-2.5"
        )}
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className={cn(
            "absolute gold-grad shadow-[0_0_12px_rgba(201,162,39,0.35)] rounded-full",
            "data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full"
          )}
        />
      </SliderPrimitive.Track>

      {/* Discrete tick notches */}
      {showTicks && ticks.length > 0 && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 flex justify-between px-2"
        >
          {ticks.map((t) => {
            const currentVal = _values[0] ?? min;
            const isFilled = t <= currentVal;
            return (
              <span
                key={t}
                className={cn(
                  "h-1.5 w-1.5 rounded-full transition-colors",
                  isFilled
                    ? "bg-charcoal/50"
                    : "bg-gold/40"
                )}
              />
            );
          })}
        </div>
      )}

      {Array.from({ length: _values.length }, (_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          className={cn(
            "relative block size-5 sm:size-5.5 shrink-0 rounded-full",
            "bg-cream border-2 border-gold shadow-[0_2px_10px_rgba(42,36,32,0.18)]",
            "ring-gold/30 hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden",
            "transition-transform duration-150 ease-out",
            "hover:scale-110 active:scale-125",
            "disabled:pointer-events-none disabled:opacity-50",
            // 48px touch target hitzone for mobile accessibility
            "before:absolute before:-inset-3 before:rounded-full before:content-['']"
          )}
        >
          {/* Subtle gold center pip inside thumb */}
          <span className="absolute inset-1 rounded-full bg-gold/30 pointer-events-none" />
        </SliderPrimitive.Thumb>
      ))}
    </SliderPrimitive.Root>
  );
}

export { Slider };
