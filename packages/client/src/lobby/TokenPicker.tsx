import { t, TOKEN_COLORS, TOKENS, type Token } from '@monopoly/core';

interface TokenPickerProps {
  selected: string | null;
  taken: ReadonlySet<string>;
  onSelect: (tokenId: string) => void;
}

export function TokenPicker({ selected, taken, onSelect }: TokenPickerProps) {
  return (
    <div className="token-picker">
      {TOKENS.map((token) => (
        <TokenChip
          key={token.id}
          token={token}
          isSelected={selected === token.id}
          isTaken={taken.has(token.id)}
          onClick={() => onSelect(token.id)}
        />
      ))}
    </div>
  );
}

interface ColorPickerProps {
  selected: string | null;
  onSelect: (color: string) => void;
}

export function ColorPicker({ selected, onSelect }: ColorPickerProps) {
  return (
    <div className="color-picker">
      {TOKEN_COLORS.map((color) => {
        const className = [
          'color-swatch',
          selected === color && 'color-swatch--selected',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <button
            key={color}
            type="button"
            className={className}
            style={{ backgroundColor: color }}
            onClick={() => onSelect(color)}
            aria-label={color}
            aria-pressed={selected === color}
          />
        );
      })}
    </div>
  );
}

interface TokenChipProps {
  token: Token;
  isSelected: boolean;
  isTaken: boolean;
  onClick: () => void;
}

function TokenChip({ token, isSelected, isTaken, onClick }: TokenChipProps) {
  const className = [
    'token-chip',
    isSelected && 'token-chip--selected',
    isTaken && 'token-chip--taken',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      disabled={isTaken && !isSelected}
      style={{ borderColor: isSelected ? token.color : undefined }}
      title={t(token.nameKey)}
    >
      <span className="token-chip__symbol">{token.symbol}</span>
      <span className="token-chip__name">{t(token.nameKey)}</span>
    </button>
  );
}
