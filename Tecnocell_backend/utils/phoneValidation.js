function validatePhone(
  value,
  {
    required = false,
    label = 'El teléfono',
    minLength = 8,
    maxLength = 15,
  } = {}
) {
  if (value === undefined) {
    return { ok: true, value: undefined };
  }

  if (value === null || String(value).trim() === '') {
    if (required) {
      return {
        ok: false,
        message: `${label} es requerido`,
      };
    }

    return { ok: true, value: null };
  }

  if (typeof value !== 'string' && typeof value !== 'number') {
    return {
      ok: false,
      message: `${label} debe contener únicamente números`,
    };
  }

  const normalized = String(value).trim();
  const pattern = new RegExp(`^\\d{${minLength},${maxLength}}$`);

  if (!pattern.test(normalized)) {
    return {
      ok: false,
      message: `${label} debe contener únicamente números y tener entre ${minLength} y ${maxLength} dígitos`,
    };
  }

  return {
    ok: true,
    value: normalized,
  };
}

module.exports = {
  validatePhone,
};
