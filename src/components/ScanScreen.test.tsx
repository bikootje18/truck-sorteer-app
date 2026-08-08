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

describe('ScanScreen (pallet mode)', () => {
  it('teaches an unknown EAN, then shows the pallet card', () => {
    render(<ScanScreen load={load} allLoads={[load]} />);
    scan(EAN);
    expect(screen.getByText('Welk artikel is dit?')).toBeTruthy();
    fireEvent.click(screen.getByText(/MONSTER ULTRA NO/));
    expect(screen.getByText('PALLET A')).toBeTruthy();
    expect(useStore.getState().eanMap[EAN]).toBe('108450');
  });

  it('shows the pallet card for a learned EAN and marks a stack done', () => {
    useStore.setState({ eanMap: { [EAN]: '108450' } });
    render(<ScanScreen load={load} allLoads={[load]} />);
    scan(EAN);
    expect(screen.getByText('PALLET A')).toBeTruthy();
    expect(screen.getByText('STAPEL 7')).toBeTruthy();
    fireEvent.click(screen.getByText('✓ Klaar'));
    expect(useStore.getState().progressByPo['PO1']['PO1:2'].status).toBe('done');
    expect(screen.getByText('↩︎ Ongedaan maken')).toBeTruthy();
    expect(screen.getByText(/Pallet klaar/)).toBeTruthy();
  });

  it('skips the batch picker when both batches share the pallet', () => {
    const two: Load = {
      ...load,
      lines: [mkLine({ id: 'PO1:2', batch: 'AAA' }), mkLine({ id: 'PO1:3', batch: 'BBB', stackNo: 8 })],
    };
    useStore.setState({ eanMap: { [EAN]: '108450' } });
    render(<ScanScreen load={two} allLoads={[two]} />);
    scan(EAN);
    expect(screen.queryByText('Welke batch staat op de tray?')).toBeNull();
    expect(screen.getByText('PALLET A')).toBeTruthy();
    expect(screen.getByText('STAPEL 7')).toBeTruthy();
    expect(screen.getByText('STAPEL 8')).toBeTruthy();
  });

  it('asks for the batch when batches sit on different pallets', () => {
    const two: Load = {
      ...load,
      lines: [
        mkLine({ id: 'PO1:2', batch: 'AAA', inPallet: 'A' }),
        mkLine({ id: 'PO1:3', batch: 'BBB', stackNo: 8, inPallet: 'B' }),
      ],
    };
    useStore.setState({ eanMap: { [EAN]: '108450' } });
    render(<ScanScreen load={two} allLoads={[two]} />);
    scan(EAN);
    expect(screen.getByText('Welke batch staat op de tray?')).toBeTruthy();
    fireEvent.click(screen.getByText('BBB'));
    expect(screen.getByText('PALLET B')).toBeTruthy();
    expect(screen.getByText('STAPEL 8')).toBeTruthy();
  });

  it('warns for a known EAN that is not on this truck', () => {
    useStore.setState({ eanMap: { [EAN]: '999999' } });
    render(<ScanScreen load={load} allLoads={[load]} />);
    scan(EAN);
    expect(screen.getByText('Niet op deze vrachtwagen')).toBeTruthy();
  });

  it('shows the ticked pallet card with a note after a duplicate scan', () => {
    useStore.setState({
      eanMap: { [EAN]: '108450' },
      progressByPo: { PO1: { 'PO1:2': { status: 'done' } } },
    });
    render(<ScanScreen load={load} allLoads={[load]} />);
    scan(EAN);
    expect(screen.getByText('PALLET A')).toBeTruthy();
    expect(screen.getByText(/al afgevinkt/)).toBeTruthy();
  });

  it('supports manual text search in keyboard mode', () => {
    render(<ScanScreen load={load} allLoads={[load]} />);
    fireEvent.click(screen.getByText('⌨ Handmatig'));
    const input = screen.getByLabelText('scaninvoer');
    fireEvent.change(input, { target: { value: 'ultra' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.click(screen.getByText(/MONSTER ULTRA NO/));
    expect(screen.getByText('PALLET A')).toBeTruthy();
  });

  it('records a partial count from a pallet row and keeps field focus', () => {
    useStore.setState({ eanMap: { [EAN]: '108450' } });
    render(<ScanScreen load={load} allLoads={[load]} />);
    scan(EAN);
    fireEvent.click(screen.getByText('Deels…'));
    const num = screen.getByPlaceholderText('Aantal verplaatste trays');
    num.focus();
    fireEvent.click(num);
    expect(document.activeElement).toBe(num);
    fireEvent.change(num, { target: { value: '10' } });
    fireEvent.click(screen.getByText('Opslaan'));
    expect(useStore.getState().progressByPo['PO1']['PO1:2']).toMatchObject({
      status: 'partial', movedCases: 10,
    });
    expect(screen.getByText(/10 verplaatst/)).toBeTruthy();
  });

  it('shows only the scanned line for a Full Pallet (VOL) scan', () => {
    const vol: Load = {
      ...load,
      lines: [
        mkLine({ id: 'PO1:2', inPallet: 'VOL', category: 'Full Pallet', presorted: true }),
        mkLine({ id: 'PO1:9', material: '999998', inPallet: 'VOL', category: 'Full Pallet', presorted: true, stackNo: 9 }),
      ],
    };
    useStore.setState({ eanMap: { [EAN]: '108450' } });
    render(<ScanScreen load={vol} allLoads={[vol]} />);
    scan(EAN);
    expect(screen.getByText('VOLLE PALLET')).toBeTruthy();
    expect(screen.getByText('STAPEL 7')).toBeTruthy();
    expect(screen.queryByText('STAPEL 9')).toBeNull();
  });
});
