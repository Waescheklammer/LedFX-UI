import { Preset, SubPreset } from '../types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  presets: Preset[];
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateSubPreset(sub: unknown, index: number, presetIndex: number): string[] {
  const errors: string[] = [];
  const prefix = `Preset[${presetIndex}].subPresets[${index}]`;

  if (typeof sub !== 'object' || sub === null) {
    errors.push(`${prefix}: Muss ein Objekt sein`);
    return errors;
  }

  const obj = sub as Record<string, unknown>;

  if (!isNonEmptyString(obj.id)) {
    errors.push(`${prefix}.id: Fehlt oder ist kein gültiger String`);
  }
  if (!isNonEmptyString(obj.name)) {
    errors.push(`${prefix}.name: Fehlt oder ist kein gültiger String`);
  }
  if (!isNonEmptyString(obj.effectName)) {
    errors.push(`${prefix}.effectName: Fehlt oder ist kein gültiger String`);
  }

  return errors;
}

function validatePreset(preset: unknown, index: number): string[] {
  const errors: string[] = [];
  const prefix = `Preset[${index}]`;

  if (typeof preset !== 'object' || preset === null) {
    errors.push(`${prefix}: Muss ein Objekt sein`);
    return errors;
  }

  const obj = preset as Record<string, unknown>;

  if (!isNonEmptyString(obj.id)) {
    errors.push(`${prefix}.id: Fehlt oder ist kein gültiger String`);
  }
  if (!isNonEmptyString(obj.mainTitle)) {
    errors.push(`${prefix}.mainTitle: Fehlt oder ist kein gültiger String`);
  }
  if (!isNonEmptyString(obj.name)) {
    errors.push(`${prefix}.name: Fehlt oder ist kein gültiger String`);
  }
  if (!isNonEmptyString(obj.effectName)) {
    errors.push(`${prefix}.effectName: Fehlt oder ist kein gültiger String`);
  }

  if (!Array.isArray(obj.subPresets)) {
    errors.push(`${prefix}.subPresets: Fehlt oder ist kein Array`);
  } else {
    obj.subPresets.forEach((sub: unknown, subIndex: number) => {
      errors.push(...validateSubPreset(sub, subIndex, index));
    });
  }

  return errors;
}

/**
 * Validiert eine geparste JSON-Struktur als Preset[].
 * Gibt ein ValidationResult mit detaillierten Fehlermeldungen zurück.
 */
export function validatePresetsJson(data: unknown): ValidationResult {
  const errors: string[] = [];

  if (!Array.isArray(data)) {
    return {
      valid: false,
      errors: ['JSON muss ein Array sein'],
      presets: [],
    };
  }

  if (data.length === 0) {
    return {
      valid: false,
      errors: ['Das Array enthält keine Presets'],
      presets: [],
    };
  }

  data.forEach((item, index) => {
    errors.push(...validatePreset(item, index));
  });

  // Begrenze Fehleranzahl auf die ersten 10
  const limitedErrors = errors.length > 10 
    ? [...errors.slice(0, 10), `...und ${errors.length - 10} weitere Fehler`]
    : errors;

  if (errors.length > 0) {
    return { valid: false, errors: limitedErrors, presets: [] };
  }

  return { valid: true, errors: [], presets: data as Preset[] };
}

