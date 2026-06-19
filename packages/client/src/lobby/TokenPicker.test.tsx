import { TOKEN_COLORS, TOKENS, t } from '@monopoly/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ColorPicker, TokenPicker } from './TokenPicker.js';

describe('TokenPicker', () => {
  it('renders a chip for every token', () => {
    render(<TokenPicker selected={null} taken={new Set()} onSelect={() => {}} />);
    for (const token of TOKENS) {
      expect(screen.getByTitle(t(token.nameKey))).toBeTruthy();
    }
  });

  it('calls onSelect with the token id when clicked', () => {
    const onSelect = vi.fn();
    render(<TokenPicker selected={null} taken={new Set()} onSelect={onSelect} />);
    fireEvent.click(screen.getByTitle(t('token.hat')));
    expect(onSelect).toHaveBeenCalledWith('hat');
  });

  it('disables a taken chip that is not the current selection', () => {
    render(<TokenPicker selected={null} taken={new Set(['car'])} onSelect={() => {}} />);
    expect(screen.getByTitle(t('token.car')).hasAttribute('disabled')).toBe(true);
    expect(screen.getByTitle(t('token.hat')).hasAttribute('disabled')).toBe(false);
  });

  it('keeps the selected chip enabled even if marked taken', () => {
    render(<TokenPicker selected={'car'} taken={new Set(['car'])} onSelect={() => {}} />);
    const chip = screen.getByTitle(t('token.car'));
    expect(chip.hasAttribute('disabled')).toBe(false);
    expect(chip.className).toContain('token-chip--selected');
  });
});

describe('ColorPicker', () => {
  it('renders a swatch for every palette color', () => {
    render(<ColorPicker selected={null} onSelect={() => {}} />);
    for (const color of TOKEN_COLORS) {
      expect(screen.getByLabelText(color)).toBeTruthy();
    }
  });

  it('calls onSelect with the color when clicked', () => {
    const onSelect = vi.fn();
    render(<ColorPicker selected={null} onSelect={onSelect} />);
    fireEvent.click(screen.getByLabelText(TOKEN_COLORS[1]!));
    expect(onSelect).toHaveBeenCalledWith(TOKEN_COLORS[1]);
  });

  it('marks the selected swatch as pressed', () => {
    render(<ColorPicker selected={TOKEN_COLORS[0]!} onSelect={() => {}} />);
    const swatch = screen.getByLabelText(TOKEN_COLORS[0]!);
    expect(swatch.getAttribute('aria-pressed')).toBe('true');
    expect(swatch.className).toContain('color-swatch--selected');
  });
});
