import { sanitizeMaterialHtml } from './materialHtml';

const EMPTY_PAGE_HTML = '<p><br></p>';
const PAGE_DIMENSIONS = {
  portrait: { width: 794, height: 1123 },
  landscape: { width: 1123, height: 794 },
};
const PDF_VISUAL_SELECTOR = 'figure.material-pdf-page-visual';
const LEGACY_PDF_VISUAL_SELECTOR = 'figure.material-image-frame.material-image-wrap-full';

function isMeaningfulTextNode(node) {
  return node.nodeType === Node.TEXT_NODE && !!node.textContent?.trim();
}

function isSpacerElement(node) {
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return false;
  }

  if (!node.matches('p, div')) {
    return false;
  }

  if (node.querySelector('img, figure, table, ul, ol, blockquote, video, iframe')) {
    return false;
  }

  return [...node.childNodes].every((childNode) => (
    (childNode.nodeType === Node.TEXT_NODE && !childNode.textContent?.trim())
    || (childNode.nodeType === Node.ELEMENT_NODE && childNode.nodeName === 'BR')
  ));
}

function isPdfVisualBlock(node) {
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return false;
  }

  if (node.matches(PDF_VISUAL_SELECTOR)) {
    return true;
  }

  if (!node.matches(LEGACY_PDF_VISUAL_SELECTOR)) {
    return false;
  }

  return node.querySelectorAll('img').length === 1 && !node.textContent?.trim();
}

export function isMaterialPdfVisualHtml(html) {
  if (typeof document === 'undefined') {
    return String(html || '').includes('material-pdf-page-visual');
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(String(html || ''), 'text/html');
  const meaningfulNodes = [...doc.body.childNodes].filter((node) => (
    isMeaningfulTextNode(node)
    || (node.nodeType === Node.ELEMENT_NODE && !isSpacerElement(node))
  ));

  return meaningfulNodes.length === 1 && isPdfVisualBlock(meaningfulNodes[0]);
}

function normalizePreviewBlocks(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(String(html || ''), 'text/html');
  const blocks = [];

  [...doc.body.childNodes].forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      if (!node.textContent?.trim()) {
        return;
      }

      const paragraph = doc.createElement('p');
      paragraph.textContent = node.textContent;
      blocks.push(paragraph);
      return;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      blocks.push(node.cloneNode(true));
    }
  });

  if (blocks.length === 0) {
    const paragraph = doc.createElement('p');
    paragraph.innerHTML = '<br>';
    blocks.push(paragraph);
  }

  return blocks;
}

function serializePreviewNodes(nodes) {
  const wrapper = document.createElement('div');
  nodes.forEach((node) => {
    wrapper.appendChild(node.cloneNode(true));
  });

  return wrapper.innerHTML.trim() || EMPTY_PAGE_HTML;
}

function createMeasureShell({ orientation = 'portrait' } = {}) {
  const pageSize = PAGE_DIMENSIONS[orientation] || PAGE_DIMENSIONS.portrait;
  const rootNode = document.createElement('div');
  rootNode.className = 'admin-lexical-preview-measure';

  const pageNode = document.createElement('section');
  pageNode.className = 'admin-lexical-preview-page admin-lexical-preview-page-measure';
  pageNode.style.width = `${pageSize.width}px`;
  pageNode.style.minHeight = `${pageSize.height}px`;
  pageNode.style.height = `${pageSize.height}px`;

  const headerNode = document.createElement('div');
  headerNode.className = 'admin-lexical-preview-page-header';

  const labelNode = document.createElement('span');
  labelNode.className = 'admin-lexical-preview-page-label';
  labelNode.textContent = 'Halaman';

  const brandNode = document.createElement('div');
  brandNode.className = 'admin-lexical-preview-page-brand';
  brandNode.setAttribute('aria-hidden', 'true');

  const logoNode = document.createElement('img');
  logoNode.className = 'admin-lexical-preview-page-logo';
  logoNode.src = '/ujiin-logo.png';
  logoNode.alt = 'Ujiin';

  brandNode.appendChild(logoNode);
  headerNode.append(labelNode, brandNode);

  const bodyNode = document.createElement('div');
  bodyNode.className = 'admin-lexical-preview-page-body learning-rich-content';

  pageNode.append(headerNode, bodyNode);
  rootNode.appendChild(pageNode);
  document.body.appendChild(rootNode);

  return {
    cleanup() {
      rootNode.remove();
    },
    pageNode,
    bodyNode,
  };
}

export function paginateMaterialHtml(html, { orientation = 'portrait' } = {}) {
  if (typeof document === 'undefined') {
    return [sanitizeMaterialHtml(html) || EMPTY_PAGE_HTML];
  }

  const sanitizedHtml = sanitizeMaterialHtml(html) || EMPTY_PAGE_HTML;
  const blocks = normalizePreviewBlocks(sanitizedHtml);
  const nextPages = [];
  let currentPageNodes = [];

  const { bodyNode, cleanup, pageNode } = createMeasureShell({ orientation });

  try {
    const renderMeasurePage = (nodes) => {
      pageNode.classList.toggle(
        'admin-lexical-preview-page-pdf-visual',
        nodes.length === 1 && isPdfVisualBlock(nodes[0])
      );
      bodyNode.innerHTML = '';
      nodes.forEach((node) => {
        bodyNode.appendChild(node.cloneNode(true));
      });
    };

    blocks.forEach((block) => {
      if (isPdfVisualBlock(block)) {
        if (currentPageNodes.length > 0) {
          nextPages.push(serializePreviewNodes(currentPageNodes));
          currentPageNodes = [];
        }

        nextPages.push(serializePreviewNodes([block]));
        return;
      }

      if (isSpacerElement(block) && currentPageNodes.length === 0) {
        return;
      }

      const candidateNodes = [...currentPageNodes, block];
      renderMeasurePage(candidateNodes);

      if (bodyNode.scrollHeight > bodyNode.clientHeight + 1 && currentPageNodes.length > 0) {
        nextPages.push(serializePreviewNodes(currentPageNodes));
        currentPageNodes = [block];
        renderMeasurePage(currentPageNodes);
        return;
      }

      currentPageNodes = candidateNodes;
    });

    if (currentPageNodes.length > 0) {
      nextPages.push(serializePreviewNodes(currentPageNodes));
    }

    if (nextPages.length === 0) {
      nextPages.push(EMPTY_PAGE_HTML);
    }

    return nextPages;
  } finally {
    cleanup();
  }
}
