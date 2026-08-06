import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useStore } from '../store';
import type { Line, Load } from '../types';
import SettingsScreen from './SettingsScreen';

const mkLine = (over: Partial<Line>): Line => ({
  id: 'PO1:2', stackNo: 1, material: '108450',
  description: 'MONSTER ULTRA NO 24/500ML V2', batch: '241220551',
  bbd: '2026-12-20', cases: 25, inPallet: 'A', inPalletNo: 1,
  category: 'Rainbow Pallet', presorted: false, ...over,
});
const loads: Load[] = [
  { po: 'PO1', plant: 'Plant 1', customer: 'C', lines: [mkLine({})] },
  { po: 'PO2', plant: 'Plant 2', customer: 'C', lines: [mkLine({ id: 'PO2:2' })] },
];

beforeEach(() => {
  localStorage.clear();
  useStore.setState({ progressByPo: {}, eanMap: {}, lastUndo: null, activePo: 'PO1', view: 'settings' });
});

describe('SettingsScreen', () => {
  it('switches the active truck', () => {
    render(<SettingsScreen loads={loads} load={loads[0]} />);
    fireEvent.click(screen.getByText(/PO2/));
    expect(useStore.getState().activePo).toBe('PO2');
  });

  it('lists learned barcodes and can unlearn one', () => {
    useStore.setState({ eanMap: { '5449000123457': '108450' } });
    render(<SettingsScreen loads={loads} load={loads[0]} />);
    expect(screen.getByText('5449000123457')).toBeTruthy();
    fireEvent.click(screen.getByText('Verwijder'));
    expect(useStore.getState().eanMap['5449000123457']).toBeUndefined();
  });

  it('resets progress after confirmation', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    useStore.setState({ progressByPo: { PO1: { 'PO1:2': { status: 'done' } } } });
    render(<SettingsScreen loads={loads} load={loads[0]} />);
    fireEvent.click(screen.getByText('Voortgang wissen'));
    expect(useStore.getState().progressByPo['PO1']).toEqual({});
  });
});
