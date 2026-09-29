export interface MuteToggleProps {
  readonly muted: boolean;
  readonly onToggle: () => void;
}

export function MuteToggle({ muted, onToggle }: MuteToggleProps) {
  return (
    <button
      type="button"
      className="button"
      data-testid="mute-toggle"
      aria-pressed={muted}
      onClick={onToggle}
    >
      {muted ? 'Sound off' : 'Sound on'}
    </button>
  );
}
