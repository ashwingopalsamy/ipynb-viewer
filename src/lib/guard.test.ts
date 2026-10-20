import { describe, expect, it } from 'vitest';
import { cleanStyle, remoteHost, LINKS, INSIDE } from './guard';

describe('cleanStyle', () => {
  it('keeps properties that only change how a box looks', () => {
    expect(cleanStyle('color: red; font-weight: 700; margin: 4px 8px')).toBe('color: red; font-weight: 700; margin: 4px 8px');
    expect(cleanStyle("font-family: 'Helvetica', sans-serif")).toBe("font-family: 'Helvetica', sans-serif");
    expect(cleanStyle('width: calc(100% - 2em); display: flex')).toBe('width: calc(100% - 2em); display: flex');
  });
  it('drops anything that could fetch or escape', () => {
    for (const v of ['background: url(https://x/a.png)', 'background-image: url("data:image/png;base64,AAAA")', 'background: image-set(url(x) 1x)', 'width: expression(alert(1))', 'color: re' + String.fromCharCode(92) + '3d', 'background: url (x)', 'color: var(--fg)', 'margin: 1px /* x */']) {
      expect(cleanStyle(v)).toBe('');
    }
  });
  it('drops properties that are not on the list, whatever the value', () => {
    for (const v of ['position: fixed', 'z-index: 9999', 'top: 0', 'pointer-events: none', 'transform: scale(40)', 'content: "x"', 'filter: blur(2px)', 'cursor: pointer', 'behavior: x', '-moz-binding: x']) {
      expect(cleanStyle(v)).toBe('');
    }
  });
  it('limits display to values that do not break out of the box', () => {
    expect(cleanStyle('display: block')).toBe('display: block');
    expect(cleanStyle('display: contents')).toBe('');
    expect(cleanStyle('display: flow-root; color: blue')).toBe('color: blue');
  });
  it('keeps the good declarations around a bad one', () => {
    expect(cleanStyle('color: red; background: url(x); margin: 2px; position: absolute; padding: 1px')).toBe('color: red; margin: 2px; padding: 1px');
  });
  it('copes with junk', () => {
    expect(cleanStyle('')).toBe('');
    expect(cleanStyle(';;;')).toBe('');
    expect(cleanStyle('color')).toBe('');
    expect(cleanStyle(':red')).toBe('');
    expect(cleanStyle('COLOR: Red')).toBe('color: Red');
  });
});

describe('remoteHost', () => {
  it('knows a data picture from one that lives elsewhere', () => {
    expect(remoteHost('data:image/png;base64,AAAA')).toBeNull();
    expect(remoteHost('data:image/svg+xml,%3Csvg/%3E')).toBeNull();
    expect(remoteHost('https://example.com/a.png')).toBe('example.com');
    expect(remoteHost('//cdn.example.com/a.png')).toBe('cdn.example.com');
    expect(remoteHost('./a.png')).toBe('a relative path');
    expect(remoteHost('')).toBe('a relative path');
    expect(remoteHost('data:text/html,<b>x</b>')).toBe('an unknown address');
  });
});

describe('attribute value patterns', () => {
  it('LINKS passes plain values and safe schemes, and refuses the rest', () => {
    for (const ok of ['100', 'center', '3', 'https://a.b/c', 'http://a.b', 'mailto:a@b.c', 'tel:+1', '#top', 'a title with words', 'relative/path.html', '//host/x']) expect(LINKS.test(ok), ok).toBe(true);
    for (const bad of ['javascript:alert(1)', 'JaVaScRiPt:x', 'vbscript:x', 'data:text/html,x', 'file:///etc/passwd', 'ftp://x', 'blob:https://x/y']) expect(LINKS.test(bad), bad).toBe(false);
  });
  it('INSIDE passes plain values, fragments and picture data only', () => {
    for (const ok of ['#a', 'data:image/png;base64,AAA', '10pt', 'url(#g)', 'round']) expect(INSIDE.test(ok), ok).toBe(true);
    for (const bad of ['https://x/y.svg#a', 'javascript:x', 'data:text/html,x', 'http://x']) expect(INSIDE.test(bad), bad).toBe(false);
  });
});
