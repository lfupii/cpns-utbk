import { useCallback, useMemo, useRef, useState } from 'react';

function getSafeSelectionPosition(value, rawPosition) {
  if (Number.isInteger(rawPosition) && rawPosition >= 0) {
    return rawPosition;
  }

  return String(value || '').length;
}

export default function useMathTextInput({
  defaultFieldKey = 'question_text',
  getFieldValue,
  getFieldLabel,
  updateFieldValue,
}) {
  const fieldRefs = useRef({});
  const selectionRef = useRef({
    fieldKey: defaultFieldKey,
    start: null,
    end: null,
  });
  const [activeFieldKey, setActiveFieldKey] = useState(defaultFieldKey);

  const registerFieldRef = useCallback((fieldKey) => (node) => {
    if (node) {
      fieldRefs.current[fieldKey] = node;
      return;
    }

    delete fieldRefs.current[fieldKey];
  }, []);

  const focusFieldAt = useCallback((fieldKey, cursorPosition) => {
    const targetField = fieldRefs.current[fieldKey];
    if (!targetField || typeof window === 'undefined') {
      return;
    }

    window.requestAnimationFrame(() => {
      targetField.focus();

      if (typeof targetField.setSelectionRange === 'function') {
        targetField.setSelectionRange(cursorPosition, cursorPosition);
      }
    });
  }, []);

  const syncSelection = useCallback((fieldKey, event) => {
    const currentValue = getFieldValue(fieldKey);
    const start = getSafeSelectionPosition(currentValue, event.target.selectionStart);
    const end = getSafeSelectionPosition(currentValue, event.target.selectionEnd);

    selectionRef.current = {
      fieldKey,
      start,
      end,
    };
    setActiveFieldKey((current) => (current === fieldKey ? current : fieldKey));
  }, [getFieldValue]);

  const getMathFieldProps = useCallback((fieldKey) => ({
    ref: registerFieldRef(fieldKey),
    onFocus: (event) => syncSelection(fieldKey, event),
    onClick: (event) => syncSelection(fieldKey, event),
    onKeyUp: (event) => syncSelection(fieldKey, event),
    onSelect: (event) => syncSelection(fieldKey, event),
  }), [registerFieldRef, syncSelection]);

  const insertMathToken = useCallback((token) => {
    const targetFieldKey = selectionRef.current.fieldKey || defaultFieldKey;
    const currentValue = String(getFieldValue(targetFieldKey) || '');
    const insertionValue = String(token?.value || '');
    const cursorOffset = Number(token?.cursorOffset || 0);
    const selectionStart = getSafeSelectionPosition(currentValue, selectionRef.current.start);
    const selectionEnd = getSafeSelectionPosition(currentValue, selectionRef.current.end);
    const safeSelectionEnd = Math.max(selectionStart, selectionEnd);
    const nextValue = `${currentValue.slice(0, selectionStart)}${insertionValue}${currentValue.slice(safeSelectionEnd)}`;
    const nextCursorPosition = Math.max(0, selectionStart + insertionValue.length + cursorOffset);

    updateFieldValue(targetFieldKey, nextValue);
    selectionRef.current = {
      fieldKey: targetFieldKey,
      start: nextCursorPosition,
      end: nextCursorPosition,
    };
    setActiveFieldKey((current) => (current === targetFieldKey ? current : targetFieldKey));
    focusFieldAt(targetFieldKey, nextCursorPosition);
  }, [defaultFieldKey, focusFieldAt, getFieldValue, updateFieldValue]);

  const activeFieldLabel = useMemo(
    () => getFieldLabel(activeFieldKey),
    [activeFieldKey, getFieldLabel]
  );

  return {
    activeFieldKey,
    activeFieldLabel,
    getMathFieldProps,
    insertMathToken,
  };
}
