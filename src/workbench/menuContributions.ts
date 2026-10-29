import type { Contributed, MenuItemDescriptor, ShellMenuId } from '@flamapy/ide-plugin-api';

/** A DropdownMenu option (see @flamapy/web-ui DropdownMenu). */
export interface MenuOption {
  type?: 'section' | 'divider';
  key?: string;
  label: string;
  value?: unknown;
  title?: string;
  disabled?: boolean;
  /** Set on plugin items: the shell runs it instead of its built-in action handler. */
  contributedItem?: Contributed<MenuItemDescriptor>;
  [extra: string]: unknown;
}

/**
 * Appends the plugin items of one built-in menu to its built-in options: a divider, then
 * one section per plugin, titled with the plugin's name, holding its items in `order`.
 * `analysis` items restricted to some solvers only show while one of them is selected.
 */
export function withContributedItems(
  base: readonly MenuOption[],
  items: readonly Contributed<MenuItemDescriptor>[],
  menu: ShellMenuId,
  options: { selectedSolver?: string; pluginName(pluginId: string | undefined): string },
): MenuOption[] {
  const visible = items.filter(
    (item) =>
      item.menu === menu &&
      (!item.backends || item.backends.includes(options.selectedSolver ?? '')),
  );
  if (visible.length === 0) {
    return [...base];
  }
  const byPlugin = new Map<string | undefined, Contributed<MenuItemDescriptor>[]>();
  for (const item of visible) {
    byPlugin.set(item.pluginId, [...(byPlugin.get(item.pluginId) ?? []), item]);
  }
  const result: MenuOption[] = [...base];
  if (base.length > 0) {
    result.push({ type: 'divider', key: `${menu}:plugins`, label: '' });
  }
  for (const [pluginId, pluginItems] of byPlugin) {
    result.push({
      type: 'section',
      key: `${menu}:plugin:${pluginId ?? ''}`,
      label: options.pluginName(pluginId),
    });
    for (const item of [...pluginItems].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))) {
      result.push({
        key: item.id,
        label: item.label,
        value: item.id,
        title: item.title,
        disabled: item.disabled,
        contributedItem: item,
      });
    }
  }
  return result;
}
