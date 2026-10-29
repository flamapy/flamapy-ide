import { useState } from 'react';

import type { InputSpec, OperationResult } from '@flamapy/ide-plugin-api';
// @ts-expect-error untyped JSX (web-ui); direct file import, the barrel pulls monaco
import Modal from '@flamapy/web-ui/src/ui/Modal.jsx';

/** Values the form offers for feature / attribute inputs, read from the current model. */
export interface InputChoices {
  features: string[];
  attributes: string[];
}

export function needsFeatures(inputs: readonly InputSpec[]): boolean {
  return inputs.some((input) => input.kind === 'feature' || input.kind === 'features');
}

export function needsAttributes(inputs: readonly InputSpec[]): boolean {
  return inputs.some((input) => input.kind === 'attribute' || input.kind === 'attributes');
}

type Draft = Record<string, string | boolean | string[]>;

function initialDraft(inputs: readonly InputSpec[]): Draft {
  const draft: Draft = {};
  for (const input of inputs) {
    if (input.kind === 'boolean') {
      draft[input.name] = input.default ?? false;
    } else if (input.kind === 'features' || input.kind === 'attributes') {
      draft[input.name] = [];
    } else if ('default' in input && input.default !== undefined) {
      draft[input.name] = String(input.default);
    } else {
      draft[input.name] = '';
    }
  }
  return draft;
}

/** Typed args from the form's draft, or the first problem to show. */
export function argsFromDraft(
  inputs: readonly InputSpec[],
  draft: Draft,
): { args: Record<string, unknown> } | { problem: string } {
  const args: Record<string, unknown> = {};
  for (const input of inputs) {
    const value = draft[input.name];
    const empty = value === '' || (Array.isArray(value) && value.length === 0);
    if (empty) {
      if (input.required) {
        return { problem: `${input.label} is required.` };
      }
      continue;
    }
    if (input.kind === 'integer' || input.kind === 'number') {
      const number = Number(value);
      if (!Number.isFinite(number) || (input.kind === 'integer' && !Number.isInteger(number))) {
        return { problem: `${input.label} must be ${input.kind === 'integer' ? 'a whole number' : 'a number'}.` };
      }
      if ((input.min !== undefined && number < input.min) || (input.max !== undefined && number > input.max)) {
        return { problem: `${input.label} must be between ${input.min ?? '−∞'} and ${input.max ?? '∞'}.` };
      }
      args[input.name] = number;
    } else {
      args[input.name] = value;
    }
  }
  return { args };
}

const field =
  'w-full py-1.5 px-2.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm';

