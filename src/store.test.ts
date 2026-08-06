import { beforeEach, describe, expect, it } from 'vitest';
import { useStore } from './store';

const PO = 'PO1';
const LINE = 'PO1:2';

beforeEach(() => {
  localStorage.clear();
  useStore.setState({ progressByPo: {}, eanMap: {}, lastUndo: null, activePo: null, view: 'scan' });
});

describe('progress actions', () => {
  it('marks a line done with a timestamp', () => {
    useStore.getState().markDone(PO, LINE);
    const p = useStore.getState().progressByPo[PO][LINE];
    expect(p.status).toBe('done');
    expect(p.doneAt).toBeTruthy();
  });

  it('marks a line partial with a moved count', () => {
    useStore.getState().markPartial(PO, LINE, 10);
    expect(useStore.getState().progressByPo[PO][LINE]).toMatchObject({
      status: 'partial', movedCases: 10,
    });
  });

  it('toggles open -> done -> open', () => {
    useStore.getState().toggleLine(PO, LINE);
    expect(useStore.getState().progressByPo[PO][LINE].status).toBe('done');
    useStore.getState().toggleLine(PO, LINE);
    expect(useStore.getState().progressByPo[PO][LINE]).toBeUndefined();
  });

  it('undo restores the previous state of the last change', () => {
    useStore.getState().markPartial(PO, LINE, 5);
    useStore.getState().markDone(PO, LINE);
    useStore.getState().undo();
    expect(useStore.getState().progressByPo[PO][LINE]).toMatchObject({
      status: 'partial', movedCases: 5,
    });
    expect(useStore.getState().lastUndo).toBeNull();
  });

  it('undo after the first change restores "open" (no entry)', () => {
    useStore.getState().markDone(PO, LINE);
    useStore.getState().undo();
    expect(useStore.getState().progressByPo[PO]?.[LINE]).toBeUndefined();
  });

  it('resetProgress clears one truck only', () => {
    useStore.getState().markDone(PO, LINE);
    useStore.getState().markDone('PO2', 'PO2:5');
    useStore.getState().resetProgress(PO);
    expect(useStore.getState().progressByPo[PO]).toEqual({});
    expect(useStore.getState().progressByPo['PO2']['PO2:5'].status).toBe('done');
  });
});

describe('EAN map actions', () => {
  it('learns a canonicalised EAN', () => {
    useStore.getState().learnEan('05449000123457', '108450');
    expect(useStore.getState().eanMap['5449000123457']).toBe('108450');
  });

  it('unlearns an EAN', () => {
    useStore.getState().learnEan('5449000123457', '108450');
    useStore.getState().unlearnEan('5449000123457');
    expect(useStore.getState().eanMap['5449000123457']).toBeUndefined();
  });
});
