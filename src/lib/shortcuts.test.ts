import { describe, expect, it } from 'vitest';
import { detectPlatform, formatShortcut, isComposingEvent, isEditableElement, matchShortcut } from './shortcuts';

describe('platform-aware keyboard shortcuts', () => {
  it('detects Mac vs Windows/Linux platforms', () => {
    expect(detectPlatform('MacIntel')).toBe('mac');
    expect(detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe('mac');
    expect(detectPlatform('Win32')).toBe('other');
    expect(detectPlatform('Linux x86_64')).toBe('other');
  });

  it('matches Command on Mac and Control on Windows/Linux', () => {
    const macCmdP = { key: 'p', metaKey: true, ctrlKey: false, shiftKey: false, altKey: false };
    const winCtrlP = { key: 'p', metaKey: false, ctrlKey: true, shiftKey: false, altKey: false };

    expect(matchShortcut(macCmdP, { key: 'p', mod: true }, 'mac')).toBe(true);
    expect(matchShortcut(winCtrlP, { key: 'p', mod: true }, 'mac')).toBe(false);
    expect(matchShortcut(winCtrlP, { key: 'p', mod: true }, 'other')).toBe(true);
    expect(matchShortcut(macCmdP, { key: 'p', mod: true }, 'other')).toBe(false);
  });

  it('matches Cmd/Ctrl + Shift + L accurately', () => {
    const macToggle = { key: 'L', metaKey: true, ctrlKey: false, shiftKey: true, altKey: false };
    const winToggle = { key: 'l', metaKey: false, ctrlKey: true, shiftKey: true, altKey: false };
    expect(matchShortcut(macToggle, { key: 'l', mod: true, shift: true }, 'mac')).toBe(true);
    expect(matchShortcut(winToggle, { key: 'l', mod: true, shift: true }, 'other')).toBe(true);
    expect(matchShortcut({ ...macToggle, shiftKey: false }, { key: 'l', mod: true, shift: true }, 'mac')).toBe(false);
  });

  it('ignores shortcuts during Vietnamese IME composition', () => {
    const composing = { key: 'p', metaKey: true, ctrlKey: false, shiftKey: false, altKey: false, isComposing: true };
    const ime229 = { key: 'Process', metaKey: false, ctrlKey: true, shiftKey: false, altKey: false, keyCode: 229 };
    expect(isComposingEvent(composing)).toBe(true);
    expect(isComposingEvent(ime229)).toBe(true);
    expect(matchShortcut(composing, { key: 'p', mod: true }, 'mac')).toBe(false);
    expect(matchShortcut(ime229, { key: 'p', mod: true }, 'other')).toBe(false);
  });

  it('formats platform-specific shortcut labels', () => {
    expect(formatShortcut({ key: 'p', mod: true }, 'mac')).toBe('⌘ P');
    expect(formatShortcut({ key: 'p', mod: true }, 'other')).toBe('Ctrl + P');
    expect(formatShortcut({ key: 'l', mod: true, shift: true }, 'mac')).toBe('⌘ ⇧ L');
    expect(formatShortcut({ key: 'l', mod: true, shift: true }, 'other')).toBe('Ctrl + Shift + L');
  });

  it('identifies editable input targets safely', () => {
    expect(isEditableElement({ tagName: 'INPUT' } as unknown as EventTarget)).toBe(true);
    expect(isEditableElement({ tagName: 'TEXTAREA' } as unknown as EventTarget)).toBe(true);
    expect(isEditableElement({ tagName: 'SELECT' } as unknown as EventTarget)).toBe(true);
    expect(isEditableElement({ tagName: 'DIV', isContentEditable: true } as unknown as EventTarget)).toBe(true);
    expect(isEditableElement({ tagName: 'BUTTON', isContentEditable: false } as unknown as EventTarget)).toBe(false);
  });
});
