import type { ReactNode } from 'react';

export interface PluginModal {
  key: number;
  render: (close: () => void) => ReactNode;
}

/** Renders the plugin modal stack (ShellApi.modals.open). */
export function ModalOutlet({
  modals,
  onClose,
}: {
  modals: readonly PluginModal[];
  onClose: (key: number) => void;
}) {
  return (
    <>
      {modals.map((modal) => (
        <div key={modal.key}>{modal.render(() => onClose(modal.key))}</div>
      ))}
    </>
  );
}
