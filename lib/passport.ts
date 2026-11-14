/** MFA 2114 Appendix 8: default Cyrillic → Latin substitution only.
 * This is not an official inverse Brazilian-name → Cyrillic converter. */
export const passportLetters: Record<string,string> = {
  А:'A',Б:'B',В:'V',Г:'G',Д:'D',Е:'E',Ё:'E',Ж:'ZH',З:'Z',И:'I',Й:'I',К:'K',Л:'L',М:'M',Н:'N',О:'O',П:'P',Р:'R',С:'S',Т:'T',У:'U',Ф:'F',Х:'KH',Ц:'TS',Ч:'CH',Ш:'SH',Щ:'SHCH',Ъ:'IE',Ы:'Y',Ь:'',Э:'E',Ю:'IU',Я:'IA',
};
export function russianPassportLatin(value:string): string {
  return [...value.toUpperCase()].map(c => passportLetters[c] ?? c).join('');
}
export function compareDocumentNames(br:string, ru:string) {
  const defaultLatin=russianPassportLatin(ru);
  const validRussian=/^[А-ЯЁа-яё\s-]+$/.test(ru.trim())&&/[А-ЯЁа-яё]/.test(ru);
  const brazilian=br.trim().toUpperCase();
  const ascii=brazilian.normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  return {brazilian, russianInternal:ru, defaultLatin, validRussian, exactMatch:validRussian&&brazilian===defaultLatin, asciiMatch:validRussian&&ascii===defaultLatin, hasDiacritics:brazilian!==ascii, containsUnknownCyrillic:[...ru.toUpperCase()].some(c=>/[А-ЯЁ]/u.test(c)&&!(c in passportLetters))};
}
