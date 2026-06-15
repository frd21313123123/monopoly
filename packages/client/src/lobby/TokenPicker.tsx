import { t, TOKENS, type Token } from '@monopoly/core';

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
