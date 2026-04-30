import { randomInt } from 'crypto';

const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const Random = (length = 6) => {
  let code = '';

  for (let i = 0; i < length; i++) {
    code += chars[randomInt(0, chars.length)];
  }

  return code;
};
