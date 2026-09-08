const test = require('node:test');
const assert = require('node:assert/strict');
const { validateGenerateInput, isValidBilanganTotal } = require('../lib/validateInput');

test('menerima input sah', () => {
  const out = validateGenerateInput({
    provider: 'gemini', tingkatan: 4, tajuk: 'Statistik', tahap: 'mudah',
    bilangan_pilihan: 4, mula: 1, banyak: 10,
  });
  assert.equal(out.tingkatan, 4);
  assert.equal(out.tajuk, 'Statistik');
});

test('menolak penyedia AI tidak sah', () => {
  assert.throws(() => validateGenerateInput({ provider: 'llama', tingkatan: 4, tajuk: 'X', tahap: 'mudah', mula: 1, banyak: 1 }));
});

test('menolak tingkatan tidak sah', () => {
  assert.throws(() => validateGenerateInput({ provider: 'gemini', tingkatan: 3, tajuk: 'X', tahap: 'mudah', mula: 1, banyak: 1 }));
});

test('menolak tajuk kosong', () => {
  assert.throws(() => validateGenerateInput({ provider: 'gemini', tingkatan: 4, tajuk: '  ', tahap: 'mudah', mula: 1, banyak: 1 }));
});

test('menolak tahap tidak sah', () => {
  assert.throws(() => validateGenerateInput({ provider: 'gemini', tingkatan: 4, tajuk: 'X', tahap: 'gila', mula: 1, banyak: 1 }));
});

test('isValidBilanganTotal menyemak senarai tetap 5/10/15/20/30/40', () => {
  assert.equal(isValidBilanganTotal(10), true);
  assert.equal(isValidBilanganTotal(12), false);
});
