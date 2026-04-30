import { Language } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

export const createTranslation = <
  T extends {
    Translation: { name: string; language: string; description?: string }[];
  },
>(
  data: T,
) => ({
  createMany: {
    data: data.Translation.map((translation) => ({
      name: translation.name,
      language: translation.language as Language,
      ...(translation.description && { description: translation.description }),
    })),
  },
});
export const updateTranslation = <
  T extends {
    Translation?: {
      id?: string;
      name: string;
      language: string;
      description?: string;
    }[];
  },
>(
  data: T,
) => {
  if (!data.Translation || !Array.isArray(data.Translation)) {
    return {};
  }

  const updates = data.Translation.map((translation) => ({
    where: { language: translation.language as Language },
    data: {
      name: translation.name,
      language: translation.language as Language,
      ...(translation.description && {
        description: translation.description,
      }),
    },
  }));
  return updates.length ? { updateMany: updates } : {};
};

export const Translation = (des?: boolean, language?: Language) => {
  return {
    Translation: {
      ...(language && { where: { language: Language[language] } }),
      select: {
        name: true,
        language: true,
        ...(des && { description: true }),
      },
    },
  };
};

export const translationDes = (language?: Language) => {
  return {
    Translation: {
      ...(language && { where: { language: Language[language] } }),
      select: {
        name: true,
        language: true,
        description: true,
      },
    },
  };
};

export class translationDto {
  @IsString()
  id?: string;

  @IsString()
  @Transform(({ value }) => value ?? null)
  name: string;

  @IsString()
  @Transform(({ value }) => Language[value.toUpperCase()] ?? null)
  language: Language;

  @IsString()
  @Transform(({ value }) => value ?? null)
  @IsOptional()
  description?: string;
}
