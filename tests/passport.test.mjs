import { test } from 'node:test';
import assert from 'node:assert/strict';
import { russianPassportLatin,compareDocumentNames } from '../lib/passport.ts';
test('default official substitution covers distinguishing letters',()=>{
  assert.equal(russianPassportLatin('Артём, Пётр, Семён'),'ARTEM, PETR, SEMEN');
  assert.equal(russianPassportLatin('Юрий Яков Илья'),'IURII IAKOV ILIA');
  assert.equal(russianPassportLatin('ХЦЧШЩЪЫЬЭ'),'KHTSCHSHSHCHIEYE');
});
test('strict printed spelling and ASCII comparison stay distinct',()=>{
  assert.equal(compareDocumentNames('Nikolai','Николай').exactMatch,true);
  assert.equal(compareDocumentNames('Fyodor','Фёдор').exactMatch,false);
  const accented=compareDocumentNames('Félix','Феликс');
  assert.equal(accented.exactMatch,false);assert.equal(accented.asciiMatch,false);
  assert.equal(compareDocumentNames('Róman','Роман').asciiMatch,true);
  assert.equal(compareDocumentNames('Róman','Роман').exactMatch,false);
});

test("a Latin or unsupported-script Russian target never produces an exact-match approval",()=>{assert.equal(compareDocumentNames("FEDOR","Fedor").validRussian,false);assert.equal(compareDocumentNames("FEDOR","Fedor").exactMatch,false);assert.equal(compareDocumentNames(""," ").exactMatch,false);assert.equal(compareDocumentNames("ILIA","Ілля").validRussian,false);});