function Field({
  input,
  value,
  choices,
  onChange,
}: {
  input: InputSpec;
  value: string | boolean | string[];
  choices: InputChoices;
  onChange(value: string | boolean | string[]): void;
}) {
  const id = `operation-input-${input.name}`;
  switch (input.kind) {
    case 'boolean':
      return (
        <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
          <input id={id} type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />
          {input.label}
        </label>
      );
    case 'integer':
    case 'number':
      return (
        <input
          id={id}
          type="number"
          step={input.kind === 'integer' ? 1 : 'any'}
          min={input.min}
          max={input.max}
          className={field}
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'string':
      return <input id={id} type="text" className={field} value={value as string} onChange={(e) => onChange(e.target.value)} />;
    case 'enum':
    case 'feature':
    case 'attribute': {
      const options =
        input.kind === 'enum'
          ? input.options
          : (input.kind === 'feature' ? choices.features : choices.attributes).map((name) => ({ value: name, label: name }));
      if (options.length === 0) {
        return (
          <p className="text-sm text-red-600 dark:text-red-400">
            {input.kind === 'attribute' ? 'This model has no numerical attributes.' : 'No options available.'}
          </p>
        );
      }
      return (
        <select id={id} className={field} value={value as string} onChange={(e) => onChange(e.target.value)}>
          <option value="">Select…</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }
    case 'features':
    case 'attributes': {
      const names = input.kind === 'features' ? choices.features : choices.attributes;
      const selected = new Set(value as string[]);
      if (names.length === 0) {
        return <p className="text-sm text-red-600 dark:text-red-400">No options available.</p>;
      }
      return (
        <div id={id} className="max-h-40 overflow-auto border border-gray-300 dark:border-gray-600 rounded-md p-1.5 space-y-0.5">
          {names.map((name) => (
            <label key={name} className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
              <input
                type="checkbox"
                checked={selected.has(name)}
                onChange={(e) => {
                  const next = new Set(selected);
                  if (e.target.checked) next.add(name);
                  else next.delete(name);
                  onChange(names.filter((candidate) => next.has(candidate)));
                }}
              />
              {name}
            </label>
          ))}
        </div>
      );
    }
  }
}

/** The shell's input form for an operation: one field per InputSpec. */
export function OperationForm({
  title,
  inputs,
  choices,
  onSubmit,
  onCancel,
}: {
  title: string;
  inputs: readonly InputSpec[];
  choices: InputChoices;
  onSubmit(args: Record<string, unknown>): void;
  onCancel(): void;
}) {
  const [draft, setDraft] = useState(() => initialDraft(inputs));
  const [problem, setProblem] = useState<string | null>(null);

  function submit() {
    const outcome = argsFromDraft(inputs, draft);
    if ('problem' in outcome) {
      setProblem(outcome.problem);
      return;
    }
    onSubmit(outcome.args);
  }

  return (
    <Modal title={title} onClose={onCancel}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="space-y-3"
      >
        {inputs.map((input) => (
          <div key={input.name}>
            {input.kind !== 'boolean' && (
              <label htmlFor={`operation-input-${input.name}`} className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                {input.label}
                {input.required && <span className="text-red-500"> *</span>}
              </label>
            )}
            <Field
              input={input}
              value={draft[input.name]!}
              choices={choices}
              onChange={(value) => setDraft((current) => ({ ...current, [input.name]: value }))}
            />
          </div>
        ))}
        {problem && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {problem}
          </p>
        )}
        <div className="pt-2 flex justify-end gap-2">
          <button
            type="button"
            className="px-4 py-1.5 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 text-sm font-medium rounded-md hover:bg-gray-300 dark:hover:bg-gray-500"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button type="submit" className="px-4 py-1.5 bg-accent text-white text-sm font-medium rounded-md hover:opacity-90">
            Run
          </button>
        </div>
      </form>
    </Modal>
  );
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

/** Renders an OperationResult in the output panel. */
export function OperationResultView({ result }: { result: OperationResult }) {
  switch (result.kind) {
    case 'text':
      return <pre className="font-mono whitespace-pre-wrap">{result.value}</pre>;
    case 'json':
      return <pre className="font-mono whitespace-pre-wrap">{JSON.stringify(result.value, null, 2)}</pre>;
    case 'table':
      return (
        <table className="text-[12.5px] border-collapse">
          <thead>
            <tr>
              {result.columns.map((column) => (
                <th key={column} className="text-left font-semibold px-2 py-1 border-b border-black/10 dark:border-white/10">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row, index) => (
              <tr key={index} className="odd:bg-black/[.02] dark:odd:bg-white/[.03]">
                {row.map((cell, column) => (
                  <td key={column} className="px-2 py-0.5 font-mono">
                    {formatCell(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    case 'configuration':
      return (
        <div className="space-y-1.5 text-[12.5px]">
          {result.meta && Object.keys(result.meta).length > 0 && (
            <p className="text-gray-600 dark:text-gray-400">
              {Object.entries(result.meta)
                .map(([key, value]) => `${key}: ${formatCell(value)}`)
                .join(' · ')}
            </p>
          )}
          <p>
            <span className="font-semibold">Selected ({result.selected.length}): </span>
            <span className="font-mono">{result.selected.join(', ') || '—'}</span>
          </p>
          {result.deselected && (
            <p>
              <span className="font-semibold">Deselected ({result.deselected.length}): </span>
              <span className="font-mono">{result.deselected.join(', ') || '—'}</span>
            </p>
          )}
        </div>
      );
  }
}
