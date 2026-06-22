export function formatDateBr(value) {
  if (!value) return '-';

  if (value instanceof Date) {
    const offset = value.getTimezoneOffset() * 60000;
    const iso = new Date(value.getTime() - offset).toISOString().slice(0, 10);
    return formatDateBr(iso);
  }

  const text = String(value).trim();
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  }

  const brMatch = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) {
    return text;
  }

  return text;
}

export function parseDateBrInput(value) {
  const text = String(value || '').trim();
  if (!text) return '';

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return isValidDateParts(isoMatch[1], isoMatch[2], isoMatch[3]) ? text : '';
  }

  const compactMatch = text.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (compactMatch) {
    return isValidDateParts(compactMatch[3], compactMatch[2], compactMatch[1])
      ? `${compactMatch[3]}-${compactMatch[2]}-${compactMatch[1]}`
      : '';
  }

  const match = text.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  if (!match) return '';

  return isValidDateParts(match[3], match[2], match[1]) ? `${match[3]}-${match[2]}-${match[1]}` : '';
}

export function toBrDateInput(value) {
  if (!value) return '';

  if (value instanceof Date) {
    const offset = value.getTimezoneOffset() * 60000;
    const iso = new Date(value.getTime() - offset).toISOString().slice(0, 10);
    return toBrDateInput(iso);
  }

  const text = String(value).trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(text)) {
    return text;
  }

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!isoMatch) return '';

  return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
}

export function todayBrDateInput() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  const iso = new Date(now.getTime() - offset).toISOString().slice(0, 10);
  return toBrDateInput(iso);
}

function isValidDateParts(year, month, day) {
  const iso = `${year}-${month}-${day}`;
  const date = new Date(`${iso}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === iso;
}
