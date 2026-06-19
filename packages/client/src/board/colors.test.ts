import { ColorGroup } from '@monopoly/core';
import { describe, expect, it } from 'vitest';
import { GROUP_COLORS } from './colors.js';

describe('GROUP_COLORS', () => {
  it('defines a colour for every colour group', () => {
    for (const group of Object.values(ColorGroup)) {
      expect(GROUP_COLORS[group]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('uses distinct colours per group', () => {
    const values = Object.values(GROUP_COLORS);
    expect(new Set(values).size).toBe(values.length);
  });
});
