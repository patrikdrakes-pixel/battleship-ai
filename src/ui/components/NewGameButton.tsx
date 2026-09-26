export interface NewGameButtonProps {
  readonly onClick: () => void;
}

export function NewGameButton({ onClick }: NewGameButtonProps) {
  return (
    <button type="button" className="new-game" onClick={onClick}>
      New game
    </button>
  );
}
