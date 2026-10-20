import { describe, expect, it } from 'vitest';
import type { Cell } from '../notebook';
import { findSecrets, redact } from './secrets';

const code = (source: string, text = '', id = 'a') =>
  ({ id, type: 'code', source, metadata: {}, executionCount: 3, outputs: text ? [{ type: 'stream', name: 'stdout', text }] : [] }) as unknown as Cell;
const md = (source: string, id = 'm') => ({ id, type: 'markdown', source, metadata: {}, attachments: {} }) as unknown as Cell;

const AWS = 'AKIA' + 'ABCDEFGHIJKLMNOP';
const GH = 'ghp_' + 'a'.repeat(36);

describe('findSecrets', () => {
  it('finds keys in code and in what a cell printed', () => {
    const hits = findSecrets([code(`key = "${AWS}"`), code('print(token)', `token: ${GH}`, 'b')]);
    expect(hits.map((h) => [h.kind, h.where, h.cell])).toEqual([
      ['AWS access key', 'code', 'a'],
      ['GitHub token', 'output', 'b'],
    ]);
    expect(hits[0].shown).toBe('AKIA…OP');
    expect(hits[0].tier).toBe('secret');
  });

  it('reads quoted secret values but not placeholders', () => {
    expect(findSecrets([code('api_key = "tGzv3JOkF0XG5Qx2TlKWIA"')]).map((h) => h.kind)).toEqual(['Secret value']);
    expect(findSecrets([code('api_key = "your-key-goes-here"'), code('password = os.environ["P"]'), code('token = "xxxxxxxxxxxxxxxx"')])).toEqual([]);
  });

  it('finds a password inside an address, and a private key block', () => {
    const hits = findSecrets([code('db = "postgres://admin:hunter2pw@db.internal/app"'), code('-----BEGIN RSA PRIVATE KEY-----\nMIIB\n-----END RSA PRIVATE KEY-----')]);
    expect(hits.map((h) => h.kind)).toEqual(['Password in an address', 'Private key']);
  });

  it('marks emails and home folders as personal and skips the generic ones', () => {
    const hits = findSecrets([md('Contact ada@lovelace.org or noreply@users.noreply.github.com'), code('', 'File "/Users/ada/work/a.py" and /home/jovyan/x.py and /home/runner/y')]);
    expect(hits.map((h) => [h.kind, h.tier, h.value])).toEqual([
      ['Email address', 'personal', 'ada@lovelace.org'],
      ['Home folder', 'personal', '/Users/ada'],
    ]);
  });

  it('reports a value once per cell', () => {
    expect(findSecrets([code(`a = "${AWS}"\nb = "${AWS}"`)]).length).toBe(1);
  });

  it('finds nothing in an ordinary notebook', () => {
    expect(findSecrets([md('# Title\nSome prose.'), code('x = 1\nprint(x)', '1')])).toEqual([]);
  });
});

describe('redact', () => {
  it('replaces every occurrence with what it was', () => {
    const hits = findSecrets([code(`k = "${AWS}"`)]);
    expect(redact(`one ${AWS} two ${AWS}`, hits)).toBe('one [hidden: aws access key] two [hidden: aws access key]');
  });
  it('leaves text alone when nothing was found', () => {
    expect(redact('plain', [])).toBe('plain');
  });
});
