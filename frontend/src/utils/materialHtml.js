const ALLOWED_CLASS_NAMES = new Set([
  'material-image-frame',
  'material-image-wrap-inline',
  'material-image-wrap-left',
  'material-image-wrap-right',
  'material-image-wrap-center',
  'material-image-wrap-full',
  'material-pdf-page-visual',
  'material-pdf-page-visual-image',
  'material-list-preset-decimal-alpha-roman',
  'material-list-preset-decimal-decimal-decimal',
  'material-list-preset-disc-circle-square',
]);

const ALLOWED_STYLE_NAMES = new Set([
  'color',
  'background-color',
  'font-size',
  'font-style',
  'font-weight',
  'text-align',
  'text-decoration',
  'line-height',
  'margin-left',
  'margin-top',
  'margin-bottom',
  'text-indent',
  'list-style-type',
  'width',
  'max-width',
]);

function sanitizeStyleValue(value) {
  const normalizedValue = String(value || '').trim();
  if (!normalizedValue) {
    return '';
  }

  const loweredValue = normalizedValue.toLowerCase();
  if (
    loweredValue.includes('expression(')
    || loweredValue.includes('javascript:')
    || loweredValue.includes('url(')
  ) {
    return '';
  }

  return normalizedValue;
}

function sanitizeClassNames(className) {
  return String(className || '')
    .split(/\s+/)
    .map((name) => name.trim())
    .filter((name) => ALLOWED_CLASS_NAMES.has(name))
    .join(' ');
}

function sanitizeInlineStyles(styleValue) {
  const styleNode = document.createElement('div');
  styleNode.setAttribute('style', String(styleValue || ''));

  const sanitizedEntries = [];
  for (let index = 0; index < styleNode.style.length; index += 1) {
    const propertyName = styleNode.style[index];
    const propertyValue = sanitizeStyleValue(styleNode.style.getPropertyValue(propertyName));
    if (!propertyValue) {
      continue;
    }

    const isAllowedCustomProperty = propertyName.startsWith('--image-');
    if (!isAllowedCustomProperty && !ALLOWED_STYLE_NAMES.has(propertyName)) {
      continue;
    }

    sanitizedEntries.push(`${propertyName}:${propertyValue}`);
  }

  return sanitizedEntries.join('; ');
}

function sanitizeUrlAttribute(value) {
  const normalizedValue = String(value || '').trim();
  if (!normalizedValue) {
    return '';
  }

  const loweredValue = normalizedValue.toLowerCase();
  if (loweredValue.startsWith('javascript:')) {
    return '';
  }

  return normalizedValue;
}

export function sanitizeMaterialHtml(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(String(html || ''), 'text/html');

  doc.querySelectorAll('script, iframe, object, embed, link, meta, style').forEach((node) => node.remove());
  doc.body.querySelectorAll('*').forEach((node) => {
    [...node.attributes].forEach((attribute) => {
      const attributeName = attribute.name.toLowerCase();
      const attributeValue = attribute.value.trim();

      if (attributeName.startsWith('on')) {
        node.removeAttribute(attribute.name);
        return;
      }

      if (attributeName === 'class') {
        const nextClassName = sanitizeClassNames(attributeValue);
        if (nextClassName) {
          node.setAttribute('class', nextClassName);
        } else {
          node.removeAttribute(attribute.name);
        }
        return;
      }

      if (attributeName === 'style') {
        const nextStyleValue = sanitizeInlineStyles(attributeValue);
        if (nextStyleValue) {
          node.setAttribute('style', nextStyleValue);
        } else {
          node.removeAttribute(attribute.name);
        }
        return;
      }

      if (attributeName === 'href' || attributeName === 'src') {
        const nextUrlValue = sanitizeUrlAttribute(attributeValue);
        if (nextUrlValue) {
          node.setAttribute(attribute.name, nextUrlValue);
        } else {
          node.removeAttribute(attribute.name);
        }
      }
    });
  });

  return doc.body.innerHTML.trim();
}
