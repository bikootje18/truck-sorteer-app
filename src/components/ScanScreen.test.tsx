import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useStore } from '../store';
import type { Line, Load } from '../types';
import ScanScreen from './ScanScreen';

const mkLine = (over: Partial<Line>): Line => ({
  id: 'PO1:2', stackNo: 7, material: '108450',
  description: 'MONSTER ULTRA NO 24/500ML V2', batch: '241220551',
  bbd: '2026-12-20', cases: 25, inPallet: 'A', inPalletNo: 1,
  category: 'Rainbow Pallet', presorted: false, ...over,
});
const load: Load = { po: 'PO1', plant: 'Plant', customer: 'Cust', lines: [mkLine({})] };
const EAN = '5449000123457';

function scan(value: string) {
  const input = screen.getByLabelText('scaninvoer');
  fireEvent.change(input, { target: { value } });
  fireEvent.keyDown(input, { key: 'Enter' });
}

beforeEach(() => {
  localStorage.clear();
  useStore.setState({ progressByPo: {}, eanMap: {}, lastUndo: null, activePo: 'PO1', view: 'scan' });
});

describe('ScanScreen', () => {
  it('teaches an unknown EAN, then shows the destination', () => {
    render(<ScanScreen load={load} allLoads={[load]} />);
    scan(EAN);
    expect(screen.getByText('Welk artikel is dit?')).toBeTruthy();
    fireEvent.click(screen.getByText(/MONSTER ULTRA NO/));
    expect(screen.getByText('STAPEL 7')).toBeTruthy();
    expect(useStore.getState().eanMap[EAN]).toBe('108450');
  });

  it('shows destination directly for a learned EAN and marks done on confirm', () => {
    useStore.setState({ eanMap: { [EAN]: '108450' } });
    render(<ScanScreen load={load} allLoads={[load]} />);
    scan(EAN);
    expect(screen.getByText('STAPEL 7')).toBeTruthy();
    fireEvent.click(screen.getByText('✓ Alles verplaatst'));
    expect(useStore.getState().progressByPo['PO1']['PO1:2'].status).toBe('done');
    expect(screen.getByText('↩︎ Ongedaan maken')).toBeTruthy();
  });

  it('offers the batch picker when two batches are open', () => {
    const two: Load = {
      ...load,
      lines: [mkLine({ id: 'PO1:2', batch: 'AAA' }), mkLine({ id: 'PO1:3', batch: 'BBB', stackNo: 8 })],
    };
    useStore.setState({ eanMap: { [EAN]: '108450' } });
    render(<ScanScreen load={two} allLoads={[two]} />);
    scan(EAN);
    expect(screen.getByText('Welke batch staat op de tray?')).toBeTruthy();
    fireEvent.click(screen.getByText('BBB'));
    expect(screen.getByText('STAPEL 8')).toBeTruthy();
  });

  it('warns for a known EAN that is not on this truck', () => {
    useStore.setState({ eanMap: { [EAN]: '999999' } });
    render(<ScanScreen load={load} allLoads={[load]} />);
    scan(EAN);
    expect(screen.getByText('Niet op deze vrachtwagen')).toBeTruthy();
  });

  it('warns when the stack was already completed', () => {
    useStore.setState({
      eanMap: { [EAN]: '108450' },
      progressByPo: { PO1: { 'PO1:2': { status: 'done' } } },
    });
    render(<ScanScreen load={load} allLoads={[load]} />);
    scan(EAN);
    expect(screen.getByText(/was al klaar/)).toBeTruthy();
  });

  it('supports manual text search in keyboard mode', () => {
    render(<ScanScreen load={load} allLoads={[load]} />);
    fireEvent.click(screen.getByText('⌨ Handmatig'));
    const input = screen.getByLabelText('scaninvoer');
    fireEvent.change(input, { target: { value: 'ultra' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.click(screen.getByText(/MONSTER ULTRA NO/));
    expect(screen.getByText('STAPEL 7')).toBeTruthy();
  });
});
