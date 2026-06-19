import { describe, expect, it } from 'vitest';
import { ru, t } from './i18n/ru.js';

describe('t — basic lookup', () => {
  it('returns the string for a known key', () => {
    expect(t('tile.go')).toBe('СТАРТ');
  });

  it('returns the key itself when unknown', () => {
    expect(t('does.not.exist')).toBe('does.not.exist');
  });
});

describe('t — interpolation', () => {
  it('substitutes named params', () => {
    expect(t('game.winner', { name: 'Алиса' })).toBe('Победил: Алиса');
  });

  it('substitutes numbers', () => {
    expect(t('lobby.maxPlayers', { max: 8 })).toBe('Максимум 8 игроков');
  });

  it('leaves the placeholder when a param is missing', () => {
    expect(t('game.winner', {})).toBe('Победил: {name}');
  });

  it('handles multiple placeholders', () => {
    expect(t('log.rolled', { name: 'Боб', a: 3, b: 4, sum: 7 })).toBe(
      'Боб бросает: 3 + 4 = 7',
    );
  });
});

describe('t — nested key resolution', () => {
  it('recursively translates tile.* param values', () => {
    expect(t('log.bought', { name: 'Алиса', tile: 'tile.marosejka', price: 60 })).toBe(
      'Алиса купил «Маросейка» за ₽60',
    );
  });

  it('recursively translates card.* param values', () => {
    const text = t('log.drewChance', { name: 'Боб', text: 'card.chance.advanceToGo' });
    expect(text).toContain('Перейдите на «СТАРТ». Получите ₽200');
  });

  it('does not recurse into plain string params', () => {
    expect(t('game.winner', { name: 'just text' })).toBe('Победил: just text');
  });
});

describe('ru dictionary', () => {
  it('every value is a non-empty string', () => {
    for (const [key, value] of Object.entries(ru)) {
      expect(typeof value, key).toBe('string');
      expect(value.length, key).toBeGreaterThan(0);
    }
  });
});
