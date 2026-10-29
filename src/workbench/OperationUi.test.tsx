// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { InputSpec } from '@flamapy/ide-plugin-api';

import { argsFromDraft, OperationForm, OperationResultView } from './OperationUi';

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
    expect(container.textContent).toContain('Selected (2): Root, GPS');
  });
});
