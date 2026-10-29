// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SidebarSlot } from './SidebarSlot';

afterEach(cleanup);

const panel = {
  id: 'acme.outline',
  title: 'Outline',
  side: 'left' as const,
  component: () => <p>outline content</p>,
};

describe('SidebarSlot', () => {
  it('frames the panel: title, content, move and close', () => {
    const onClose = vi.fn();
    const onMove = vi.fn();
    render(
      <SidebarSlot panel={panel} side="left" width={280} onClose={onClose} onMove={onMove} onResize={() => {}} />,
    );
    const frame = screen.getByRole('complementary', { name: 'Outline' });
    expect(frame.style.width).toBe('280px');
    expect(screen.getByRole('heading', { name: 'Outline' })).toBeTruthy();
    expect(screen.getByText('outline content')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Move Outline to the right side' }));
    expect(onMove).toHaveBeenCalledWith(panel);
    fireEvent.click(screen.getByRole('button', { name: 'Close Outline' }));
    expect(onClose).toHaveBeenCalledWith(panel);
  });

  it('renders nothing when the side is closed', () => {
    const { container } = render(
      <SidebarSlot panel={undefined} side="right" width={0} onClose={() => {}} onMove={() => {}} onResize={() => {}} />,
    );
    expect(container.innerHTML).toBe('');
  });
});
