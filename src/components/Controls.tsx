import {
  PITCH_DETENTS,
  PITCH_MAX,
  PITCH_MIN,
  PITCH_SNAP_PCT,
  PITCH_SNAP_RADIUS,
  PITCH_SNAP_TARGET,
  PITCH_STEP,
  VOLUME_DETENTS,
  VOLUME_MAX,
  VOLUME_MIN,
  VOLUME_SNAP_PCT,
  VOLUME_SNAP_RADIUS,
  VOLUME_SNAP_TARGET,
  VOLUME_STEP,
  snapValue,
} from '../lib/interaction.ts'

function DetentLines({ count, testId }: { count: number; testId: string }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          data-testid={testId}
          className="detent-line"
          style={{ left: `${(i / (count - 1)) * 100}%` }}
        />
      ))}
    </>
  )
}

interface DetentSliderProps {
  label: string
  display: string
  value: number
  min: number
  max: number
  step: number
  detents: number
  markerPct: number
  testId: string
  outputTestId: string
  markerTestId: string
  detentTestId: string
  onChange: (value: number) => void
}

function DetentSlider({
  label,
  display,
  value,
  min,
  max,
  step,
  detents,
  markerPct,
  testId,
  outputTestId,
  markerTestId,
  detentTestId,
  onChange,
}: DetentSliderProps) {
  return (
    <label className="slider-label">
      <span>
        {label}: <output data-testid={outputTestId}>{display}</output>
      </span>
      <span className="slider-wrap">
        <span className="slider-track" aria-hidden="true">
          <DetentLines count={detents} testId={detentTestId} />
          <span data-testid={markerTestId} className="snap-marker" style={{ left: `${markerPct}%` }} />
        </span>
        <input
          type="range"
          aria-label={label}
          data-testid={testId}
          className={`slider ${testId}`}
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </span>
    </label>
  )
}

export interface ControlsProps {
  search: string
  onSearchChange: (value: string) => void
  pitch: number
  onPitchChange: (value: number) => void
  volume: number
  onVolumeChange: (value: number) => void
}

export function Controls({
  search,
  onSearchChange,
  pitch,
  onPitchChange,
  volume,
  onVolumeChange,
}: ControlsProps) {
  return (
    <div className="controls">
      <label className="search-label">
        <span>Search</span>
        <input
          type="search"
          aria-label="Search sounds"
          data-testid="search"
          placeholder="Filter sounds…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="search-input"
        />
      </label>

      <DetentSlider
        label="Pitch"
        display={`${pitch.toFixed(1)}x`}
        value={pitch}
        min={PITCH_MIN}
        max={PITCH_MAX}
        step={PITCH_STEP}
        detents={PITCH_DETENTS}
        markerPct={PITCH_SNAP_PCT}
        testId="pitch"
        outputTestId="pitch-value"
        markerTestId="pitch-snap-marker"
        detentTestId="pitch-detent"
        onChange={(v) => onPitchChange(snapValue(v, PITCH_SNAP_TARGET, PITCH_SNAP_RADIUS))}
      />

      <DetentSlider
        label="Volume"
        display={`${volume}%`}
        value={volume}
        min={VOLUME_MIN}
        max={VOLUME_MAX}
        step={VOLUME_STEP}
        detents={VOLUME_DETENTS}
        markerPct={VOLUME_SNAP_PCT}
        testId="volume"
        outputTestId="volume-value"
        markerTestId="volume-snap-marker"
        detentTestId="volume-detent"
        onChange={(v) => onVolumeChange(snapValue(v, VOLUME_SNAP_TARGET, VOLUME_SNAP_RADIUS))}
      />
    </div>
  )
}
