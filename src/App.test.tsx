import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import App from './App';
import { useStore } from './store';

beforeEach(() => {
  localStorage.clear();
  useStore.setState({ activePo: null, view: 'scan' });
});

describe('App', () => {
  it('renders the three Dutch nav tabs', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: 'Sorteren' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Overzicht' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Instellingen' })).toBeTruthy();
  });

  it('defaults to the first load when none is selected', () => {
    render(<App />);
    expect(screen.getByText(/RDS014871-PLZW22L24/)).toBeTruthy();
  });
});
