import { Language } from '@prisma/client';
import { TranslationType } from '../dto/translation';

export function getTranslationNames(
  Translation: TranslationType[],
  lang: Language,
) {
  const nameEN = Translation.find((t) => t.language === 'EN')?.name || null;
  const nameAR = Translation.find((t) => t.language === 'AR')?.name || null;
  const name = Translation.find((t) => t.language === lang)?.name || null;

  return {
    nameEN,
    nameAR,
    name,
  };
}
export function getDayRange(targetDate: Date) {
  const startOfDay = new Date(targetDate);
  startOfDay.setUTCHours(0, 0, 0, 0);

  const endOfDay = new Date(targetDate);
  endOfDay.setUTCHours(23, 59, 59, 999);

  return { startOfDay, endOfDay };
}
