// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { InputSpec } from '@flamapy/ide-plugin-api';

import { argsFromDraft, MAX_RENDERED_ROWS, OperationForm, OperationResultView, resultText } from './OperationUi';

afterEach(cleanup);

const inputs: InputSpec[] = [
  { name: 'size', kind: 'integer', label: 'Size', min: 1, default: 5, required: true },
  { name: 'note', kind: 'string', label: 'Note' },
  { name: 'exact', kind: 'boolean', label: 'Exact', default: true },
  { name: 'feature', kind: 'feature', label: 'Feature', required: true },
  { name: 'criteria', kind: 'attributes', label: 'Criteria' },
];

describe('argsFromDraft', () => {
  it('types the values and leaves out empty optional ones', () => {
    expect(
      argsFromDraft(inputs, { size: '3', note: '', exact: false, feature: 'GPS', criteria: ['Battery'] }),
    ).toEqual({ args: { size: 3, exact: false, feature: 'GPS', criteria: ['Battery'] } });
  });

  it('reports missing, malformed and out-of-range values', () => {
    const base = { size: '3', note: '', exact: false, feature: 'GPS', criteria: [] };
    expect(argsFromDraft(inputs, { ...base, feature: '' })).toEqual({ problem: 'Feature is required.' });
    expect(argsFromDraft(inputs, { ...base, size: '2.5' })).toEqual({ problem: 'Size must be a whole number.' });
    expect(argsFromDraft(inputs, { ...base, size: '0' })).toEqual({ problem: 'Size must be between 1 and ∞.' });
  });
});

describe('OperationForm', () => {
  it('renders a field per input with defaults and submits typed args', () => {
    const onSubmit = vi.fn();
    render(
      <OperationForm
        title="Optimise"
        inputs={inputs}
        choices={{ features: ['Root', 'GPS'], attributes: ['Battery', 'Price'] }}
        onSubmit={onSubmit}
        onCancel={() => {}}
      />,
    );
    expect((screen.getByLabelText(/Size/) as HTMLInputElement).value).toBe('5');
    fireEvent.click(screen.getByRole('button', { name: 'Run' }));
    expect(screen.getByRole('alert').textContent).toBe('Feature is required.');

    fireEvent.change(screen.getByLabelText(/Feature/), { target: { value: 'GPS' } });
    fireEvent.click(screen.getByLabelText('Price'));
    fireEvent.click(screen.getByRole('button', { name: 'Run' }));
    expect(onSubmit).toHaveBeenCalledWith({ size: 5, exact: true, feature: 'GPS', criteria: ['Price'] });
  });
});

describe('OperationResultView', () => {
  it('renders tables and configurations', () => {
    const { container, rerender } = render(
      <OperationResultView result={{ kind: 'table', columns: ['#', 'Feature'], rows: [[1, 'GPS']] }} />,
    );
    expect(container.querySelectorAll('th')).toHaveLength(2);
    expect(container.querySelector('td:last-child')?.textContent).toBe('GPS');
    rerender(
      <OperationResultView
        result={{ kind: 'configuration', selected: ['Root', 'GPS'], deselected: [], meta: { objective: 0.09 } }}
      />,
    );
    expect(container.textContent).toContain('objective: 0.09');
    expect(container.textContent).toContain('Selected (2)');
    expect([...container.querySelectorAll('.font-mono')].map((chip) => chip.textContent)).toEqual(['Root', 'GPS']);
  });

  it('numbers a list of configurations and says when there are none', () => {
    const { container, rerender } = render(
      <OperationResultView
        result={{ kind: 'configurations', configurations: [{ selected: ['Root'] }, { selected: ['Root', 'GPS'] }] }}
      />,
    );
    expect(container.textContent).toContain('2 configurations');
    expect([...container.querySelectorAll('li')].map((row) => row.textContent)).toEqual(['#1Root1', '#2RootGPS2']);
    rerender(<OperationResultView result={{ kind: 'configurations', configurations: [] }} />);
    expect(container.textContent).toBe('No configurations.');
    rerender(<OperationResultView result={{ kind: 'table', columns: ['Dead features'], rows: [] }} />);
    expect(container.textContent).toBe('No results.');
    // A one-column table is a plain list: no header, one chip per row.
    rerender(<OperationResultView result={{ kind: 'table', columns: ['Core features'], rows: [['Car'], ['Engine']] }} />);
    expect(container.querySelector('table')).toBeNull();
    expect(container.textContent).toBe('2 resultsCarEngine');
  });

  it('renders at most MAX_RENDERED_ROWS rows and counts the rest', () => {
    const rows = Array.from({ length: MAX_RENDERED_ROWS + 3 }, (_, i) => [i, i + 0.123456789]);
    const { container } = render(<OperationResultView result={{ kind: 'table', columns: ['#', 'Value'], rows }} />);
    expect(container.querySelectorAll('tbody tr')).toHaveLength(MAX_RENDERED_ROWS);
    expect(container.querySelector('td:last-child')?.textContent).toBe('0.123457');
    expect(container.textContent).toContain(`${MAX_RENDERED_ROWS + 3} results`);
    expect(container.textContent).toContain('… and 3 more, not shown.');
  });
});

describe('resultText', () => {
  it('copies tables tab-separated, lists and configurations one per line, all rows', () => {
    const rows = Array.from({ length: MAX_RENDERED_ROWS + 1 }, (_, i) => [`F${i}`, i / 3]);
    const table = resultText({ kind: 'table', columns: ['Name', 'Probability'], rows }).split('\n');
    expect(table).toHaveLength(MAX_RENDERED_ROWS + 2); // header + every row, not capped
    expect(table.slice(0, 2)).toEqual(['Name\tProbability', 'F0\t0']);
    expect(table[2]).toBe(`F1\t${1 / 3}`); // full precision
    expect(resultText({ kind: 'table', columns: ['Core features'], rows: [['Car'], ['Engine']] })).toBe('Car\nEngine');
    expect(
      resultText({ kind: 'configurations', configurations: [{ selected: ['Car'] }, { selected: ['Car', 'GPS'], meta: { cost: 2 } }] }),
    ).toBe('Car\nCar, GPS (cost: 2)');
    expect(resultText({ kind: 'configuration', selected: ['Car'], deselected: ['GPS'] })).toBe(
      'Selected: Car\nDeselected: GPS',
    );
    expect(resultText({ kind: 'text', value: 'True' })).toBe('True');
  });
});
