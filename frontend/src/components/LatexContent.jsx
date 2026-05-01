import React, { useMemo } from 'react';
import katex from 'katex';

function isEscaped(text, index) {
  let backslashCount = 0;
  let cursor = index - 1;

  while (cursor >= 0 && text[cursor] === '\\') {
    backslashCount += 1;
    cursor -= 1;
  }

  return backslashCount % 2 === 1;
}

function findNextDelimiter(text, fromIndex) {
  for (let index = fromIndex; index < text.length; index += 1) {
    if (text[index] !== '$' || isEscaped(text, index)) {
      continue;
    }

    if (text[index + 1] === '$') {
      return {
        displayMode: true,
        delimiter: '$$',
        start: index,
      };
    }

    return {
      displayMode: false,
      delimiter: '$',
      start: index,
    };
  }

  return null;
}

function findClosingDelimiter(text, delimiter, fromIndex) {
  const isDisplayDelimiter = delimiter === '$$';

  for (let index = fromIndex; index < text.length; index += 1) {
    if (text[index] !== '$' || isEscaped(text, index)) {
      continue;
    }

    if (isDisplayDelimiter) {
      if (text[index + 1] === '$') {
        return index;
      }
      continue;
    }

    if (text[index + 1] === '$' || text[index - 1] === '$') {
      continue;
    }

    return index;
  }

  return -1;
}

function normalizeTextSegment(text) {
  return String(text || '').replace(/\\\$/g, '$');
}

function buildSegments(rawValue) {
  const text = String(rawValue || '');
  const segments = [];
  let cursor = 0;

  while (cursor < text.length) {
    const nextDelimiter = findNextDelimiter(text, cursor);

    if (!nextDelimiter) {
      segments.push({
        type: 'text',
        value: text.slice(cursor),
      });
      break;
    }

    if (nextDelimiter.start > cursor) {
      segments.push({
        type: 'text',
        value: text.slice(cursor, nextDelimiter.start),
      });
    }

    const closingIndex = findClosingDelimiter(
      text,
      nextDelimiter.delimiter,
      nextDelimiter.start + nextDelimiter.delimiter.length
    );

    if (closingIndex < 0) {
      segments.push({
        type: 'text',
        value: text.slice(nextDelimiter.start),
      });
      break;
    }

    const latexValue = text.slice(
      nextDelimiter.start + nextDelimiter.delimiter.length,
      closingIndex
    );

    segments.push({
      type: 'math',
      displayMode: nextDelimiter.displayMode,
      value: latexValue,
    });

    cursor = closingIndex + nextDelimiter.delimiter.length;
  }

  return segments;
}

function renderLatex(latex, displayMode) {
  return katex.renderToString(String(latex || ''), {
    displayMode,
    output: 'html',
    strict: 'ignore',
    throwOnError: false,
  });
}

function renderTextFragment(value, baseKey) {
  const normalizedValue = normalizeTextSegment(value);
  return normalizedValue.split('\n').map((part, index, parts) => (
    <React.Fragment key={`${baseKey}-${index}`}>
      {part}
      {index < parts.length - 1 ? <br /> : null}
    </React.Fragment>
  ));
}

export default function LatexContent({ content, className = '', placeholder = '' }) {
  const normalizedContent = String(content ?? '');
  const segments = useMemo(
    () => buildSegments(normalizedContent).map((segment, index) => (
      segment.type === 'math'
        ? {
            ...segment,
            key: `math-${index}`,
            html: renderLatex(segment.value, segment.displayMode),
          }
        : {
            ...segment,
            key: `text-${index}`,
          }
    )),
    [normalizedContent]
  );

  if (!normalizedContent.trim() && !placeholder) {
    return null;
  }

  const wrapperClassName = ['latex-content', className].filter(Boolean).join(' ');

  if (!normalizedContent.trim()) {
    return <div className={wrapperClassName}>{placeholder}</div>;
  }

  return (
    <div className={wrapperClassName}>
      {segments.map((segment) => (
        segment.type === 'math' ? (
          segment.displayMode ? (
            <div
              key={segment.key}
              className="latex-content-display"
              dangerouslySetInnerHTML={{ __html: segment.html }}
            />
          ) : (
            <span
              key={segment.key}
              className="latex-content-inline"
              dangerouslySetInnerHTML={{ __html: segment.html }}
            />
          )
        ) : (
          <React.Fragment key={segment.key}>
            {renderTextFragment(segment.value, segment.key)}
          </React.Fragment>
        )
      ))}
    </div>
  );
}
