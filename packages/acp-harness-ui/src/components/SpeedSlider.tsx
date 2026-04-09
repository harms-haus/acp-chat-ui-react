import { useRef, useEffect, useCallback } from "react";
import { Slider } from "@base-ui-components/react/slider";

interface SpeedSliderProps {
  value: number;
  onChange: (speed: number) => void;
}

export function SpeedSlider({ value, onChange }: SpeedSliderProps) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleValueChange = useCallback(
    (newValue: number) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        onChange(newValue);
      }, 50);
    },
    [onChange]
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <span style={{ color: "var(--harness-muted)", fontSize: "11px" }}>
          Speed
        </span>
        <span style={{ color: "var(--harness-accent)", fontSize: "12px" }}>
          {value} TPS
        </span>
      </div>
      <Slider.Root
        min={10}
        max={200}
        step={1}
        value={value}
        onValueChange={handleValueChange}
        style={{ width: "100%" }}
      >
        <Slider.Control>
          <Slider.Track
            style={{
              position: "relative",
              height: "4px",
              width: "100%",
              backgroundColor: "var(--harness-card-bg)",
              borderRadius: "2px",
            }}
          >
            <Slider.Indicator
              style={{
                position: "absolute",
                height: "100%",
                backgroundColor: "var(--harness-accent)",
                borderRadius: "2px",
              }}
            />
            <Slider.Thumb
              aria-label="Replay speed"
              style={{
                position: "absolute",
                width: "12px",
                height: "12px",
                backgroundColor: "var(--harness-accent)",
                borderRadius: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
                cursor: "pointer",
                border: "none",
              }}
              data-slider-thumb
            />
          </Slider.Track>
        </Slider.Control>
      </Slider.Root>
    </div>
  );
}
