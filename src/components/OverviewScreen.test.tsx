import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useStore } from '../store';
import type { Line, Load } from '../types';
import OverviewScreen from './OverviewScreen';

const mkLine = (over: Partial<Line>): Line => ({
  id: 'PO1:2', stackNo: 1, material: '108450',
  description: 'MONSTER ULTRA NO 24/500ML V2', batch: '241220551',
  bbd: '2026-12-20', cases: 25, inPallet: 'A', inPalletNo: 1,
  category: 'Rainbow Pallet', presorted: false, ...over,
});
const load: Load = {
  po: 'PO1', plant: 'Plant', customer: 'Cust',
  lines: [
    mkLine({ id: 'PO1:2', stackNo: 1, inPallet: 'A' }),
    mkLine({ id: 'PO1:3', stackNo: 2, inPallet: 'A', batch: 'BBB' }),
    mkLine({ id: 'PO1:4', stackNo: 3, inPallet: 'B', material: '115047', description: 'MONSTER JUICE BAD APPLE', batch: 'CCC', presorted: true }),
  ],
};

beforeEach(() => {
  localStorage.clear();
  useStore.setState({ progressByPo: {}, eanMap: {}, lastUndo: null, activePo: 'PO1', view: 'overview' });
});

describe('OverviewScreen', () => {
  it('groups per incoming pallet with a progress header', () => {
    render(<OverviewScreen load={load} />);
    expect(screen.getByText('0/3 stapels klaar')).toBeTruthy();
    expect(screen.getByText('Pallet A · 0/2 klaar')).toBeTruthy();
    expect(screen.getByText('Pallet B · 0/1 klaar')).toBeTruthy();
  });

  it('shows the presorted badge', () => {
    render(<OverviewScreen load={load} />);
    expect(screen.getByText('alleen label')).toBeTruthy();
  });

  it('toggles a line by tapping it', () => {
    render(<OverviewScreen load={load} />);
    fireEvent.click(screen.getByText(/MONSTER JUICE BAD APPLE/));
    expect(useStore.getState().progressByPo['PO1']['PO1:4'].status).toBe('done');
    expect(screen.getByText('1/3 stapels klaar')).toBeTruthy();
  });

  it('filters to open lines only', () => {
    useStore.setState({ progressByPo: { PO1: { 'PO1:2': { status: 'done' } } } });
    render(<OverviewScreen load={load} />);
    fireEvent.click(screen.getByText('Nog te doen'));
    expect(screen.queryByText(/241220551/)).toBeNull();
    expect(screen.getByText(/BBB/)).toBeTruthy();
  });

  it('can group per stack instead', () => {
    render(<OverviewScreen load={load} />);
    fireEvent.click(screen.getByText('Per stapel'));
    expect(screen.getByText('Stapel 1 · 0/1 klaar')).toBeTruthy();
    expect(screen.getByText('Stapel 3 · 0/1 klaar')).toBeTruthy();
  });
});
