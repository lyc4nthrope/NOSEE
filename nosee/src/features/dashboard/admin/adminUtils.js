import { useState, useEffect, useRef } from 'react';

export function useClientDateFormat(dateStr, locale = 'es-CO') {
  const [formatted, setFormatted] = useState('—');
  useEffect(() => {
    if (dateStr) setFormatted(new Date(dateStr).toLocaleString(locale));
    else setFormatted('—');
  }, [dateStr, locale]);
  return formatted;
}

export function useClientDateOnlyFormat(dateStr, locale = 'es-CO') {
  const [formatted, setFormatted] = useState('—');
  useEffect(() => {
    if (dateStr) {
      setFormatted(
        new Date(dateStr).toLocaleDateString(locale, {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      );
    } else {
      setFormatted('—');
    }
  }, [dateStr, locale]);
  return formatted;
}
