import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDate,
  formatNumber,
  formatPrice,
  toLocaleDigits,
  toAsciiDigits,
  rialToToman,
} from '@eshobe/site-runtime';
test('Persian numbers, percentage and phone keep the correct digits', () => {
  assert.equal(formatNumber(1234, 'fa'), '۱٬۲۳۴');
  assert.equal(formatNumber(1234, 'en'), '1,234');
  assert.match(formatNumber(0.5, 'fa', { style: 'percent' }), /۵۰/);
  assert.equal(toLocaleDigits('09121234567', 'fa'), '۰۹۱۲۱۲۳۴۵۶۷');
  assert.equal(toAsciiDigits('۰۹۱۲'), '0912');
});
test('Jalali / Gregorian dates and Tehran midnight are deterministic', () => {
  assert.match(formatDate('2024-03-20T12:00:00Z', 'fa'), /۱۴۰۳/);
  assert.match(formatDate('2024-03-20T12:00:00Z', 'en'), /2024/);
  assert.equal(formatDate(null, 'fa'), '');
});
test('minor units do not confuse Rial, Toman or cents', () => {
  assert.equal(formatPrice(12345, 'USD', 'en'), '123.45 $');
  assert.equal(formatPrice(10000000, 'IRR', 'fa'), '۱۰٬۰۰۰٬۰۰۰ ریال');
  assert.equal(formatPrice(rialToToman(10000000), 'IRT', 'fa'), '۱٬۰۰۰٬۰۰۰ تومان');
  assert.throws(() => rialToToman(11));
});
