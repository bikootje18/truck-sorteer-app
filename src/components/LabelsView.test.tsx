import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import loadsJson from '../data/loads.json';
import type { Load } from '../types';
import LabelsView from './LabelsView';

const loads = loadsJson as Load[];

describe('LabelsView', () => {
  it('renders one label per line of the selected truck', () => {
    render(<LabelsView />);
    // Defaults to the first load (PLZW, 51 lines)
    expect(screen.getAllByText(/^STAPEL \d+$/)).toHaveLength(loads[0].lines.length);
  });

  it('shows batch and THT on the first label', () => {
    render(<LabelsView />);
    expect(screen.getAllByText('241220551').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('20-12-2026').length).toBeGreaterThanOrEqual(1);
  });
});
