const test = require('node:test');
const assert = require('node:assert/strict');
const { parseAndValidateBatch } = require('../lib/questionValidator');

const VALID_JSON = JSON.stringify({
  tajuk: 'Ungkapan Kuadratik',
  soalan: [
    { no: 1, soalan: 'Selesaikan x^2-5x+6=0', pilihan: { A: '2,3', B: '1,6', C: '-2,-3', D: '2,-3' }, jawapan: 'A', tahap: 'mudah', penerangan: 'Faktorkan.' },
    { no: 2, soalan: 'Selesaikan x^2-1=0', pilihan: { A: '1,-1', B: '1,1', C: '0,1', D: '-1,-1' }, jawapan: 'A', tahap: 'mudah', penerangan: 'Beza dua kuasa dua.' },
  ],
});

test('menerima JSON sah tepat pada bilangan diminta', () => {
  const result = parseAndValidateBatch(VALID_JSON, { banyak: 2, mula: 1, bilanganPilihan: 4 });
  assert.equal(result.soalan.length, 2);
  assert.equal(result.soalan[0].no, 1);
});

test('menerima JSON dibalut dalam pagar markdown ```json', () => {
  const fenced = '```json\n' + VALID_JSON + '\n```';
  const result = parseAndValidateBatch(fenced, { banyak: 2, mula: 1, bilanganPilihan: 4 });
  assert.equal(result.soalan.length, 2);
});

test('menolak jika bilangan soalan tidak sama dengan diminta', () => {
  assert.throws(
    () => parseAndValidateBatch(VALID_JSON, { banyak: 3, mula: 1, bilanganPilihan: 4 }),
    /2 soalan sahaja/
  );
});

test('menolak JSON yang rosak', () => {
  assert.throws(
    () => parseAndValidateBatch('bukan json', { banyak: 2, mula: 1, bilanganPilihan: 4 }),
    /bukan format JSON/
  );
});

test('menolak jika pilihan tidak lengkap mengikut bilangan_pilihan', () => {
  const badJson = JSON.stringify({
    tajuk: 'X',
    soalan: [{ no: 1, soalan: 'Soalan', pilihan: { A: '1', B: '2' }, jawapan: 'A', tahap: 'mudah', penerangan: 'Kerja' }],
  });
  assert.throws(
    () => parseAndValidateBatch(badJson, { banyak: 1, mula: 1, bilanganPilihan: 4 }),
    /tiada pilihan "C"/
  );
});

test('menolak jika jawapan bukan salah satu kunci pilihan', () => {
  const badJson = JSON.stringify({
    tajuk: 'X',
    soalan: [{ no: 1, soalan: 'Soalan', pilihan: { A: '1', B: '2', C: '3', D: '4' }, jawapan: 'Z', tahap: 'mudah', penerangan: 'Kerja' }],
  });
  assert.throws(
    () => parseAndValidateBatch(badJson, { banyak: 1, mula: 1, bilanganPilihan: 4 }),
    /jawapan yang tidak sah/
  );
});

test('menolak jika penerangan/langkah kerja tiada', () => {
  const badJson = JSON.stringify({
    tajuk: 'X',
    soalan: [{ no: 1, soalan: 'Soalan', pilihan: { A: '1', B: '2', C: '3', D: '4' }, jawapan: 'A', tahap: 'mudah', penerangan: '' }],
  });
  assert.throws(
    () => parseAndValidateBatch(badJson, { banyak: 1, mula: 1, bilanganPilihan: 4 }),
    /tiada langkah kerja/
  );
});
