import { validate as uuidValidate } from 'uuid';

const isMongoId = value => /^[a-fA-F0-9]{24}$/.test(value);

export const isValidId = value => {
  if (!value && value !== 0) return false;
  const stringValue =
    typeof value === 'string'
      ? value.trim()
      : typeof value === 'object' && value !== null && 'id' in value
      ? String(value.id).trim()
      : String(value).trim();
  if (!stringValue) return false;
  return uuidValidate(stringValue) || isMongoId(stringValue);
};

export const toIdString = value => {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null) {
    if ('id' in value && value.id !== undefined && value.id !== null) {
      return String(value.id);
    }
  }
  try {
    return String(value);
  } catch {
    return '';
  }
};
