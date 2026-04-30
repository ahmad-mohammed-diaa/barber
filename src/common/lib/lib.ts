import { Language } from '@prisma/client';
import { TranslationType } from '../dto/translation';

type TranslationNameType = { language: 'EN' | 'AR'; name: string };

export const TranslateName = <T extends { Translation: TranslationNameType[] }>(
  data: T,
  language: 'EN' | 'AR',
) => {
  const { Translation, ...rest } = data;
  return {
    ...rest,
    nameEN: Translation.find((t) => t.language === 'EN')?.name,
    nameAR: Translation.find((t) => t.language === 'AR')?.name,
    name: Translation.find((t) => t.language === language)?.name,
  };
};

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
