import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import AccountShell from '../components/AccountShell';
import apiClient from '../api';

const APP_BASE_PATH = import.meta.env.BASE_URL || '/';
const PDF_WORKER_PATH = `${APP_BASE_PATH.replace(/\/$/, '')}/pdfjs/pdf.worker.min.js`;
const OCR_ASSET_ROOT = `${APP_BASE_PATH.replace(/\/$/, '')}/tesseract`;
const OCR_WORKER_PATH = `${OCR_ASSET_ROOT}/worker/worker.min.js`;
const OCR_CORE_PATH = `${OCR_ASSET_ROOT}/core/tesseract-core-lstm.wasm.js`;
const OCR_LANG_PATH = `${OCR_ASSET_ROOT}/lang-data`;
const OCR_LANGUAGE = 'eng';
const PARAGRAPH_INDENT_STEP = 36;
const FIRST_LINE_INDENT_LIMIT = 72;
const PARAGRAPH_INDENT_LIMIT = 240;
const WORD_RULER_MARKS = {
  portrait: ['0', '2', '4', '6', '8', '10', '12', '14', '16', '18'],
  landscape: ['0', '3', '6', '9', '12', '15', '18', '21', '24', '27'],
};
const BULLET_LIST_STYLE_OPTIONS = [
  { value: 'disc', label: 'Bullet' },
  { value: 'circle', label: 'Lingkaran' },
  { value: 'square', label: 'Kotak' },
];
const ORDERED_LIST_STYLE_OPTIONS = [
  { value: 'decimal', label: '1. 2. 3.' },
  { value: 'lower-alpha', label: 'a. b. c.' },
  { value: 'upper-alpha', label: 'A. B. C.' },
  { value: 'upper-roman', label: 'I. II. III.' },
];
const MULTILEVEL_LIST_STYLE_OPTIONS = [
  { value: 'decimal-alpha-roman', label: '1. a. i.' },
  { value: 'decimal-decimal-decimal', label: '1.1.1.' },
  { value: 'disc-circle-square', label: 'Bullet Bertingkat' },
];

const FONT_SIZE_COMMANDS = {
  '12': '2',
  '14': '3',
  '16': '4',
  '20': '5',
  '28': '6',
  '36': '7',
};
const FONT_SIZE_PRESET_VALUES = ['12', '14', '16', '20', '28', '36'];
const DEFAULT_EDITOR_FORMAT_STATE = {
  blockType: 'p',
  fontSize: '16',
  textColor: '#16243c',
  bold: false,
  italic: false,
  underline: false,
  strikeThrough: false,
  align: 'left',
  isBulletList: false,
  isOrderedList: false,
};

const createEmptyMaterialPage = (order = 1) => ({
  title: `Halaman ${order}`,
  points: [''],
  closing: '',
  content_html: '<p><br></p>',
});

const createEmptyMaterialTopic = (order = 1) => ({
  title: `Topik ${order}`,
  pages: [],
});

const IMAGE_WRAP_OPTIONS = [
  ['inline', 'Sejajar Teks'],
  ['left', 'Wrap Kiri'],
  ['right', 'Wrap Kanan'],
  ['center', 'Tengah'],
  ['full', 'Lebar Penuh'],
];
const MATERIAL_LIST_PRESET_CLASSES = [
  'material-list-preset-decimal-alpha-roman',
  'material-list-preset-decimal-decimal-decimal',
  'material-list-preset-disc-circle-square',
];
const HISTORY_TYPING_MERGE_WINDOW = 900;
const HISTORY_SOURCE_PRIORITY = {
  system: 0,
  generic: 1,
  navigation: 1,
  typing: 2,
  format: 2,
  metadata: 2,
  layout: 2,
  structure: 3,
  history: 4,
};

function RibbonIcon({ type }) {
  const icons = {
    bullet: (
      <>
        <span className="admin-toolbar-icon-dot" />
        <span className="admin-toolbar-icon-line admin-toolbar-icon-line-wide" />
        <span className="admin-toolbar-icon-dot" />
        <span className="admin-toolbar-icon-line admin-toolbar-icon-line-wide" />
        <span className="admin-toolbar-icon-dot" />
        <span className="admin-toolbar-icon-line admin-toolbar-icon-line-wide" />
      </>
    ),
    ordered: (
      <>
        <span className="admin-toolbar-icon-order">1</span>
        <span className="admin-toolbar-icon-line admin-toolbar-icon-line-wide" />
        <span className="admin-toolbar-icon-order">2</span>
        <span className="admin-toolbar-icon-line admin-toolbar-icon-line-wide" />
        <span className="admin-toolbar-icon-order">3</span>
        <span className="admin-toolbar-icon-line admin-toolbar-icon-line-wide" />
      </>
    ),
    multilevel: (
      <>
        <span className="admin-toolbar-icon-order">1</span>
        <span className="admin-toolbar-icon-line admin-toolbar-icon-line-wide" />
        <span className="admin-toolbar-icon-order admin-toolbar-icon-order-nested">a</span>
        <span className="admin-toolbar-icon-line admin-toolbar-icon-line-medium" />
        <span className="admin-toolbar-icon-order admin-toolbar-icon-order-deep">i</span>
        <span className="admin-toolbar-icon-line admin-toolbar-icon-line-narrow" />
      </>
    ),
    alignLeft: (
      <>
        <span className="admin-toolbar-icon-line admin-toolbar-icon-line-wide" />
        <span className="admin-toolbar-icon-line admin-toolbar-icon-line-medium" />
        <span className="admin-toolbar-icon-line admin-toolbar-icon-line-wide" />
        <span className="admin-toolbar-icon-line admin-toolbar-icon-line-narrow" />
      </>
    ),
    alignCenter: (
      <>
        <span className="admin-toolbar-icon-line admin-toolbar-icon-line-center-wide" />
        <span className="admin-toolbar-icon-line admin-toolbar-icon-line-center-medium" />
        <span className="admin-toolbar-icon-line admin-toolbar-icon-line-center-wide" />
        <span className="admin-toolbar-icon-line admin-toolbar-icon-line-center-narrow" />
      </>
    ),
    alignRight: (
      <>
        <span className="admin-toolbar-icon-line admin-toolbar-icon-line-right-wide" />
        <span className="admin-toolbar-icon-line admin-toolbar-icon-line-right-medium" />
        <span className="admin-toolbar-icon-line admin-toolbar-icon-line-right-wide" />
        <span className="admin-toolbar-icon-line admin-toolbar-icon-line-right-narrow" />
      </>
    ),
    alignJustify: (
      <>
        <span className="admin-toolbar-icon-line admin-toolbar-icon-line-wide" />
        <span className="admin-toolbar-icon-line admin-toolbar-icon-line-wide" />
        <span className="admin-toolbar-icon-line admin-toolbar-icon-line-wide" />
        <span className="admin-toolbar-icon-line admin-toolbar-icon-line-wide" />
      </>
    ),
  };

  return <span className={`admin-toolbar-icon admin-toolbar-icon-${type}`}>{icons[type] || null}</span>;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getImageFigureHtml(url, layout = 'center') {
  const safeUrl = escapeHtml(url);
  return `
    <figure
      class="material-image-frame material-image-wrap-${layout}"
      style="--image-width: 320px; --image-margin-top: 16px; --image-margin-bottom: 16px;"
    >
      <img src="${safeUrl}" alt="Gambar materi" />
    </figure>
    <p><br></p>
  `;
}

function pageToHtml(page) {
  if (page.content_html) {
    return sanitizeEditorHtml(page.content_html);
  }

  const points = Array.isArray(page.points) ? page.points : String(page.points || '').split('\n');
  const pointItems = points
    .map((point) => String(point || '').trim())
    .filter(Boolean)
    .map((point) => `<li>${escapeHtml(point)}</li>`)
    .join('');
  const closing = String(page.closing || '').trim();

  return [
    pointItems ? `<ul>${pointItems}</ul>` : '<p><br></p>',
    closing ? `<p><strong>Rangkuman:</strong> ${escapeHtml(closing)}</p>` : '',
  ].join('');
}

function plainTextToEditorHtml(value) {
  const normalizedText = String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  const paragraphs = normalizedText
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) {
    return '<p><br></p>';
  }

  return paragraphs
    .map((paragraph) => `<p>${paragraph.split('\n').map((line) => escapeHtml(line)).join('<br>')}</p>`)
    .join('');
}

function sanitizeEditorHtml(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(String(html || ''), 'text/html');
  doc.querySelectorAll('script, iframe, object, embed, link, meta, style').forEach((node) => node.remove());
  doc.body.querySelectorAll('*').forEach((node) => {
    [...node.attributes].forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim().toLowerCase();
      if (name.startsWith('on') || value.startsWith('javascript:')) {
        node.removeAttribute(attribute.name);
      }
    });
  });
  return doc.body.innerHTML.trim();
}

function extractPointsFromHtml(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(String(html || ''), 'text/html');
  const items = [...doc.querySelectorAll('li')]
    .map((item) => item.textContent.trim())
    .filter(Boolean);

  if (items.length > 0) {
    return items;
  }

  return doc.body.textContent
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function getMaterialTopics(material) {
  if (Array.isArray(material?.topics)) {
    return material.topics;
  }

  if (Array.isArray(material?.pages) && material.pages.length > 0) {
    return material.pages.map((page, index) => ({
      title: page.title || `Topik ${index + 1}`,
      pages: [page],
    }));
  }

  return [];
}

function normalizeMaterialStatus(value) {
  return value === 'draft' ? 'draft' : 'published';
}

function cloneHistoryValue(value) {
  if (typeof window !== 'undefined' && typeof window.structuredClone === 'function') {
    return window.structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

function getMaterialStatusLabel(status) {
  return normalizeMaterialStatus(status) === 'draft' ? 'Draft Admin' : 'Published';
}

function formatPublishedAt(value) {
  if (!value) {
    return 'Belum pernah dipublish';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Tanggal publish belum tersedia';
  }

  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
}

function shouldAutoRenameMaterialPage(title) {
  const normalizedTitle = String(title || '').trim();
  return normalizedTitle === '' || /^Halaman\s+\d+$/i.test(normalizedTitle);
}

function renumberMaterialPages(pages = []) {
  return pages.map((page, pageIndex) => ({
    ...page,
    title: shouldAutoRenameMaterialPage(page?.title) ? `Halaman ${pageIndex + 1}` : page.title,
  }));
}

function formatFileSize(bytes = 0) {
  const safeBytes = Number(bytes || 0);
  if (!Number.isFinite(safeBytes) || safeBytes <= 0) {
    return '0 KB';
  }

  if (safeBytes < 1024) {
    return `${safeBytes} B`;
  }

  const units = ['KB', 'MB', 'GB'];
  let value = safeBytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}

function buildDefaultPdfImportOptions() {
  return {
    visible: false,
    mode: 'replace',
    startPage: '1',
    pdfPageFrom: '1',
    pdfPageTo: '',
  };
}

function extractPdfTextFromItems(items = []) {
  let buffer = '';
  let previousY = null;

  items.forEach((item) => {
    const nextText = String(item?.str || '');
    if (!nextText) {
      return;
    }

    const currentY = Array.isArray(item?.transform) ? Number(item.transform[5] || 0) : null;
    if (buffer && currentY !== null && previousY !== null && Math.abs(currentY - previousY) > 6) {
      buffer += '\n';
    } else if (buffer && !buffer.endsWith('\n') && !buffer.endsWith(' ')) {
      buffer += ' ';
    }

    buffer += nextText;
    if (item?.hasEOL) {
      buffer += '\n';
    }

    previousY = currentY;
  });

  return String(buffer)
    .replaceAll('\u0000', '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function buildImportedPdfPageHtml(text, imageUrl = '', { pageNumber = 1, usedOcr = false } = {}) {
  const paragraphs = String(text || '')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\n/g, ' ').trim())
    .filter(Boolean);

  const textHtml = paragraphs.length > 0
    ? paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')
    : `<p><em>${usedOcr ? 'OCR tidak menemukan teks yang cukup jelas.' : 'Teks halaman PDF tidak terbaca otomatis.'}</em></p>`;

  const imageHtml = imageUrl
    ? `
      <div style="margin-top:1rem;">
        <p style="margin-bottom:0.5rem; color:#5b6f8d; font-size:0.92rem; font-weight:700;">
          Visual halaman PDF ${pageNumber}
        </p>
        ${getImageFigureHtml(imageUrl, 'full')}
      </div>
    `
    : '';

  return sanitizeEditorHtml(`${textHtml}${imageHtml}`);
}

function getClosestEditableBlock(node, root) {
  if (!node || !root) {
    return null;
  }

  const elementNode = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  if (!(elementNode instanceof Element) || !root.contains(elementNode)) {
    return null;
  }

  return elementNode.closest('p, div, li, blockquote, h1, h2, h3, h4, h5, h6, td, th');
}

function parseIndentValue(value) {
  const parsed = parseFloat(String(value || '').replace('px', '').trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function rgbToHex(value) {
  const normalizedValue = String(value || '').trim();
  if (!normalizedValue) {
    return DEFAULT_EDITOR_FORMAT_STATE.textColor;
  }

  if (normalizedValue.startsWith('#')) {
    if (normalizedValue.length === 4) {
      return `#${normalizedValue[1]}${normalizedValue[1]}${normalizedValue[2]}${normalizedValue[2]}${normalizedValue[3]}${normalizedValue[3]}`.toLowerCase();
    }
    return normalizedValue.toLowerCase();
  }

  const matched = normalizedValue.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!matched) {
    return DEFAULT_EDITOR_FORMAT_STATE.textColor;
  }

  return `#${matched
    .slice(1, 4)
    .map((channel) => Number(channel).toString(16).padStart(2, '0'))
    .join('')}`.toLowerCase();
}

function resolveEditorFontSize(value) {
  const parsedSize = parseFloat(String(value || '').replace('px', '').trim());
  if (!Number.isFinite(parsedSize)) {
    return DEFAULT_EDITOR_FORMAT_STATE.fontSize;
  }

  return FONT_SIZE_PRESET_VALUES.reduce((closestValue, currentValue) => (
    Math.abs(Number(currentValue) - parsedSize) < Math.abs(Number(closestValue) - parsedSize)
      ? currentValue
      : closestValue
  ), DEFAULT_EDITOR_FORMAT_STATE.fontSize);
}

function normalizeEditorBlockType(tagName) {
  const normalizedTagName = String(tagName || '').toLowerCase();
  if (normalizedTagName === 'h1' || normalizedTagName === 'h2') {
    return 'h2';
  }
  if (['h3', 'h4', 'h5', 'h6'].includes(normalizedTagName)) {
    return 'h3';
  }
  return 'p';
}

function normalizeEditorAlignment(value) {
  const normalizedValue = String(value || '').toLowerCase();
  if (normalizedValue === 'center') {
    return 'center';
  }
  if (normalizedValue === 'right' || normalizedValue === 'end') {
    return 'right';
  }
  if (normalizedValue === 'justify') {
    return 'justify';
  }
  return 'left';
}

function getEditorPageIndexFromNode(node) {
  if (!node) {
    return null;
  }

  const elementNode = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  if (!(elementNode instanceof Element)) {
    return null;
  }

  const editorNode = elementNode.closest('.admin-word-editable');
  if (!(editorNode instanceof HTMLElement)) {
    return null;
  }

  const parsed = Number(editorNode.dataset.pageIndex || 0);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : null;
}

function getSelectionPageBounds(selection, fallbackPageIndex = 0) {
  if (!selection) {
    return {
      anchorPageIndex: fallbackPageIndex,
      focusPageIndex: fallbackPageIndex,
      startPageIndex: fallbackPageIndex,
      endPageIndex: fallbackPageIndex,
    };
  }

  const anchorPageIndex = getEditorPageIndexFromNode(selection.anchorNode) ?? fallbackPageIndex;
  const focusPageIndex = getEditorPageIndexFromNode(selection.focusNode) ?? anchorPageIndex;

  return {
    anchorPageIndex,
    focusPageIndex,
    startPageIndex: Math.min(anchorPageIndex, focusPageIndex),
    endPageIndex: Math.max(anchorPageIndex, focusPageIndex),
  };
}

function buildNodePath(rootNode, targetNode) {
  if (!rootNode || !targetNode) {
    return null;
  }

  const path = [];
  let currentNode = targetNode;

  while (currentNode && currentNode !== rootNode) {
    const parentNode = currentNode.parentNode;
    if (!parentNode) {
      return null;
    }

    path.unshift([...parentNode.childNodes].indexOf(currentNode));
    currentNode = parentNode;
  }

  return currentNode === rootNode ? path : null;
}

function resolveNodePath(rootNode, path = []) {
  if (!rootNode) {
    return null;
  }

  return path.reduce((currentNode, childIndex) => (
    currentNode?.childNodes?.[childIndex] || null
  ), rootNode);
}

export default function AdminLearningMaterialEditor() {
  const { packageId, sectionCode } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const editorHostRef = useRef(null);
  const editorRefs = useRef({});
  const rulerScaleRef = useRef(null);
  const imageUploadInputRef = useRef(null);
  const pdfImportInputRef = useRef(null);
  const pdfOcrWorkerRef = useRef(null);
  const paginationFrameRef = useRef(null);
  const [learningContent, setLearningContent] = useState([]);
  const [materialForm, setMaterialForm] = useState({ title: '', topics: [] });
  const [materialMeta, setMaterialMeta] = useState({
    status: 'published',
    sourceUrl: '',
    reviewNotes: '',
    publishedAt: null,
  });
  const [activeTopicIndex, setActiveTopicIndex] = useState(0);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [pdfImporting, setPdfImporting] = useState(false);
  const [pdfImportProgress, setPdfImportProgress] = useState('');
  const [pdfImportOptions, setPdfImportOptions] = useState(buildDefaultPdfImportOptions);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [selectedPdfImportFile, setSelectedPdfImportFile] = useState(null);
  const [selectedPdfImportPageCount, setSelectedPdfImportPageCount] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeRibbonTab, setActiveRibbonTab] = useState('home');
  const [editorFormatState, setEditorFormatState] = useState(DEFAULT_EDITOR_FORMAT_STATE);
  const [pageOrientation, setPageOrientation] = useState('portrait');
  const [pageZoom, setPageZoom] = useState('100');
  const [editorView, setEditorView] = useState('page');
  const [focusMode, setFocusMode] = useState(false);
  const [editorRenderNonce, setEditorRenderNonce] = useState(0);
  const selectedImageFigureRef = useRef(null);
  const imageInteractionRef = useRef(null);
  const [imageContextMenu, setImageContextMenu] = useState({ visible: false, x: 0, y: 0, layout: 'center' });
  const [activeParagraphMetrics, setActiveParagraphMetrics] = useState({
    pageIndex: 0,
    leftIndent: 0,
    firstLineIndent: 0,
  });
  const paragraphRulerDragRef = useRef(null);
  const [pendingPaginationStart, setPendingPaginationStart] = useState(null);
  const pendingEnterPageFocusRef = useRef(null);
  const savedSelectionRangeRef = useRef(null);
  const savedSelectionPageIndexRef = useRef(null);
  const pendingMutationContextRef = useRef(null);
  const pendingHistorySelectionRef = useRef(null);
  const pendingHistoryScrollRef = useRef(null);
  const historyStateRef = useRef({
    initialized: false,
    restoring: false,
    currentSnapshot: null,
    currentSerialized: '',
    undoStack: [],
    redoStack: [],
    lastSource: 'system',
    lastCommitAt: 0,
  });
  const pendingHistorySourceRef = useRef('system');

  const numericPackageId = Number(packageId);
  const workspace = searchParams.get('workspace') === 'draft' ? 'draft' : 'published';
  const isDraftWorkspace = workspace === 'draft';
  const requestedTopicParam = searchParams.get('topic') || '0';
  const shouldCreateTopic = requestedTopicParam === 'new';
  const requestedTopicIndex = useMemo(() => {
    if (shouldCreateTopic) {
      return -1;
    }

    const parsed = Number(requestedTopicParam || 0);
    if (!Number.isFinite(parsed)) {
      return 0;
    }

    return Math.max(0, Math.floor(parsed));
  }, [requestedTopicParam, shouldCreateTopic]);
  const requestedPageIndex = useMemo(() => {
    const parsed = Number(searchParams.get('page') || 0);
    if (!Number.isFinite(parsed)) {
      return 0;
    }

    return Math.max(0, Math.floor(parsed));
  }, [searchParams]);
  const activeSection = useMemo(
    () => learningContent.find((section) => section.code === sectionCode) || null,
    [learningContent, sectionCode]
  );
  const activeMaterialStatus = normalizeMaterialStatus(materialMeta.status);
  const activeTopic = materialForm.topics[activeTopicIndex] || null;
  const activePage = activeTopic?.pages?.[activePageIndex] || null;
  const getEditorNode = useCallback((pageIndex = activePageIndex) => editorRefs.current[pageIndex] || null, [activePageIndex]);
  const focusEditorHost = useCallback(() => {
    editorHostRef.current?.focus();
  }, []);
  const focusEditorAtEnd = useCallback((pageIndex) => {
    requestAnimationFrame(() => {
      const editorNode = editorRefs.current[pageIndex];
      if (!editorNode) {
        return;
      }

      focusEditorHost();
      const selection = window.getSelection();
      if (!selection) {
        return;
      }

      const range = document.createRange();
      range.selectNodeContents(editorNode);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    });
  }, [focusEditorHost]);
  const markHistorySource = useCallback((source = 'generic') => {
    const currentSource = pendingHistorySourceRef.current || 'generic';
    const nextPriority = HISTORY_SOURCE_PRIORITY[source] ?? HISTORY_SOURCE_PRIORITY.generic;
    const currentPriority = HISTORY_SOURCE_PRIORITY[currentSource] ?? HISTORY_SOURCE_PRIORITY.generic;

    if (nextPriority >= currentPriority) {
      pendingHistorySourceRef.current = source;
    }
  }, []);
  const captureCurrentSelectionBookmark = useCallback((preferredPageIndex = activePageIndex) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      const fallbackPageIndex = Math.max(0, preferredPageIndex);
      return {
        anchor: {
          pageIndex: fallbackPageIndex,
          path: [],
          offset: 0,
        },
        focus: {
          pageIndex: fallbackPageIndex,
          path: [],
          offset: 0,
        },
        isCollapsed: true,
        activePageIndex: fallbackPageIndex,
      };
    }

    const serializePoint = (node, offset) => {
      const pageIndex = getEditorPageIndexFromNode(node) ?? preferredPageIndex;
      const editorNode = editorRefs.current[pageIndex];
      const resolvedNode = editorNode && node && editorNode.contains(node) ? node : editorNode;
      const path = buildNodePath(editorNode, resolvedNode) || [];
      const safeOffset = resolvedNode?.nodeType === Node.TEXT_NODE
        ? Math.min(Number(offset || 0), resolvedNode.textContent?.length || 0)
        : Math.min(Number(offset || 0), resolvedNode?.childNodes?.length || 0);

      return {
        pageIndex,
        path,
        offset: safeOffset,
      };
    };

    const pageBounds = getSelectionPageBounds(selection, preferredPageIndex);

    return {
      anchor: serializePoint(selection.anchorNode, selection.anchorOffset),
      focus: serializePoint(selection.focusNode, selection.focusOffset),
      isCollapsed: selection.isCollapsed,
      activePageIndex: pageBounds.anchorPageIndex,
    };
  }, [activePageIndex]);
  const createHistorySnapshot = useCallback(() => cloneHistoryValue({
    materialForm,
    materialMeta,
    activeTopicIndex,
    activePageIndex,
    pageOrientation,
    pageZoom,
    editorView,
    focusMode,
    selectionBookmark: captureCurrentSelectionBookmark(),
    scrollY: typeof window !== 'undefined' ? window.scrollY : 0,
  }), [
    activePageIndex,
    activeTopicIndex,
    captureCurrentSelectionBookmark,
    editorView,
    focusMode,
    materialForm,
    materialMeta,
    pageOrientation,
    pageZoom,
  ]);

  const syncSelectionInUrl = useCallback((topicIndex, pageIndex = 0) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('topic', String(Math.max(0, topicIndex)));
    nextParams.set('page', String(Math.max(0, pageIndex)));
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const activatePage = useCallback((pageIndex, syncUrl = true) => {
    if (pageIndex === activePageIndex) {
      return false;
    }

    markHistorySource('navigation');
    setActivePageIndex(pageIndex);
    if (syncUrl) {
      syncSelectionInUrl(activeTopicIndex, pageIndex);
    }
    return true;
  }, [activePageIndex, activeTopicIndex, markHistorySource, syncSelectionInUrl]);

  const fetchLearningContent = useCallback(async () => {
    if (!Number.isInteger(numericPackageId) || numericPackageId <= 0 || !sectionCode) {
      setError('Link editor materi tidak valid.');
      setLoading(false);
      return;
    }

    try {
      const response = await apiClient.get(`/admin/learning-content?package_id=${numericPackageId}&workspace=${workspace}&_=${Date.now()}`);
      const sections = response.data.data?.sections || [];
      const section = sections.find((item) => item.code === sectionCode);
      setLearningContent(sections);

      if (!section) {
        setError('Subtest tidak ditemukan pada paket ini.');
        return;
      }

      const persistedTopics = getMaterialTopics(section.material);
      const nextTopics = shouldCreateTopic
        ? [...persistedTopics, createEmptyMaterialTopic(persistedTopics.length + 1)]
        : persistedTopics;

      const normalizedTopics = nextTopics.map((topic, topicIndex) => ({
        title: topic.title || `Topik ${topicIndex + 1}`,
        pages: (Array.isArray(topic.pages) ? topic.pages : []).map((page, pageIndex) => ({
          title: page.title || `Halaman ${pageIndex + 1}`,
          points: Array.isArray(page.points) ? page.points : String(page.points || '').split('\n'),
          closing: page.closing || '',
          content_html: pageToHtml(page),
        })),
      }));

      setMaterialForm({
        title: section.material?.title || section.name || '',
        topics: normalizedTopics,
      });
      setMaterialMeta({
        status: normalizeMaterialStatus(section.material?.status),
        sourceUrl: section.material?.source_url || '',
        reviewNotes: section.material?.review_notes || '',
        publishedAt: section.material?.published_at || null,
      });
      const resolvedTopicIndex = normalizedTopics.length === 0
        ? 0
        : (shouldCreateTopic
            ? Math.max(0, normalizedTopics.length - 1)
            : Math.min(requestedTopicIndex, Math.max(0, normalizedTopics.length - 1)));
      const resolvedPageCount = normalizedTopics[resolvedTopicIndex]?.pages?.length || 0;
      const resolvedPageIndex = resolvedPageCount > 0
        ? Math.min(requestedPageIndex, Math.max(0, resolvedPageCount - 1))
        : 0;
      setActiveTopicIndex(resolvedTopicIndex);
      setActivePageIndex(resolvedPageIndex);
      if (!shouldCreateTopic && normalizedTopics.length > 0 && requestedPageIndex !== resolvedPageIndex) {
        syncSelectionInUrl(resolvedTopicIndex, resolvedPageIndex);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal memuat materi subtest');
    } finally {
      setLoading(false);
    }
  }, [numericPackageId, requestedPageIndex, requestedTopicIndex, sectionCode, shouldCreateTopic, syncSelectionInUrl, workspace]);

  useEffect(() => {
    fetchLearningContent();
  }, [fetchLearningContent]);

  useEffect(() => {
    historyStateRef.current = {
      initialized: false,
      restoring: false,
      currentSnapshot: null,
      currentSerialized: '',
      undoStack: [],
      redoStack: [],
      lastSource: 'system',
      lastCommitAt: 0,
    };
    pendingHistorySourceRef.current = 'system';
  }, [numericPackageId, sectionCode, workspace]);

  const syncLearningMaterialState = useCallback((nextMaterial) => {
    setLearningContent((current) => current.map((section) => (
      section.code === sectionCode
        ? {
            ...section,
            material: {
              ...(section.material || {}),
              ...nextMaterial,
            },
          }
        : section
    )));
  }, [sectionCode]);

  useEffect(() => {
    if (materialForm.topics.length === 0) {
      setActiveTopicIndex(0);
      return;
    }

    const nextTopicIndex = Math.min(Math.max(requestedTopicIndex, 0), materialForm.topics.length - 1);
    if (!shouldCreateTopic && nextTopicIndex !== activeTopicIndex) {
      setActiveTopicIndex(nextTopicIndex);
    }
  }, [activeTopicIndex, materialForm.topics.length, requestedTopicIndex, shouldCreateTopic]);

  useEffect(() => {
    const pageCount = activeTopic?.pages?.length || 0;
    if (pageCount === 0) {
      if (activePageIndex !== 0) {
        setActivePageIndex(0);
      }
      return;
    }

    const nextPageIndex = Math.min(requestedPageIndex, pageCount - 1);
    if (nextPageIndex !== activePageIndex) {
      setActivePageIndex(nextPageIndex);
    }
  }, [activePageIndex, activeTopic?.pages, requestedPageIndex]);

  useEffect(() => {
    if (!activeTopic || (activeTopic.pages?.length || 0) > 0) {
      return;
    }

    setMaterialForm((current) => ({
      ...current,
      topics: current.topics.map((topic, index) => (
        index === activeTopicIndex
          ? { ...topic, pages: [createEmptyMaterialPage(1)] }
          : topic
      )),
    }));
    setActivePageIndex(0);
    syncSelectionInUrl(activeTopicIndex, 0);
  }, [activeTopic, activeTopicIndex, syncSelectionInUrl]);

  useEffect(() => {
    setPdfImportOptions(buildDefaultPdfImportOptions());
    setSelectedPdfImportFile(null);
    setSelectedPdfImportPageCount(0);
  }, [activeTopicIndex]);

  const isMeaningfulEditorNode = useCallback((node) => {
    if (!node) {
      return false;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      return Boolean(node.textContent?.trim());
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return false;
    }

    if (node.matches('img, table, figure, hr, blockquote')) {
      return true;
    }

    if (node.matches('p, div, h1, h2, h3, h4, h5, h6, li, ul, ol')) {
      return node.textContent.trim() !== '' || node.querySelector('img, table, figure, hr') !== null;
    }

    return node.textContent.trim() !== '';
  }, []);

  const isEmptyEditorBreakNode = useCallback((node) => {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) {
      return false;
    }

    if (!node.matches('p, div, li, blockquote, h1, h2, h3, h4, h5, h6')) {
      return false;
    }

    return node.textContent.trim() === '' && node.querySelector('img, table, figure, hr') === null;
  }, []);

  const setSelectionRange = useCallback((range) => {
    const selection = window.getSelection();
    if (!selection || !range) {
      return false;
    }

    selection.removeAllRanges();
    selection.addRange(range);
    return true;
  }, []);

  const rememberCurrentSelection = useCallback((preferredPageIndex = activePageIndex) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return null;
    }

    const pageIndex = getEditorPageIndexFromNode(selection.anchorNode) ?? preferredPageIndex;
    const editorNode = editorRefs.current[pageIndex];
    if (!editorNode || !editorNode.contains(selection.anchorNode)) {
      return null;
    }

    savedSelectionRangeRef.current = selection.getRangeAt(0).cloneRange();
    savedSelectionPageIndexRef.current = pageIndex;
    return pageIndex;
  }, [activePageIndex]);

  const restoreSavedSelection = useCallback((preferredPageIndex = activePageIndex) => {
    const currentSelection = window.getSelection();
    const currentPageIndex = getEditorPageIndexFromNode(currentSelection?.anchorNode);
    if (currentSelection && currentSelection.rangeCount > 0 && currentPageIndex !== null) {
      return {
        pageIndex: currentPageIndex,
        editorNode: editorRefs.current[currentPageIndex] || null,
      };
    }

    const savedRange = savedSelectionRangeRef.current;
    const savedPageIndex = savedSelectionPageIndexRef.current ?? preferredPageIndex;
    const editorNode = editorRefs.current[savedPageIndex] || null;
    if (!savedRange || !editorNode) {
      return {
        pageIndex: preferredPageIndex,
        editorNode: editorRefs.current[preferredPageIndex] || null,
      };
    }

    focusEditorHost();
    setSelectionRange(savedRange.cloneRange());
    return {
      pageIndex: savedPageIndex,
      editorNode,
    };
  }, [activePageIndex, focusEditorHost, setSelectionRange]);
  const restoreSelectionBookmark = useCallback((bookmark, preferredPageIndex = activePageIndex) => {
    if (!bookmark) {
      return false;
    }

    const resolvePoint = (point) => {
      const pageIndex = Math.max(0, Number(point?.pageIndex ?? preferredPageIndex));
      const editorNode = editorRefs.current[pageIndex];
      if (!editorNode) {
        return null;
      }

      const targetNode = resolveNodePath(editorNode, Array.isArray(point?.path) ? point.path : []) || editorNode;
      const safeOffset = targetNode.nodeType === Node.TEXT_NODE
        ? Math.min(Number(point?.offset || 0), targetNode.textContent?.length || 0)
        : Math.min(Number(point?.offset || 0), targetNode.childNodes?.length || 0);

      return {
        pageIndex,
        editorNode,
        node: targetNode,
        offset: safeOffset,
      };
    };

    const anchorPoint = resolvePoint(bookmark.anchor);
    const focusPoint = resolvePoint(bookmark.focus || bookmark.anchor);
    if (!anchorPoint || !focusPoint) {
      return false;
    }

    focusEditorHost();

    const selection = window.getSelection();
    if (!selection) {
      return false;
    }

    const range = document.createRange();
    const anchorStartsAfterFocus = anchorPoint.node === focusPoint.node
      ? anchorPoint.offset > focusPoint.offset
      : Boolean(anchorPoint.node.compareDocumentPosition(focusPoint.node) & Node.DOCUMENT_POSITION_PRECEDING);
    const startPoint = anchorStartsAfterFocus ? focusPoint : anchorPoint;
    const endPoint = anchorStartsAfterFocus ? anchorPoint : focusPoint;

    range.setStart(startPoint.node, startPoint.offset);
    range.setEnd(endPoint.node, endPoint.offset);
    selection.removeAllRanges();
    selection.addRange(range);

    if (!bookmark.isCollapsed && typeof selection.setBaseAndExtent === 'function') {
      selection.setBaseAndExtent(
        anchorPoint.node,
        anchorPoint.offset,
        focusPoint.node,
        focusPoint.offset
      );
    }

    savedSelectionRangeRef.current = range.cloneRange();
    savedSelectionPageIndexRef.current = anchorPoint.pageIndex;
    return true;
  }, [activePageIndex, focusEditorHost]);

  const placeCaretInsideNode = useCallback((node, collapseToStart = false) => {
    if (!node) {
      return false;
    }

    const range = document.createRange();
    if (node.nodeType === Node.TEXT_NODE) {
      const textLength = node.textContent?.length || 0;
      range.setStart(node, collapseToStart ? 0 : textLength);
      range.collapse(true);
      return setSelectionRange(range);
    }

    range.selectNodeContents(node);
    range.collapse(collapseToStart);
    return setSelectionRange(range);
  }, [setSelectionRange]);

  const ensureEditorLeadingParagraph = useCallback((editorNode) => {
    if (!editorNode) {
      return null;
    }

    const firstRelevantNode = [...editorNode.childNodes].find((childNode) => (
      childNode.nodeType !== Node.TEXT_NODE || childNode.textContent.trim() !== ''
    )) || null;

    if (firstRelevantNode && isEmptyEditorBreakNode(firstRelevantNode)) {
      return firstRelevantNode;
    }

    const paragraph = document.createElement('p');
    paragraph.innerHTML = '<br>';
    editorNode.insertBefore(paragraph, firstRelevantNode || editorNode.firstChild || null);
    return paragraph;
  }, [isEmptyEditorBreakNode]);

  const ensureEditorTrailingParagraph = useCallback((editorNode) => {
    if (!editorNode) {
      return null;
    }

    const childNodes = [...editorNode.childNodes];
    for (let index = childNodes.length - 1; index >= 0; index -= 1) {
      const currentNode = childNodes[index];
      if (currentNode.nodeType === Node.TEXT_NODE && !currentNode.textContent.trim()) {
        continue;
      }

      if (isEmptyEditorBreakNode(currentNode)) {
        return currentNode;
      }
      break;
    }

    const paragraph = document.createElement('p');
    paragraph.innerHTML = '<br>';
    editorNode.appendChild(paragraph);
    return paragraph;
  }, [isEmptyEditorBreakNode]);
  const getSelectionEditorContext = useCallback((preferredPageIndex = activePageIndex) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return null;
    }

    const selectionPageIndex = getEditorPageIndexFromNode(selection.anchorNode);
    const resolvedPageIndex = selectionPageIndex ?? preferredPageIndex;
    const editorNode = getEditorNode(resolvedPageIndex);
    if (!editorNode || !editorNode.contains(selection.anchorNode)) {
      return null;
    }

    const blockNode = getClosestEditableBlock(selection.anchorNode, editorNode);
    if (!blockNode) {
      return null;
    }

    return {
      selection,
      editorNode,
      blockNode,
      pageIndex: resolvedPageIndex,
    };
  }, [activePageIndex, getEditorNode]);

  const isCaretNearPageBottom = useCallback((pageIndex, threshold = 28) => {
    const editorNode = editorRefs.current[pageIndex];
    if (!editorNode) {
      return false;
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !editorNode.contains(selection.anchorNode)) {
      return false;
    }

    const range = selection.getRangeAt(0).cloneRange();
    range.collapse(true);

    let caretRect = range.getClientRects()[0] || range.getBoundingClientRect();
    if ((!caretRect || (caretRect.width === 0 && caretRect.height === 0)) && selection.anchorNode) {
      const blockNode = getClosestEditableBlock(selection.anchorNode, editorNode);
      caretRect = blockNode?.getBoundingClientRect?.() || null;
    }

    if (!caretRect) {
      return false;
    }

    const editorRect = editorNode.getBoundingClientRect();
    return caretRect.bottom >= editorRect.bottom - threshold;
  }, []);

  const isCaretAtPageStart = useCallback((pageIndex) => {
    const context = getSelectionEditorContext(pageIndex);
    if (!context || !context.selection.isCollapsed) {
      return false;
    }

    const { editorNode, selection } = context;
    const range = selection.getRangeAt(0).cloneRange();
    const leadingRange = document.createRange();
    leadingRange.selectNodeContents(editorNode);
    leadingRange.setEnd(range.startContainer, range.startOffset);
    const leadingText = leadingRange.toString().replace(/\u200B/g, '').replace(/\n/g, '').trim();
    return leadingText === '';
  }, [getSelectionEditorContext]);

  const normalizeEditorContent = useCallback((editorNode) => {
    if (!editorNode) {
      return;
    }

    [...editorNode.childNodes].forEach((childNode) => {
      if (childNode.nodeType === Node.TEXT_NODE && childNode.textContent.trim()) {
        const paragraph = document.createElement('p');
        paragraph.textContent = childNode.textContent;
        editorNode.replaceChild(paragraph, childNode);
      }
    });

    if (![...editorNode.childNodes].some((childNode) => isMeaningfulEditorNode(childNode))) {
      editorNode.innerHTML = '<p><br></p>';
    }
  }, [isMeaningfulEditorNode]);

  const getMovableEditorNodes = useCallback((editorNode) => (
    [...editorNode.childNodes].filter((childNode) => isMeaningfulEditorNode(childNode))
  ), [isMeaningfulEditorNode]);

  const getDirectListItems = useCallback((listNode) => (
    listNode instanceof HTMLElement
      ? [...listNode.children].filter((childNode) => childNode.tagName === 'LI')
      : []
  ), []);

  const areListsCompatibleForPagination = useCallback((leftList, rightList) => {
    if (!(leftList instanceof HTMLElement) || !(rightList instanceof HTMLElement)) {
      return false;
    }

    return leftList.tagName === rightList.tagName
      && leftList.className === rightList.className
      && leftList.style.listStyleType === rightList.style.listStyleType
      && (leftList.getAttribute('type') || '') === (rightList.getAttribute('type') || '');
  }, []);

  const syncPaginatedOrderedListStarts = useCallback((pages = materialForm.topics[activeTopicIndex]?.pages || []) => {
    let previousOrderedList = null;

    for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
      const editorNode = editorRefs.current[pageIndex];
      if (!editorNode) {
        previousOrderedList = null;
        continue;
      }

      const movableNodes = getMovableEditorNodes(editorNode);
      const firstNode = movableNodes[0];
      const lastNode = movableNodes[movableNodes.length - 1];

      if (firstNode instanceof HTMLOListElement) {
        if (previousOrderedList && areListsCompatibleForPagination(previousOrderedList.node, firstNode)) {
          const nextStart = previousOrderedList.start + previousOrderedList.itemCount;
          if (nextStart > 1) {
            firstNode.setAttribute('start', String(nextStart));
          } else {
            firstNode.removeAttribute('start');
          }
        } else {
          firstNode.removeAttribute('start');
        }
      }

      if (lastNode instanceof HTMLOListElement) {
        previousOrderedList = {
          node: lastNode,
          start: Math.max(1, Number(lastNode.getAttribute('start') || 1)),
          itemCount: Math.max(1, getDirectListItems(lastNode).length),
        };
      } else {
        previousOrderedList = null;
      }
    }
  }, [activeTopicIndex, areListsCompatibleForPagination, getDirectListItems, getMovableEditorNodes, materialForm.topics]);

  const splitOverflowingListBlock = useCallback((editorNode, nextEditorNode, listNode) => {
    if (!(listNode instanceof HTMLElement) || !listNode.matches('ol, ul') || !editorNode || !nextEditorNode) {
      return false;
    }

    const listItems = getDirectListItems(listNode);
    if (listItems.length <= 1) {
      return false;
    }

    const leadingNextNode = getMovableEditorNodes(nextEditorNode)[0] || null;
    let targetList = leadingNextNode instanceof HTMLElement && areListsCompatibleForPagination(listNode, leadingNextNode)
      ? leadingNextNode
      : null;

    if (!targetList) {
      if (getMovableEditorNodes(nextEditorNode).length === 1 && nextEditorNode.textContent.trim() === '') {
        nextEditorNode.innerHTML = '';
      }
      targetList = listNode.cloneNode(false);
      nextEditorNode.insertBefore(targetList, nextEditorNode.firstChild);
    }

    const movedItem = listItems[listItems.length - 1];
    targetList.insertBefore(movedItem, targetList.firstChild);

    if (getDirectListItems(listNode).length === 0) {
      listNode.remove();
    }

    normalizeEditorContent(editorNode);
    normalizeEditorContent(nextEditorNode);
    return true;
  }, [areListsCompatibleForPagination, getDirectListItems, getMovableEditorNodes, normalizeEditorContent]);

  const moveLeadingListItemBackward = useCallback((editorNode, nextEditorNode, listNode) => {
    if (!(listNode instanceof HTMLElement) || !listNode.matches('ol, ul') || !editorNode || !nextEditorNode) {
      return null;
    }

    const listItems = getDirectListItems(listNode);
    if (listItems.length === 0) {
      return null;
    }

    const currentMovableNodes = getMovableEditorNodes(editorNode);
    const trailingNode = currentMovableNodes[currentMovableNodes.length - 1] || null;
    let targetList = trailingNode instanceof HTMLElement && areListsCompatibleForPagination(trailingNode, listNode)
      ? trailingNode
      : null;
    let createdTargetList = false;

    if (!targetList) {
      targetList = listNode.cloneNode(false);
      editorNode.appendChild(targetList);
      createdTargetList = true;
    }

    const movedItem = listItems[0];
    const originalParent = listNode.parentNode;
    const originalNextSibling = listNode.nextSibling;
    const originalTargetNextSibling = targetList.nextSibling;

    targetList.appendChild(movedItem);

    if (getDirectListItems(listNode).length === 0) {
      listNode.remove();
    }

    normalizeEditorContent(editorNode);
    normalizeEditorContent(nextEditorNode);

    return () => {
      if (createdTargetList && !editorNode.contains(targetList)) {
        editorNode.insertBefore(targetList, originalTargetNextSibling);
      }

      if (!listNode.isConnected && originalParent) {
        originalParent.insertBefore(listNode, originalNextSibling);
      }

      listNode.insertBefore(movedItem, listNode.firstChild);

      if (createdTargetList && getDirectListItems(targetList).length === 0) {
        targetList.remove();
      }

      normalizeEditorContent(editorNode);
      normalizeEditorContent(nextEditorNode);
    };
  }, [areListsCompatibleForPagination, getDirectListItems, getMovableEditorNodes, normalizeEditorContent]);

  const splitOverflowingTextBlock = useCallback((editorNode, nextEditorNode, blockNode) => {
    if (!(blockNode instanceof HTMLElement) || !editorNode || !nextEditorNode) {
      return false;
    }

    if (!blockNode.matches('p, div, blockquote, h1, h2, h3, h4, h5, h6')) {
      return false;
    }

    if (blockNode.querySelector('img, table, figure, hr, ul, ol')) {
      return false;
    }

    const words = String(blockNode.textContent || '')
      .replace(/\u200B/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .filter(Boolean);

    if (words.length < 8) {
      return false;
    }

    const originalBlockHtml = blockNode.innerHTML;
    const originalNextHtml = nextEditorNode.innerHTML;
    let bestSplit = null;
    let low = 1;
    let high = words.length - 1;

    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      const keptText = words.slice(0, middle).join(' ');
      const overflowText = words.slice(middle).join(' ');

      blockNode.textContent = keptText;
      nextEditorNode.innerHTML = originalNextHtml;
      if (getMovableEditorNodes(nextEditorNode).length === 1 && nextEditorNode.textContent.trim() === '') {
        nextEditorNode.innerHTML = '';
      }

      const overflowClone = blockNode.cloneNode(false);
      overflowClone.textContent = overflowText;
      nextEditorNode.insertBefore(overflowClone, nextEditorNode.firstChild);
      normalizeEditorContent(nextEditorNode);

      if (editorNode.scrollHeight <= editorNode.clientHeight + 2) {
        bestSplit = { keptText, overflowText };
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }

    blockNode.innerHTML = originalBlockHtml;
    nextEditorNode.innerHTML = originalNextHtml;

    if (!bestSplit || !bestSplit.overflowText) {
      return false;
    }

    blockNode.textContent = bestSplit.keptText;
    if (getMovableEditorNodes(nextEditorNode).length === 1 && nextEditorNode.textContent.trim() === '') {
      nextEditorNode.innerHTML = '';
    }

    const overflowClone = blockNode.cloneNode(false);
    overflowClone.textContent = bestSplit.overflowText;
    nextEditorNode.insertBefore(overflowClone, nextEditorNode.firstChild);
    normalizeEditorContent(editorNode);
    normalizeEditorContent(nextEditorNode);
    return true;
  }, [getMovableEditorNodes, normalizeEditorContent]);

  const serializeActiveTopicPagesFromDom = useCallback((topicIndex = activeTopicIndex) => {
    const activeTopicData = materialForm.topics[topicIndex];
    if (!activeTopicData) {
      return [];
    }

    const serializedPages = activeTopicData.pages.map((page, pageIndex) => {
      const editorNode = editorRefs.current[pageIndex];
      const rawHtml = editorNode?.innerHTML || page.content_html || '';
      const contentHtml = sanitizeEditorHtml(rawHtml);
      return {
        title: page.title || `Halaman ${pageIndex + 1}`,
        points: extractPointsFromHtml(contentHtml),
        closing: '',
        content_html: contentHtml,
      };
    });

    while (serializedPages.length > 1) {
      const lastPage = serializedPages[serializedPages.length - 1];
      const parser = new DOMParser();
      const doc = parser.parseFromString(lastPage.content_html || '', 'text/html');
      const hasContent = [...doc.body.childNodes].some((childNode) => isMeaningfulEditorNode(childNode));
      if (hasContent) {
        break;
      }
      serializedPages.pop();
    }

    return serializedPages;
  }, [activeTopicIndex, isMeaningfulEditorNode, materialForm.topics]);

  const clearSelectedImageFigure = useCallback(() => {
    if (selectedImageFigureRef.current) {
      selectedImageFigureRef.current.classList.remove('is-selected');
      selectedImageFigureRef.current = null;
    }
  }, []);

  const resolveImageWrapLayout = useCallback((figure) => {
    const matchedOption = IMAGE_WRAP_OPTIONS.find(([value]) => figure?.classList?.contains(`material-image-wrap-${value}`));
    return matchedOption?.[0] || 'center';
  }, []);

  const ensureImageFigure = useCallback((imageNode) => {
    if (!imageNode) {
      return null;
    }

    const existingFigure = imageNode.closest('.material-image-frame');
    if (existingFigure) {
      return existingFigure;
    }

    const figure = document.createElement('figure');
    figure.className = 'material-image-frame material-image-wrap-center';
    figure.style.setProperty('--image-width', '320px');
    figure.style.setProperty('--image-margin-top', '16px');
    figure.style.setProperty('--image-margin-bottom', '16px');
    imageNode.parentNode?.insertBefore(figure, imageNode);
    figure.appendChild(imageNode);
    return figure;
  }, []);

  const selectImageFigure = useCallback((figure) => {
    clearSelectedImageFigure();
    if (figure) {
      figure.classList.add('is-selected');
      selectedImageFigureRef.current = figure;
    }
  }, [clearSelectedImageFigure]);

  const clampNumber = useCallback((value, min, max) => Math.min(max, Math.max(min, value)), []);

  const getImageWidthBounds = useCallback((layout) => {
    const selectedFigureEditor = selectedImageFigureRef.current?.closest('.admin-word-editable');
    const pageWidth = selectedFigureEditor?.clientWidth || getEditorNode()?.clientWidth || 720;
    const defaultMax = Math.max(220, Math.min(pageWidth - 24, 560));
    if (layout === 'full') {
      return { min: Math.max(220, pageWidth * 0.45), max: Math.max(260, pageWidth - 24) };
    }
    if (layout === 'left' || layout === 'right' || layout === 'inline') {
      return { min: 140, max: Math.max(220, Math.min(pageWidth * 0.48, 360)) };
    }
    return { min: 180, max: defaultMax };
  }, [getEditorNode]);

  const getImageFigureMetrics = useCallback((figure) => {
    const computed = window.getComputedStyle(figure);
    return {
      layout: resolveImageWrapLayout(figure),
      width: parseFloat(figure.style.getPropertyValue('--image-width')) || parseFloat(computed.width) || 320,
      marginTop: parseFloat(figure.style.getPropertyValue('--image-margin-top')) || parseFloat(computed.marginTop) || 16,
      marginBottom: parseFloat(figure.style.getPropertyValue('--image-margin-bottom')) || parseFloat(computed.marginBottom) || 16,
    };
  }, [resolveImageWrapLayout]);

  const applyImageFigureMetrics = useCallback((figure, metrics) => {
    if (!figure) {
      return;
    }

    figure.style.setProperty('--image-width', `${Math.round(metrics.width)}px`);
    figure.style.setProperty('--image-margin-top', `${Math.round(metrics.marginTop)}px`);
    figure.style.setProperty('--image-margin-bottom', `${Math.round(metrics.marginBottom)}px`);
  }, []);

  const normalizeImageFigureSize = useCallback((figure, preferredWidth = null) => {
    if (!figure) {
      return;
    }

    const layout = resolveImageWrapLayout(figure);
    const bounds = getImageWidthBounds(layout);
    const currentMetrics = getImageFigureMetrics(figure);
    const width = clampNumber(preferredWidth ?? currentMetrics.width, bounds.min, bounds.max);
    applyImageFigureMetrics(figure, {
      ...currentMetrics,
      width,
    });
  }, [applyImageFigureMetrics, clampNumber, getImageFigureMetrics, getImageWidthBounds, resolveImageWrapLayout]);

  const setImageFigureLayout = useCallback((figure, layout) => {
    if (!figure) {
      return;
    }

    IMAGE_WRAP_OPTIONS.forEach(([value]) => {
      figure.classList.remove(`material-image-wrap-${value}`);
    });
    figure.classList.add(`material-image-wrap-${layout}`);
    normalizeImageFigureSize(figure);
  }, [normalizeImageFigureSize]);

  const getParagraphIndentMetrics = useCallback((blockNode) => ({
    leftIndent: Math.max(0, parseIndentValue(blockNode?.style?.marginLeft)),
    firstLineIndent: parseIndentValue(blockNode?.style?.textIndent),
  }), []);

  const updateActiveParagraphMetrics = useCallback((pageIndex = activePageIndex) => {
    const context = getSelectionEditorContext(pageIndex);
    if (!context) {
      return;
    }

    const metrics = getParagraphIndentMetrics(context.blockNode);
    setActiveParagraphMetrics({
      pageIndex: context.pageIndex,
      leftIndent: metrics.leftIndent,
      firstLineIndent: metrics.firstLineIndent,
    });
  }, [activePageIndex, getParagraphIndentMetrics, getSelectionEditorContext]);

  const readEditorFormatState = useCallback((pageIndex = activePageIndex) => {
    const context = getSelectionEditorContext(pageIndex);
    const editorNode = context?.editorNode || getEditorNode(pageIndex);
    if (!editorNode) {
      return DEFAULT_EDITOR_FORMAT_STATE;
    }

    const blockNode = context?.blockNode
      || editorNode.querySelector('p, div, li, blockquote, h1, h2, h3, h4, h5, h6, td, th');
    if (!(blockNode instanceof HTMLElement)) {
      return DEFAULT_EDITOR_FORMAT_STATE;
    }

    const computedStyles = window.getComputedStyle(blockNode);
    const listNode = blockNode.closest('ul, ol');
    const fontWeight = Number.parseInt(computedStyles.fontWeight || '400', 10);
    const textDecoration = String(computedStyles.textDecorationLine || computedStyles.textDecoration || '').toLowerCase();

    return {
      blockType: normalizeEditorBlockType(blockNode.tagName),
      fontSize: resolveEditorFontSize(computedStyles.fontSize),
      textColor: rgbToHex(computedStyles.color),
      bold: Number.isFinite(fontWeight) ? fontWeight >= 600 : /(bold|[6-9]00)/i.test(computedStyles.fontWeight),
      italic: String(computedStyles.fontStyle || '').toLowerCase().includes('italic'),
      underline: textDecoration.includes('underline'),
      strikeThrough: textDecoration.includes('line-through'),
      align: normalizeEditorAlignment(computedStyles.textAlign),
      isBulletList: listNode?.tagName?.toLowerCase() === 'ul',
      isOrderedList: listNode?.tagName?.toLowerCase() === 'ol',
    };
  }, [activePageIndex, getEditorNode, getSelectionEditorContext]);

  const syncEditorFormatState = useCallback((pageIndex = activePageIndex) => {
    setEditorFormatState(readEditorFormatState(pageIndex));
  }, [activePageIndex, readEditorFormatState]);

  const applyParagraphMetrics = useCallback((pageIndex, { leftIndent, firstLineIndent }) => {
    const context = getSelectionEditorContext(pageIndex);
    if (!context) {
      return false;
    }

    const { editorNode, blockNode, pageIndex: resolvedPageIndex } = context;
    if (!blockNode || blockNode.tagName === 'LI') {
      return false;
    }

    const safeLeftIndent = Math.max(0, Math.min(PARAGRAPH_INDENT_LIMIT, Math.round(leftIndent)));
    const safeFirstLineIndent = Math.max(-FIRST_LINE_INDENT_LIMIT, Math.min(FIRST_LINE_INDENT_LIMIT, Math.round(firstLineIndent)));

    blockNode.style.marginLeft = safeLeftIndent > 0 ? `${safeLeftIndent}px` : '';
    blockNode.style.textIndent = safeFirstLineIndent !== 0 ? `${safeFirstLineIndent}px` : '';

    persistActivePageContent(editorNode.innerHTML, resolvedPageIndex, 'format');
    setActiveParagraphMetrics({
      pageIndex: resolvedPageIndex,
      leftIndent: safeLeftIndent,
      firstLineIndent: safeFirstLineIndent,
    });
    schedulePaginationRebalance(resolvedPageIndex);
    return true;
  }, [getSelectionEditorContext, persistActivePageContent, schedulePaginationRebalance]);

  const readTopicsFromEditor = useCallback(() => materialForm.topics.map((topic, topicIndex) => ({
    ...topic,
    pages: topic.pages.map((page, pageIndex) => {
      const editorNode = topicIndex === activeTopicIndex ? editorRefs.current[pageIndex] : null;
      const rawHtml = editorNode?.innerHTML || page.content_html || '';
      const contentHtml = sanitizeEditorHtml(rawHtml);
      return {
        title: page.title || `Halaman ${pageIndex + 1}`,
        points: extractPointsFromHtml(contentHtml),
        closing: '',
        content_html: contentHtml,
      };
    }),
  })), [activeTopicIndex, materialForm.topics]);

  function persistActivePageContent(rawHtml = null, pageIndex = activePageIndex, historySource = 'generic') {
    const contentHtml = sanitizeEditorHtml(rawHtml ?? (getEditorNode(pageIndex)?.innerHTML || ''));
    markHistorySource(historySource);
    setMaterialForm((current) => ({
      ...current,
      topics: current.topics.map((topic, currentTopicIndex) => (
        currentTopicIndex === activeTopicIndex
          ? {
              ...topic,
              pages: topic.pages.map((page, currentPageIndex) => (
                currentPageIndex === pageIndex
                  ? {
                      ...page,
                      content_html: contentHtml,
                      points: extractPointsFromHtml(contentHtml),
                    }
                  : page
              )),
            }
          : topic
      )),
    }));
  }

  const updateTopicTitle = (topicIndex, title) => {
    markHistorySource('metadata');
    setMaterialForm((current) => ({
      ...current,
      topics: current.topics.map((topic, index) => (
        index === topicIndex ? { ...topic, title } : topic
      )),
    }));
  };

  const updatePageContent = (topicIndex, pageIndex) => {
    if (topicIndex !== activeTopicIndex || pageIndex !== activePageIndex) {
      return;
    }
    persistActivePageContent(null, pageIndex, 'typing');
  };

  const selectPage = (pageIndex) => {
    markHistorySource('navigation');
    setMaterialForm((current) => ({
      ...current,
      topics: readTopicsFromEditor(),
    }));
    activatePage(pageIndex);
    focusEditorAtEnd(pageIndex);
  };

  const addMaterialPage = () => {
    const nextPageIndex = activeTopic?.pages?.length || 0;
    markHistorySource('structure');
    const nextTopics = readTopicsFromEditor().map((topic, topicIndex) => (
      topicIndex === activeTopicIndex
        ? {
            ...topic,
            pages: renumberMaterialPages([
              ...topic.pages,
              createEmptyMaterialPage(topic.pages.length + 1),
            ]),
          }
        : topic
    ));

    pendingEnterPageFocusRef.current = nextPageIndex;
    setMaterialForm((current) => ({
      ...current,
      topics: nextTopics,
    }));
    activatePage(nextPageIndex);
  };

  const removeMaterialPage = useCallback((pageIndex) => {
    if (!activeTopic || (activeTopic.pages?.length || 0) <= 1) {
      return false;
    }

    const nextTopics = readTopicsFromEditor().map((topic, topicIndex) => (
      topicIndex === activeTopicIndex
        ? {
            ...topic,
            pages: renumberMaterialPages(topic.pages.filter((_, index) => index !== pageIndex)),
          }
        : topic
    ));
    const nextIndex = Math.max(
      0,
      Math.min(pageIndex === activePageIndex ? activePageIndex - 1 : activePageIndex, (nextTopics[activeTopicIndex]?.pages?.length || 1) - 1)
    );

    markHistorySource('structure');
    editorRefs.current = {};
    pendingEnterPageFocusRef.current = nextIndex;
    setMaterialForm((current) => ({
      ...current,
      topics: nextTopics,
    }));
    setActivePageIndex(nextIndex);
    syncSelectionInUrl(activeTopicIndex, nextIndex);
    setEditorRenderNonce((current) => current + 1);
    return true;
  }, [activePageIndex, activeTopic, activeTopicIndex, markHistorySource, readTopicsFromEditor, syncSelectionInUrl]);

  const isEditorPageEmpty = useCallback((pageIndex) => {
    const editorNode = editorRefs.current[pageIndex];
    if (!editorNode) {
      return false;
    }

    return getMovableEditorNodes(editorNode).length === 0;
  }, [getMovableEditorNodes]);

  const applyParagraphIndent = useCallback((pageIndex, direction = 1) => {
    const context = getSelectionEditorContext(pageIndex);
    if (!context) {
      return false;
    }

    const { editorNode, blockNode, pageIndex: resolvedPageIndex } = context;
    if (!blockNode) {
      return false;
    }

    if (blockNode.tagName === 'LI') {
      document.execCommand(direction > 0 ? 'indent' : 'outdent', false, null);
    } else {
      const currentMarginLeft = parseIndentValue(blockNode.style.marginLeft);
      const nextMarginLeft = Math.max(0, currentMarginLeft + (direction * PARAGRAPH_INDENT_STEP));
      blockNode.style.marginLeft = nextMarginLeft > 0 ? `${nextMarginLeft}px` : '';
    }

    persistActivePageContent(editorNode.innerHTML, resolvedPageIndex, 'format');
    updateActiveParagraphMetrics(resolvedPageIndex);
    schedulePaginationRebalance(resolvedPageIndex);
    return true;
  }, [getSelectionEditorContext, persistActivePageContent, schedulePaginationRebalance, updateActiveParagraphMetrics]);

  const applyKeyboardTabIndent = useCallback((pageIndex, direction = 1) => {
    const context = getSelectionEditorContext(pageIndex);
    if (!context) {
      return false;
    }

    const { editorNode, blockNode, pageIndex: resolvedPageIndex } = context;
    if (!blockNode) {
      return false;
    }

    if (blockNode.tagName === 'LI') {
      document.execCommand(direction > 0 ? 'indent' : 'outdent', false, null);
    } else {
      const currentMetrics = getParagraphIndentMetrics(blockNode);
      let nextLeftIndent = currentMetrics.leftIndent;
      let nextFirstLineIndent = currentMetrics.firstLineIndent;

      if (direction > 0) {
        nextFirstLineIndent = Math.min(FIRST_LINE_INDENT_LIMIT, currentMetrics.firstLineIndent + PARAGRAPH_INDENT_STEP);
      } else if (currentMetrics.firstLineIndent > 0) {
        nextFirstLineIndent = Math.max(0, currentMetrics.firstLineIndent - PARAGRAPH_INDENT_STEP);
      } else if (currentMetrics.firstLineIndent < 0) {
        nextFirstLineIndent = Math.min(0, currentMetrics.firstLineIndent + PARAGRAPH_INDENT_STEP);
      } else if (currentMetrics.leftIndent > 0) {
        nextLeftIndent = Math.max(0, currentMetrics.leftIndent - PARAGRAPH_INDENT_STEP);
      } else {
        return false;
      }

      blockNode.style.marginLeft = nextLeftIndent > 0 ? `${nextLeftIndent}px` : '';
      blockNode.style.textIndent = nextFirstLineIndent !== 0 ? `${nextFirstLineIndent}px` : '';
    }

    persistActivePageContent(editorNode.innerHTML, resolvedPageIndex, 'format');
    updateActiveParagraphMetrics(resolvedPageIndex);
    schedulePaginationRebalance(resolvedPageIndex);
    return true;
  }, [getParagraphIndentMetrics, getSelectionEditorContext, persistActivePageContent, schedulePaginationRebalance, updateActiveParagraphMetrics]);

  const outdentAtCaretStart = useCallback((pageIndex) => {
    const context = getSelectionEditorContext(pageIndex);
    if (!context || !context.selection.isCollapsed) {
      return false;
    }

    const { blockNode, pageIndex: resolvedPageIndex } = context;
    if (!blockNode) {
      return false;
    }

    const range = context.selection.getRangeAt(0).cloneRange();
    const leadingRange = document.createRange();
    leadingRange.selectNodeContents(blockNode);
    leadingRange.setEnd(range.startContainer, range.startOffset);
    const leadingText = leadingRange.toString().replace(/\u200B/g, '').replace(/\n/g, '').trim();
    if (leadingText !== '') {
      return false;
    }

    if (blockNode.tagName !== 'LI') {
      const metrics = getParagraphIndentMetrics(blockNode);
      if (metrics.firstLineIndent === 0 && metrics.leftIndent === 0) {
        return false;
      }
    }

    return applyKeyboardTabIndent(resolvedPageIndex, -1);
  }, [applyKeyboardTabIndent, getParagraphIndentMetrics, getSelectionEditorContext]);

  const isSelectionInsideListItem = useCallback((pageIndex = activePageIndex) => {
    const context = getSelectionEditorContext(pageIndex);
    return context?.blockNode?.tagName === 'LI';
  }, [activePageIndex, getSelectionEditorContext]);

  const adjustParagraphIndent = useCallback((direction = 1, pageIndex = activePageIndex) => {
    const restoredSelection = restoreSavedSelection(pageIndex);
    const resolvedPageIndex = restoredSelection?.pageIndex ?? pageIndex;
    activatePage(resolvedPageIndex);
    const applied = applyParagraphIndent(resolvedPageIndex, direction);
    if (!applied) {
      runCommand(direction > 0 ? 'indent' : 'outdent');
    }
  }, [activatePage, activePageIndex, applyParagraphIndent, restoreSavedSelection, runCommand]);

  const pageNeedsPaginationRebalance = useCallback((pageIndex) => {
    const editorNode = editorRefs.current[pageIndex];
    if (!editorNode) {
      return false;
    }

    const isOverflowing = editorNode.scrollHeight > editorNode.clientHeight + 2;
    if (isOverflowing) {
      return true;
    }

    const nextEditorNode = editorRefs.current[pageIndex + 1];
    if (!nextEditorNode) {
      return false;
    }

    const nextHasContent = getMovableEditorNodes(nextEditorNode).length > 0;
    const hasSpareRoom = editorNode.scrollHeight < editorNode.clientHeight - 40;
    return nextHasContent && hasSpareRoom;
  }, [getMovableEditorNodes]);

  const placeCaretFromEditorPoint = useCallback((editorNode, pageIndex, clientX, clientY) => {
    if (!editorNode) {
      return false;
    }

    focusEditorHost();

    if (typeof document.caretPositionFromPoint === 'function') {
      const caretPosition = document.caretPositionFromPoint(clientX, clientY);
      if (caretPosition?.offsetNode && editorNode.contains(caretPosition.offsetNode)) {
        const range = document.createRange();
        const maxOffset = caretPosition.offsetNode.nodeType === Node.TEXT_NODE
          ? (caretPosition.offsetNode.textContent?.length || 0)
          : (caretPosition.offsetNode.childNodes?.length || 0);
        range.setStart(caretPosition.offsetNode, Math.min(caretPosition.offset, maxOffset));
        range.collapse(true);
        return setSelectionRange(range);
      }
    }

    if (typeof document.caretRangeFromPoint === 'function') {
      const caretRange = document.caretRangeFromPoint(clientX, clientY);
      if (caretRange?.startContainer && editorNode.contains(caretRange.startContainer)) {
        caretRange.collapse(true);
        return setSelectionRange(caretRange);
      }
    }

    const movableNodes = getMovableEditorNodes(editorNode);
    const lastMovableNode = movableNodes[movableNodes.length - 1] || null;
    if (lastMovableNode) {
      const lastRect = lastMovableNode.getBoundingClientRect?.() || null;
      if (!lastRect || clientY >= lastRect.bottom - 6) {
        const trailingParagraph = ensureEditorTrailingParagraph(editorNode);
        persistActivePageContent(editorNode.innerHTML, pageIndex, 'typing');
        return placeCaretInsideNode(trailingParagraph, false);
      }
    }

    const firstMovableNode = movableNodes[0] || null;
    if (firstMovableNode) {
      return placeCaretInsideNode(firstMovableNode, true);
    }

    const trailingParagraph = ensureEditorTrailingParagraph(editorNode);
    persistActivePageContent(editorNode.innerHTML, pageIndex, 'typing');
    return placeCaretInsideNode(trailingParagraph, false);
  }, [
    ensureEditorTrailingParagraph,
    focusEditorHost,
    getMovableEditorNodes,
    persistActivePageContent,
    placeCaretInsideNode,
    setSelectionRange,
  ]);

  const openNextEditorPageFromBoundary = useCallback((pageIndex) => {
    const nextPageIndex = pageIndex + 1;
    const nextEditorNode = editorRefs.current[nextPageIndex];

    if (nextEditorNode) {
      const leadingParagraph = ensureEditorLeadingParagraph(nextEditorNode);
      normalizeEditorContent(nextEditorNode);
      persistActivePageContent(nextEditorNode.innerHTML, nextPageIndex, 'structure');
      activatePage(nextPageIndex);
      focusEditorHost();
      placeCaretInsideNode(leadingParagraph, true);
      requestAnimationFrame(() => updateActiveParagraphMetrics(nextPageIndex));
      return;
    }

    markHistorySource('structure');
    const nextTopics = readTopicsFromEditor().map((topic, topicIndex) => {
      if (topicIndex !== activeTopicIndex) {
        return topic;
      }

      return {
        ...topic,
        pages: renumberMaterialPages([
          ...topic.pages,
          createEmptyMaterialPage(topic.pages.length + 1),
        ]),
      };
    });

    pendingEnterPageFocusRef.current = nextPageIndex;
    setMaterialForm((current) => ({
      ...current,
      topics: nextTopics,
    }));
    setActivePageIndex(nextPageIndex);
    syncSelectionInUrl(activeTopicIndex, nextPageIndex);
  }, [
    activatePage,
    activeTopicIndex,
    ensureEditorLeadingParagraph,
    focusEditorHost,
    markHistorySource,
    normalizeEditorContent,
    persistActivePageContent,
    placeCaretInsideNode,
    readTopicsFromEditor,
    syncSelectionInUrl,
    updateActiveParagraphMetrics,
  ]);
  const deleteBackwardAcrossPageBoundary = useCallback((pageIndex) => {
    if (pageIndex <= 0) {
      return false;
    }

    const previousPageIndex = pageIndex - 1;
    const previousEditorNode = editorRefs.current[previousPageIndex];
    if (!previousEditorNode) {
      return false;
    }

    focusEditorHost();
    const selection = window.getSelection();
    if (!selection) {
      return false;
    }

    const range = document.createRange();
    range.selectNodeContents(previousEditorNode);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);

    if (typeof selection.modify === 'function') {
      selection.modify('extend', 'backward', 'character');
      document.execCommand('delete', false, null);
      rememberCurrentSelection(previousPageIndex);
      handlePageInput(previousPageIndex, 'deleteContentBackward', previousPageIndex);
      activatePage(previousPageIndex);
      return true;
    }

    return false;
  }, [activatePage, focusEditorHost, handlePageInput, rememberCurrentSelection]);

  const handleEditorKeyDown = useCallback((event, pageIndex) => {
    const selection = window.getSelection();
    pendingMutationContextRef.current = {
      inputType: event.key === 'Backspace'
        ? 'deleteContentBackward'
        : event.key === 'Delete'
          ? 'deleteContentForward'
          : event.key === 'Enter'
            ? 'insertParagraph'
            : 'insertText',
      ...getSelectionPageBounds(selection, pageIndex),
    };

    if ((event.key === 'Backspace' || event.key === 'Delete') && selection && !selection.isCollapsed) {
      const selectionBounds = getSelectionPageBounds(selection, pageIndex);
      if (selectionBounds.startPageIndex !== selectionBounds.endPageIndex) {
        event.preventDefault();
        deleteSelectionAcrossPages();
        return;
      }
    }

    if (event.key === 'Tab') {
      event.preventDefault();
      applyKeyboardTabIndent(pageIndex, event.shiftKey ? -1 : 1);
      return;
    }

    if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
      if (isSelectionInsideListItem(pageIndex)) {
        requestAnimationFrame(() => {
          rememberCurrentSelection(pageIndex);
          handlePageInput(pageIndex);
        });
        return;
      }

      if (isCaretNearPageBottom(pageIndex, 36)) {
        event.preventDefault();
        openNextEditorPageFromBoundary(pageIndex);
        return;
      }
    }

    if (event.key === 'Backspace' && outdentAtCaretStart(pageIndex)) {
      event.preventDefault();
      return;
    }

    if (event.key === 'Backspace' && pageIndex > 0 && isCaretAtPageStart(pageIndex)) {
      event.preventDefault();
      deleteBackwardAcrossPageBoundary(pageIndex);
      return;
    }

    if (event.key !== 'Backspace' && event.key !== 'Delete') {
      return;
    }

    const currentTopic = materialForm.topics[activeTopicIndex];
    const totalPages = currentTopic?.pages?.length || 0;
    if (totalPages <= 1) {
      return;
    }

    if (!isEditorPageEmpty(pageIndex)) {
      return;
    }

    event.preventDefault();

    removeMaterialPage(pageIndex);
  }, [
    activeTopicIndex,
    applyKeyboardTabIndent,
    deleteBackwardAcrossPageBoundary,
    deleteSelectionAcrossPages,
    handlePageInput,
    isSelectionInsideListItem,
    isCaretAtPageStart,
    isCaretNearPageBottom,
    isEditorPageEmpty,
    materialForm.topics,
    openNextEditorPageFromBoundary,
    outdentAtCaretStart,
    removeMaterialPage,
  ]);

  const rebalancePaginatedEditors = useCallback((startIndex = 0) => {
    const currentTopic = materialForm.topics[activeTopicIndex];
    if (!currentTopic || currentTopic.pages.length === 0) {
      return;
    }

    let createdNewPage = false;
    let didReflow = false;

    for (let pageIndex = Math.max(0, startIndex); pageIndex < currentTopic.pages.length; pageIndex += 1) {
      const editorNode = editorRefs.current[pageIndex];
      if (!editorNode) {
        continue;
      }

      normalizeEditorContent(editorNode);
      const nextEditorNode = editorRefs.current[pageIndex + 1];

      while (editorNode.scrollHeight > editorNode.clientHeight + 2) {
        const movableNodes = getMovableEditorNodes(editorNode);
        if (movableNodes.length <= 1) {
          break;
        }

        if (!nextEditorNode) {
          createdNewPage = true;
          setMaterialForm((current) => ({
            ...current,
            topics: current.topics.map((topic, index) => (
              index === activeTopicIndex
                ? { ...topic, pages: [...topic.pages, createEmptyMaterialPage(topic.pages.length + 1)] }
                : topic
            )),
          }));
          setPendingPaginationStart(pageIndex);
          return;
        }

        const movedNode = movableNodes[movableNodes.length - 1];
        normalizeEditorContent(nextEditorNode);
        const didSplitList = splitOverflowingListBlock(editorNode, nextEditorNode, movedNode);
        const didSplitBlock = !didSplitList && splitOverflowingTextBlock(editorNode, nextEditorNode, movedNode);
        if (!didSplitList && !didSplitBlock) {
          if (getMovableEditorNodes(nextEditorNode).length === 1 && nextEditorNode.textContent.trim() === '') {
            nextEditorNode.innerHTML = '';
          }
          nextEditorNode.insertBefore(movedNode, nextEditorNode.firstChild);
        }
        normalizeEditorContent(editorNode);
        normalizeEditorContent(nextEditorNode);
        didReflow = true;
      }
    }

    for (let pageIndex = Math.max(0, startIndex); pageIndex < currentTopic.pages.length - 1; pageIndex += 1) {
      const editorNode = editorRefs.current[pageIndex];
      const nextEditorNode = editorRefs.current[pageIndex + 1];
      if (!editorNode || !nextEditorNode) {
        continue;
      }

      normalizeEditorContent(editorNode);
      normalizeEditorContent(nextEditorNode);

      while (editorNode.scrollHeight < editorNode.clientHeight - 40) {
        const nextMovableNodes = getMovableEditorNodes(nextEditorNode);
        if (nextMovableNodes.length === 0) {
          break;
        }

        const movedNode = nextMovableNodes[0];
        const rollbackListMove = moveLeadingListItemBackward(editorNode, nextEditorNode, movedNode);
        if (!rollbackListMove) {
          editorNode.appendChild(movedNode);
        }
        normalizeEditorContent(editorNode);
        didReflow = true;

        if (editorNode.scrollHeight > editorNode.clientHeight + 2) {
          if (rollbackListMove) {
            rollbackListMove();
          } else {
            nextEditorNode.insertBefore(movedNode, nextEditorNode.firstChild);
            normalizeEditorContent(nextEditorNode);
          }
          break;
        }

        normalizeEditorContent(nextEditorNode);
      }
    }

    if (didReflow) {
      syncPaginatedOrderedListStarts(currentTopic.pages);
    }

    const nextSerializedPages = serializeActiveTopicPagesFromDom(activeTopicIndex);
    const pageCountChanged = nextSerializedPages.length !== currentTopic.pages.length;
    if (didReflow || pageCountChanged) {
      setMaterialForm((current) => ({
        ...current,
        topics: current.topics.map((topic, index) => (
          index === activeTopicIndex
            ? { ...topic, pages: nextSerializedPages }
            : topic
        )),
      }));
    }

  }, [
    activeTopicIndex,
    getMovableEditorNodes,
    materialForm.topics,
    moveLeadingListItemBackward,
    normalizeEditorContent,
    serializeActiveTopicPagesFromDom,
    splitOverflowingListBlock,
    splitOverflowingTextBlock,
    syncPaginatedOrderedListStarts,
  ]);

  function schedulePaginationRebalance(startIndex = 0) {
    if (paginationFrameRef.current) {
      cancelAnimationFrame(paginationFrameRef.current);
    }

    paginationFrameRef.current = requestAnimationFrame(() => {
      rebalancePaginatedEditors(startIndex);
      paginationFrameRef.current = null;
    });
  }

  function handlePageInput(pageIndex, inputType = '', preferredStartIndex = pageIndex) {
    persistActivePageContent(getEditorNode(pageIndex)?.innerHTML || '', pageIndex, 'typing');
    activatePage(pageIndex);
    syncEditorFormatState(pageIndex);

    const totalPages = materialForm.topics[activeTopicIndex]?.pages?.length || 0;
    if (totalPages > 1 && isEditorPageEmpty(pageIndex) && String(inputType).startsWith('delete')) {
      removeMaterialPage(pageIndex);
      return;
    }

    const rebalanceStartIndex = Math.max(0, Math.min(pageIndex, preferredStartIndex));
    if (pageNeedsPaginationRebalance(rebalanceStartIndex) || pageNeedsPaginationRebalance(pageIndex)) {
      schedulePaginationRebalance(rebalanceStartIndex);
    }
  }

  function runCommand(command, value = null) {
    const restoredSelection = restoreSavedSelection(activePageIndex);
    const resolvedPageIndex = restoredSelection?.pageIndex ?? activePageIndex;
    const editorNode = restoredSelection?.editorNode || getEditorNode(resolvedPageIndex);
    if (editorNode) {
      focusEditorHost();
    }
    markHistorySource(command === 'undo' || command === 'redo' ? 'history' : 'format');
    document.execCommand(command, false, value);
    if (editorNode) {
      persistActivePageContent(editorNode.innerHTML, resolvedPageIndex, 'format');
    }
    updateActiveParagraphMetrics(resolvedPageIndex);
    syncEditorFormatState(resolvedPageIndex);
    schedulePaginationRebalance(resolvedPageIndex);
  }

  const applyFontSize = (size) => {
    runCommand('fontSize', FONT_SIZE_COMMANDS[size] || '3');
  };

  const insertImage = () => {
    imageUploadInputRef.current?.click();
  };

  const getCurrentListNode = useCallback((pageIndex = activePageIndex) => {
    const context = getSelectionEditorContext(pageIndex);
    if (!context) {
      return null;
    }

    const listNode = context.blockNode.closest?.('ul, ol');
    return listNode instanceof HTMLElement ? listNode : null;
  }, [activePageIndex, getSelectionEditorContext]);

  const replaceListTag = useCallback((listNode, nextTagName) => {
    if (!listNode || listNode.tagName.toLowerCase() === nextTagName) {
      return listNode;
    }

    const replacement = document.createElement(nextTagName);
    replacement.innerHTML = listNode.innerHTML;
    replacement.style.cssText = listNode.style.cssText;
    [...listNode.attributes].forEach((attribute) => {
      if (attribute.name !== 'style') {
        replacement.setAttribute(attribute.name, attribute.value);
      }
    });
    listNode.parentNode?.replaceChild(replacement, listNode);
    return replacement;
  }, []);

  const clearListPresetClasses = useCallback((listNode) => {
    if (!listNode) {
      return;
    }

    MATERIAL_LIST_PRESET_CLASSES.forEach((className) => {
      listNode.classList.remove(className);
    });
  }, []);

  const applyListStyle = useCallback((kind, styleValue) => {
    const desiredTagName = kind === 'unordered' ? 'ul' : 'ol';
    const restoredSelection = restoreSavedSelection(activePageIndex);
    const pageIndex = restoredSelection?.pageIndex ?? activePageIndex;
    const editorNode = restoredSelection?.editorNode || getEditorNode(pageIndex);
    if (!editorNode) {
      return;
    }

    focusEditorHost();
    let listNode = getCurrentListNode(pageIndex);
    if (!listNode) {
      document.execCommand(kind === 'unordered' ? 'insertUnorderedList' : 'insertOrderedList', false, null);
      listNode = getCurrentListNode(pageIndex);
    }

    if (!listNode) {
      return;
    }

    const normalizedListNode = replaceListTag(listNode, desiredTagName);
    clearListPresetClasses(normalizedListNode);
    normalizedListNode.style.listStyleType = styleValue;
    if (desiredTagName === 'ol') {
      const orderedTypeMap = {
        decimal: '1',
        'lower-alpha': 'a',
        'upper-alpha': 'A',
        'upper-roman': 'I',
      };
      normalizedListNode.type = orderedTypeMap[styleValue] || '1';
    } else {
      normalizedListNode.removeAttribute('type');
    }

    persistActivePageContent(editorNode.innerHTML, pageIndex, 'format');
    updateActiveParagraphMetrics(pageIndex);
    schedulePaginationRebalance(pageIndex);
  }, [activePageIndex, clearListPresetClasses, focusEditorHost, getCurrentListNode, getEditorNode, persistActivePageContent, replaceListTag, restoreSavedSelection, schedulePaginationRebalance, updateActiveParagraphMetrics]);

  const applyMultilevelListStyle = useCallback((presetValue) => {
    const presetClassMap = {
      'decimal-alpha-roman': 'material-list-preset-decimal-alpha-roman',
      'decimal-decimal-decimal': 'material-list-preset-decimal-decimal-decimal',
      'disc-circle-square': 'material-list-preset-disc-circle-square',
    };
    const presetClassName = presetClassMap[presetValue];
    if (!presetClassName) {
      return;
    }

    const kind = presetValue === 'disc-circle-square' ? 'unordered' : 'ordered';
    const desiredTagName = kind === 'unordered' ? 'ul' : 'ol';
    const restoredSelection = restoreSavedSelection(activePageIndex);
    const pageIndex = restoredSelection?.pageIndex ?? activePageIndex;
    const editorNode = restoredSelection?.editorNode || getEditorNode(pageIndex);
    if (!editorNode) {
      return;
    }

    focusEditorHost();
    let listNode = getCurrentListNode(pageIndex);
    if (!listNode) {
      document.execCommand(kind === 'unordered' ? 'insertUnorderedList' : 'insertOrderedList', false, null);
      listNode = getCurrentListNode(pageIndex);
    }

    if (!listNode) {
      return;
    }

    const normalizedListNode = replaceListTag(listNode, desiredTagName);
    clearListPresetClasses(normalizedListNode);
    normalizedListNode.classList.add(presetClassName);
    normalizedListNode.style.listStyleType = desiredTagName === 'ol' ? 'decimal' : 'disc';
    if (desiredTagName === 'ol') {
      normalizedListNode.type = '1';
    } else {
      normalizedListNode.removeAttribute('type');
    }

    persistActivePageContent(editorNode.innerHTML, pageIndex, 'format');
    updateActiveParagraphMetrics(pageIndex);
    schedulePaginationRebalance(pageIndex);
  }, [activePageIndex, clearListPresetClasses, focusEditorHost, getCurrentListNode, getEditorNode, persistActivePageContent, replaceListTag, restoreSavedSelection, schedulePaginationRebalance, updateActiveParagraphMetrics]);

  const openPdfImportOptions = () => {
    const suggestedStartPage = String(Math.max(1, (activeTopic?.pages?.length || 0) + 1));
    setIsInspectorOpen(true);
    setPdfImportOptions((current) => ({
      visible: true,
      mode: current.mode || 'replace',
      startPage: current.startPage || suggestedStartPage,
    }));
  };

  const closePdfImportOptions = useCallback(() => {
    setPdfImportOptions((current) => ({
      ...current,
      visible: false,
    }));
    setSelectedPdfImportFile(null);
    setSelectedPdfImportPageCount(0);
  }, []);

  const openPdfImport = () => {
    pdfImportInputRef.current?.click();
  };

  const uploadAdminMedia = useCallback(async (file, { trackImageUpload = true } = {}) => {
    if (!file) {
      return null;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('context', 'learning-material');

    if (trackImageUpload) {
      setImageUploading(true);
    }
    setError('');

    try {
      const response = await apiClient.post('/admin/media-upload', formData);
      return response.data?.data?.url || '';
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal mengupload gambar materi');
      return null;
    } finally {
      if (trackImageUpload) {
        setImageUploading(false);
      }
    }
  }, []);

  const handleImageFileSelection = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    const uploadedUrl = await uploadAdminMedia(file);
    if (!uploadedUrl) {
      return;
    }

    insertHtmlBlock(getImageFigureHtml(uploadedUrl.trim()));
    persistActivePageContent(getEditorNode()?.innerHTML || '');
    schedulePaginationRebalance(activePageIndex);
  };

  const insertHtmlBlock = (html) => {
    runCommand('insertHTML', html);
  };

  const applyImportedTopicPages = useCallback((pages, { mode = 'replace', startPage = 1 } = {}) => {
    const normalizedImportedPages = renumberMaterialPages(
      pages.map((page, pageIndex) => ({
        title: page.title || `Halaman ${pageIndex + 1}`,
        points: Array.isArray(page.points) ? page.points : extractPointsFromHtml(page.content_html || ''),
        closing: page.closing || '',
        content_html: page.content_html || '<p><br></p>',
      }))
    );
    const safeStartPage = Math.max(1, Math.floor(Number(startPage || 1)) || 1);
    const currentTopics = readTopicsFromEditor();
    const currentTopic = currentTopics[activeTopicIndex];
    if (!currentTopic) {
      return;
    }

    let nextActivePage = 0;
    let nextPages = normalizedImportedPages;

    if (mode === 'append') {
      const insertIndex = safeStartPage - 1;
      const paddedExistingPages = [...(currentTopic.pages || [])];
      while (paddedExistingPages.length < insertIndex) {
        paddedExistingPages.push(createEmptyMaterialPage(paddedExistingPages.length + 1));
      }

      nextPages = renumberMaterialPages([
        ...paddedExistingPages.slice(0, insertIndex),
        ...normalizedImportedPages,
        ...paddedExistingPages.slice(insertIndex),
      ]);
      nextActivePage = insertIndex;
    }

    markHistorySource('structure');
    editorRefs.current = {};
    setMaterialForm((current) => ({
      ...current,
      topics: currentTopics.map((topic, topicIndex) => (
        topicIndex === activeTopicIndex
          ? { ...topic, pages: nextPages }
          : topic
      )),
    }));
    setActivePageIndex(nextActivePage);
    syncSelectionInUrl(activeTopicIndex, nextActivePage);
    setEditorRenderNonce((current) => current + 1);
  }, [activeTopicIndex, markHistorySource, readTopicsFromEditor, syncSelectionInUrl]);

  const getPdfJsLib = useCallback(async () => {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER_PATH;
    return pdfjsLib;
  }, []);

  const getPdfOcrWorker = useCallback(async () => {
    if (pdfOcrWorkerRef.current) {
      return pdfOcrWorkerRef.current;
    }

    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker(OCR_LANGUAGE, 1, {
      workerPath: OCR_WORKER_PATH,
      corePath: OCR_CORE_PATH,
      langPath: OCR_LANG_PATH,
      gzip: true,
      logger: (message) => {
        if (!message?.status) {
          return;
        }

        const progressPercent = Number.isFinite(message.progress)
          ? Math.round(Number(message.progress) * 100)
          : null;
        setPdfImportProgress(
          progressPercent !== null
            ? `${message.status} ${progressPercent}%`
            : String(message.status)
        );
      },
    });

    pdfOcrWorkerRef.current = worker;
    return worker;
  }, []);

  const renderPdfPageToCanvas = useCallback(async (page, scale = 1.5) => {
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });

    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);

    if (!context) {
      throw new Error('Canvas tidak tersedia untuk render PDF.');
    }

    await page.render({ canvasContext: context, viewport }).promise;
    return canvas;
  }, []);

  const canvasToBlob = useCallback((canvas) => new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }

      reject(new Error('Gagal mengubah halaman PDF menjadi gambar.'));
    }, 'image/png');
  }), []);

  const handlePdfFileSelection = useCallback(async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file || !activeTopic) {
      return;
    }

    setPdfImportProgress('Membaca ringkasan file PDF...');
    setError('');
    setSuccess('');

    try {
      const pdfjsLib = await getPdfJsLib();
      const pdfDocument = await pdfjsLib.getDocument({
        data: await file.arrayBuffer(),
        useWorkerFetch: false,
        isEvalSupported: false,
      }).promise;
      const totalPages = Math.max(1, Number(pdfDocument.numPages) || 1);

      setSelectedPdfImportFile(file);
      setSelectedPdfImportPageCount(totalPages);
      setPdfImportOptions((current) => ({
        ...current,
        pdfPageFrom: '1',
        pdfPageTo: String(totalPages),
      }));
    } catch (importError) {
      setSelectedPdfImportFile(null);
      setSelectedPdfImportPageCount(0);
      setError(importError?.message || 'Gagal membaca file PDF yang dipilih.');
    } finally {
      setPdfImportProgress('');
    }
  }, [activeTopic, getPdfJsLib]);

  const applySelectedPdfImport = useCallback(async () => {
    if (!selectedPdfImportFile || !activeTopic) {
      setError('Pilih file PDF terlebih dahulu sebelum menerapkan ke topik.');
      return;
    }

    const importMode = pdfImportOptions.mode === 'append' ? 'append' : 'replace';
    const startPage = Math.max(1, Math.floor(Number(pdfImportOptions.startPage || 1)) || 1);
    const requestedPdfPageFrom = Math.max(1, Math.floor(Number(pdfImportOptions.pdfPageFrom || 1)) || 1);

    setPdfImporting(true);
    setPdfImportProgress('Membaca file PDF...');
    setError('');
    setSuccess('');

    try {
      const pdfjsLib = await getPdfJsLib();
      const pdfDocument = await pdfjsLib.getDocument({
        data: await selectedPdfImportFile.arrayBuffer(),
        useWorkerFetch: false,
        isEvalSupported: false,
      }).promise;
      const maxPdfPage = Math.max(1, Number(pdfDocument.numPages) || 1);
      const pdfPageFrom = Math.min(requestedPdfPageFrom, maxPdfPage);
      const rawPdfPageTo = Math.max(1, Math.floor(Number(pdfImportOptions.pdfPageTo || maxPdfPage)) || maxPdfPage);
      const pdfPageTo = Math.max(pdfPageFrom, Math.min(rawPdfPageTo, maxPdfPage));
      const imageOps = new Set([
        pdfjsLib.OPS.paintImageXObject,
        pdfjsLib.OPS.paintInlineImageXObject,
        pdfjsLib.OPS.paintJpegXObject,
      ]);
      const importedPages = [];

      for (let pageNumber = pdfPageFrom; pageNumber <= pdfPageTo; pageNumber += 1) {
        setPdfImportProgress(`Memproses halaman ${pageNumber} dari ${maxPdfPage}...`);
        const page = await pdfDocument.getPage(pageNumber);
        const textContent = await page.getTextContent();
        let extractedText = extractPdfTextFromItems(textContent.items || []);
        const operatorList = await page.getOperatorList();
        const hasEmbeddedImages = (operatorList.fnArray || []).some((fn) => imageOps.has(fn));
        const shouldRenderCanvas = hasEmbeddedImages || extractedText.replace(/\s+/g, '').length < 80;

        let canvas = null;
        if (shouldRenderCanvas) {
          canvas = await renderPdfPageToCanvas(page, 1.65);
        }

        let usedOcr = false;
        if (canvas && extractedText.replace(/\s+/g, '').length < 80) {
          setPdfImportProgress(`Menjalankan OCR halaman ${pageNumber} dari ${maxPdfPage}...`);
          try {
            const worker = await getPdfOcrWorker();
            const ocrResult = await worker.recognize(canvas);
            const ocrText = String(ocrResult?.data?.text || '').trim();
            if (ocrText.length > extractedText.length) {
              extractedText = ocrText;
              usedOcr = true;
            }
          } catch (ocrError) {
            console.error('OCR import PDF gagal:', ocrError);
          }
        }

        let snapshotUrl = '';
        if (canvas && (hasEmbeddedImages || usedOcr)) {
          setPdfImportProgress(`Mengupload visual halaman ${pageNumber} dari ${maxPdfPage}...`);
          const pageBlob = await canvasToBlob(canvas);
          const pageImageFile = new File(
            [pageBlob],
            `${selectedPdfImportFile.name.replace(/\.pdf$/i, '')}-page-${pageNumber}.png`,
            { type: 'image/png' }
          );
          snapshotUrl = await uploadAdminMedia(pageImageFile, { trackImageUpload: false }) || '';
        }

        const contentHtml = buildImportedPdfPageHtml(extractedText, snapshotUrl, {
          pageNumber,
          usedOcr,
        });

        importedPages.push({
          title: `Halaman ${importedPages.length + 1}`,
          points: extractPointsFromHtml(contentHtml),
          closing: '',
          content_html: contentHtml,
        });
      }

      if (importedPages.length === 0) {
        throw new Error('PDF tidak menghasilkan halaman materi yang bisa diimpor.');
      }

      applyImportedTopicPages(importedPages, {
        mode: importMode,
        startPage,
      });
      closePdfImportOptions();
      setSuccess(
        importMode === 'append'
          ? `PDF halaman ${pdfPageFrom}-${pdfPageTo} berhasil ditambahkan mulai halaman ${startPage} pada topik "${activeTopic.title || `Topik ${activeTopicIndex + 1}`}". Klik "Simpan Materi" untuk menyimpan permanen.`
          : `PDF halaman ${pdfPageFrom}-${pdfPageTo} berhasil mengganti isi topik "${activeTopic.title || `Topik ${activeTopicIndex + 1}`}". Klik "Simpan Materi" untuk menyimpan permanen.`
      );
    } catch (importError) {
      setError(importError?.message || 'Gagal mengimpor PDF ke materi.');
    } finally {
      setPdfImporting(false);
      setPdfImportProgress('');
    }
  }, [activeTopic, activeTopicIndex, applyImportedTopicPages, canvasToBlob, closePdfImportOptions, getPdfJsLib, getPdfOcrWorker, pdfImportOptions.mode, pdfImportOptions.pdfPageFrom, pdfImportOptions.pdfPageTo, pdfImportOptions.startPage, renderPdfPageToCanvas, selectedPdfImportFile, uploadAdminMedia]);

  const insertLink = () => {
    const url = window.prompt('Masukkan URL link');
    if (!url) {
      return;
    }

    runCommand('createLink', url.trim());
  };

  const insertTable = () => {
    insertHtmlBlock(`
      <table style="width:100%; border-collapse:collapse; margin:1rem 0;">
        <tbody>
          <tr>
            <td style="border:1px solid #cbd5e1; padding:0.75rem;">Kolom 1</td>
            <td style="border:1px solid #cbd5e1; padding:0.75rem;">Kolom 2</td>
          </tr>
          <tr>
            <td style="border:1px solid #cbd5e1; padding:0.75rem;">Isi 1</td>
            <td style="border:1px solid #cbd5e1; padding:0.75rem;">Isi 2</td>
          </tr>
        </tbody>
      </table>
    `);
  };

  const insertInfoBox = () => {
    insertHtmlBlock(`
      <div style="margin:1rem 0; padding:1rem 1.1rem; border-radius:16px; border:1px solid #bfdbfe; background:linear-gradient(180deg,#eff6ff 0%,#ffffff 100%);">
        <strong style="display:block; margin-bottom:0.45rem;">Catatan Penting</strong>
        <p style="margin:0;">Tulis penekanan materi di sini.</p>
      </div>
    `);
  };

  const insertQuoteBlock = () => {
    insertHtmlBlock(`
      <blockquote style="margin:1rem 0; padding:0.9rem 1rem; border-left:4px solid #60a5fa; background:#f8fbff; border-radius:12px;">
        Kutipan atau rangkuman penting ditulis di sini.
      </blockquote>
    `);
  };

  const insertDivider = () => {
    insertHtmlBlock('<hr style="border:none; border-top:1px solid #cbd5e1; margin:1.2rem 0;" />');
  };

  const setLineHeight = (value) => {
    insertHtmlBlock(`<div style="line-height:${value};">${window.getSelection?.()?.toString() || 'Tulis paragraf di sini.'}</div>`);
  };

  const closeImageContextMenu = useCallback(() => {
    setImageContextMenu((current) => (
      current.visible ? { ...current, visible: false } : current
    ));
  }, []);
  const restoreHistorySnapshot = useCallback((snapshot) => {
    if (!snapshot) {
      return;
    }

    const safeSnapshot = cloneHistoryValue(snapshot);
    historyStateRef.current.restoring = true;
    pendingHistorySourceRef.current = 'history';
    editorRefs.current = {};
    pendingHistorySelectionRef.current = safeSnapshot.selectionBookmark || null;
    pendingHistoryScrollRef.current = Number.isFinite(Number(safeSnapshot.scrollY))
      ? Number(safeSnapshot.scrollY)
      : null;
    clearSelectedImageFigure();
    closeImageContextMenu();
    setMaterialForm(safeSnapshot.materialForm || { title: '', topics: [] });
    setMaterialMeta(safeSnapshot.materialMeta || {
      status: 'published',
      sourceUrl: '',
      reviewNotes: '',
      publishedAt: null,
    });
    setActiveTopicIndex(Math.max(0, Number(safeSnapshot.activeTopicIndex || 0)));
    setActivePageIndex(Math.max(0, Number(safeSnapshot.activePageIndex || 0)));
    setPageOrientation(safeSnapshot.pageOrientation === 'landscape' ? 'landscape' : 'portrait');
    setPageZoom(String(safeSnapshot.pageZoom || '100'));
    setEditorView(safeSnapshot.editorView === 'compact' ? 'compact' : 'page');
    setFocusMode(Boolean(safeSnapshot.focusMode));
    setEditorRenderNonce((current) => current + 1);
    requestAnimationFrame(() => {
      syncSelectionInUrl(
        Math.max(0, Number(safeSnapshot.activeTopicIndex || 0)),
        Math.max(0, Number(safeSnapshot.activePageIndex || 0))
      );
    });
  }, [clearSelectedImageFigure, closeImageContextMenu, syncSelectionInUrl]);
  const runUndoHistory = useCallback(() => {
    const historyState = historyStateRef.current;
    if (historyState.undoStack.length === 0) {
      return false;
    }

    const previousSnapshot = historyState.undoStack.pop();
    const currentSnapshot = createHistorySnapshot();
    historyState.redoStack.push(currentSnapshot);
    historyState.currentSnapshot = cloneHistoryValue(previousSnapshot);
    historyState.currentSerialized = JSON.stringify(previousSnapshot);
    historyState.lastSource = 'history';
    historyState.lastCommitAt = Date.now();
    restoreHistorySnapshot(previousSnapshot);
    return true;
  }, [createHistorySnapshot, restoreHistorySnapshot]);
  const runRedoHistory = useCallback(() => {
    const historyState = historyStateRef.current;
    if (historyState.redoStack.length === 0) {
      return false;
    }

    const nextSnapshot = historyState.redoStack.pop();
    const currentSnapshot = createHistorySnapshot();
    historyState.undoStack.push(currentSnapshot);
    historyState.currentSnapshot = cloneHistoryValue(nextSnapshot);
    historyState.currentSerialized = JSON.stringify(nextSnapshot);
    historyState.lastSource = 'history';
    historyState.lastCommitAt = Date.now();
    restoreHistorySnapshot(nextSnapshot);
    return true;
  }, [createHistorySnapshot, restoreHistorySnapshot]);
  function deleteSelectionAcrossPages() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return false;
    }

    const range = selection.getRangeAt(0);
    const startPageIndex = getEditorPageIndexFromNode(range.startContainer);
    const endPageIndex = getEditorPageIndexFromNode(range.endContainer);
    if (startPageIndex === null || endPageIndex === null || startPageIndex === endPageIndex) {
      return false;
    }

    const firstPageIndex = Math.min(startPageIndex, endPageIndex);
    const lastPageIndex = Math.max(startPageIndex, endPageIndex);
    const firstEditorNode = editorRefs.current[firstPageIndex];
    const lastEditorNode = editorRefs.current[lastPageIndex];
    if (!firstEditorNode || !lastEditorNode) {
      return false;
    }

    const firstDeletionRange = document.createRange();
    firstDeletionRange.selectNodeContents(firstEditorNode);
    firstDeletionRange.setStart(range.startContainer, range.startOffset);
    firstDeletionRange.deleteContents();

    const lastDeletionRange = document.createRange();
    lastDeletionRange.selectNodeContents(lastEditorNode);
    lastDeletionRange.setEnd(range.endContainer, range.endOffset);
    lastDeletionRange.deleteContents();

    while (lastEditorNode.firstChild) {
      firstEditorNode.appendChild(lastEditorNode.firstChild);
    }

    for (let pageIndex = firstPageIndex + 1; pageIndex <= lastPageIndex; pageIndex += 1) {
      const editorNode = editorRefs.current[pageIndex];
      if (!editorNode) {
        continue;
      }
      editorNode.innerHTML = '<p><br></p>';
    }

    normalizeEditorContent(firstEditorNode);
    normalizeEditorContent(lastEditorNode);
    focusEditorHost();

    const trailingParagraph = ensureEditorTrailingParagraph(firstEditorNode);
    placeCaretInsideNode(trailingParagraph, false);
    activatePage(firstPageIndex);
    rememberCurrentSelection(firstPageIndex);
    syncEditorFormatState(firstPageIndex);
    updateActiveParagraphMetrics(firstPageIndex);

    markHistorySource('typing');
    setMaterialForm((current) => ({
      ...current,
      topics: readTopicsFromEditor(),
    }));
    schedulePaginationRebalance(firstPageIndex);
    return true;
  }
  const handleEditorBeforeInput = useCallback((event) => {
    const selection = window.getSelection();
    const pageBounds = getSelectionPageBounds(selection, activePageIndex);
    pendingMutationContextRef.current = {
      inputType: event.nativeEvent?.inputType || 'insertText',
      ...pageBounds,
    };

    if (
      selection
      && !selection.isCollapsed
      && pageBounds.startPageIndex !== pageBounds.endPageIndex
      && String(event.nativeEvent?.inputType || '').startsWith('delete')
    ) {
      event.preventDefault();
      deleteSelectionAcrossPages();
      pendingMutationContextRef.current = null;
    }
  }, [activePageIndex, deleteSelectionAcrossPages]);

  const handleEditorPaste = useCallback((event) => {
    const clipboardData = event.clipboardData;
    if (!clipboardData) {
      return;
    }

    event.preventDefault();
    const selection = window.getSelection();
    const pageBounds = getSelectionPageBounds(selection, activePageIndex);
    pendingMutationContextRef.current = {
      inputType: 'insertFromPaste',
      ...pageBounds,
    };

    const rawHtml = clipboardData.getData('text/html');
    const rawText = clipboardData.getData('text/plain');
    const nextHtml = rawHtml
      ? sanitizeEditorHtml(rawHtml)
      : plainTextToEditorHtml(rawText);

    focusEditorHost();
    document.execCommand('insertHTML', false, nextHtml || '<p><br></p>');
  }, [activePageIndex, focusEditorHost]);

  const openImageContextMenu = useCallback((clientX, clientY, layout) => {
    const menuWidth = 220;
    const menuHeight = 280;
    setImageContextMenu({
      visible: true,
      x: Math.max(12, Math.min(clientX, window.innerWidth - menuWidth - 12)),
      y: Math.max(12, Math.min(clientY, window.innerHeight - menuHeight - 12)),
      layout,
    });
  }, []);

  const applyImageWrap = useCallback((layout) => {
    const figure = selectedImageFigureRef.current;
    if (!figure) {
      return;
    }

    setImageFigureLayout(figure, layout);
    persistActivePageContent();
    setImageContextMenu((current) => ({ ...current, visible: false, layout }));
  }, [persistActivePageContent, setImageFigureLayout]);

  const removeSelectedImage = useCallback(() => {
    const figure = selectedImageFigureRef.current;
    if (!figure) {
      return;
    }

    figure.remove();
    clearSelectedImageFigure();
    persistActivePageContent();
    closeImageContextMenu();
  }, [clearSelectedImageFigure, closeImageContextMenu, persistActivePageContent]);

  const handleEditorClick = useCallback((event) => {
    const imageNode = event.target.closest?.('img');
    if (imageNode && imageNode.closest('.admin-word-editable')) {
      const figure = ensureImageFigure(imageNode);
      selectImageFigure(figure);
      closeImageContextMenu();
      normalizeImageFigureSize(figure);
      persistActivePageContent();
      return;
    }

    clearSelectedImageFigure();
    closeImageContextMenu();
    requestAnimationFrame(() => {
      rememberCurrentSelection();
      updateActiveParagraphMetrics();
      syncEditorFormatState();
    });
  }, [clearSelectedImageFigure, closeImageContextMenu, ensureImageFigure, normalizeImageFigureSize, persistActivePageContent, rememberCurrentSelection, selectImageFigure, syncEditorFormatState, updateActiveParagraphMetrics]);

  const handleEditorContextMenu = useCallback((event) => {
    const imageNode = event.target.closest?.('img');
    if (!imageNode || !imageNode.closest('.admin-word-editable')) {
      clearSelectedImageFigure();
      closeImageContextMenu();
      return;
    }

    event.preventDefault();
    const figure = ensureImageFigure(imageNode);
    selectImageFigure(figure);
    normalizeImageFigureSize(figure);
    persistActivePageContent();
    openImageContextMenu(event.clientX, event.clientY, resolveImageWrapLayout(figure));
  }, [clearSelectedImageFigure, closeImageContextMenu, ensureImageFigure, normalizeImageFigureSize, openImageContextMenu, persistActivePageContent, resolveImageWrapLayout, selectImageFigure]);

  const handleEditorPointerDown = useCallback((event) => {
    if (event.button !== 0) {
      return;
    }

    const figure = event.target.closest?.('.material-image-frame');
    if (figure && figure.closest('.admin-word-editable')) {
      event.preventDefault();
      selectImageFigure(figure);
      closeImageContextMenu();
      normalizeImageFigureSize(figure);

      const rect = figure.getBoundingClientRect();
      const resizeHandleSize = 24;
      const mode = event.clientX >= rect.right - resizeHandleSize && event.clientY >= rect.bottom - resizeHandleSize
        ? 'resize'
        : 'move';
      const metrics = getImageFigureMetrics(figure);
      imageInteractionRef.current = {
        figure,
        mode,
        startX: event.clientX,
        startY: event.clientY,
        startMetrics: metrics,
        startLayout: metrics.layout,
        totalVerticalSpace: metrics.marginTop + metrics.marginBottom,
      };
      figure.classList.add(mode === 'resize' ? 'is-resizing' : 'is-dragging');
      return;
    }

    const editorNode = event.target.closest?.('.admin-word-editable');
    if (!(editorNode instanceof HTMLElement) || event.target !== editorNode) {
      return;
    }

    event.preventDefault();
    clearSelectedImageFigure();
    closeImageContextMenu();
    const pageIndex = Number(editorNode.dataset.pageIndex || 0);
    activatePage(pageIndex);
    placeCaretFromEditorPoint(editorNode, pageIndex, event.clientX, event.clientY);
    requestAnimationFrame(() => {
      rememberCurrentSelection(pageIndex);
      updateActiveParagraphMetrics(pageIndex);
      syncEditorFormatState(pageIndex);
    });
  }, [
    activatePage,
    clearSelectedImageFigure,
    closeImageContextMenu,
    getImageFigureMetrics,
    normalizeImageFigureSize,
    placeCaretFromEditorPoint,
    rememberCurrentSelection,
    selectImageFigure,
    syncEditorFormatState,
    updateActiveParagraphMetrics,
  ]);

  const handleEditorKeyUp = useCallback((pageIndex) => {
    rememberCurrentSelection(pageIndex);
    updateActiveParagraphMetrics(pageIndex);
    syncEditorFormatState(pageIndex);
  }, [rememberCurrentSelection, syncEditorFormatState, updateActiveParagraphMetrics]);

  useEffect(() => {
    clearSelectedImageFigure();
    closeImageContextMenu();
  }, [activePageIndex, activeTopicIndex, clearSelectedImageFigure, closeImageContextMenu]);

  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      const selectionPageIndex = getEditorPageIndexFromNode(selection?.anchorNode);
      if (selectionPageIndex === null) {
        return;
      }

      if (selectionPageIndex !== activePageIndex) {
        activatePage(selectionPageIndex);
      }
      rememberCurrentSelection(selectionPageIndex);
      updateActiveParagraphMetrics(selectionPageIndex);
      syncEditorFormatState(selectionPageIndex);
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [activatePage, activePageIndex, rememberCurrentSelection, syncEditorFormatState, updateActiveParagraphMetrics]);

  useEffect(() => {
    const handlePointerMove = (event) => {
      const dragState = paragraphRulerDragRef.current;
      if (!dragState) {
        return;
      }

      const rulerNode = rulerScaleRef.current;
      if (!rulerNode) {
        return;
      }

      const rect = rulerNode.getBoundingClientRect();
      const relativeX = Math.max(0, Math.min(event.clientX - rect.left, rect.width));
      const nextAbsoluteIndent = Math.round((relativeX / Math.max(rect.width, 1)) * PARAGRAPH_INDENT_LIMIT);

      if (dragState.marker === 'left') {
        applyParagraphMetrics(dragState.pageIndex, {
          leftIndent: nextAbsoluteIndent,
          firstLineIndent: dragState.startFirstLineIndent,
        });
        return;
      }

      applyParagraphMetrics(dragState.pageIndex, {
        leftIndent: dragState.startLeftIndent,
        firstLineIndent: nextAbsoluteIndent - dragState.startLeftIndent,
      });
    };

    const handlePointerUp = () => {
      paragraphRulerDragRef.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [applyParagraphMetrics]);

  useEffect(() => {
    const editorNode = getEditorNode();
    if (!activePage || !editorNode) {
      return;
    }

    let hasWrappedLegacyImage = false;
    editorNode.querySelectorAll('img').forEach((imageNode) => {
      if (!imageNode.closest('.material-image-frame')) {
        ensureImageFigure(imageNode);
        hasWrappedLegacyImage = true;
      }
    });

    if (hasWrappedLegacyImage) {
      persistActivePageContent();
    }
  }, [activePage, ensureImageFigure, getEditorNode, persistActivePageContent]);

  useEffect(() => {
    if (!imageContextMenu.visible) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (event.target.closest?.('.admin-image-context-menu')) {
        return;
      }
      closeImageContextMenu();
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeImageContextMenu();
      }
    };

    const handleScroll = () => closeImageContextMenu();

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [closeImageContextMenu, imageContextMenu.visible]);

  useEffect(() => {
    const handlePointerMove = (event) => {
      const interaction = imageInteractionRef.current;
      if (!interaction) {
        return;
      }

      const { figure, mode, startX, startY, startMetrics, startLayout, totalVerticalSpace } = interaction;
      const deltaX = event.clientX - startX;
      const deltaY = event.clientY - startY;

      if (mode === 'resize') {
        const bounds = getImageWidthBounds(resolveImageWrapLayout(figure));
        const nextWidth = clampNumber(startMetrics.width + deltaX, bounds.min, bounds.max);
        applyImageFigureMetrics(figure, {
          ...startMetrics,
          width: nextWidth,
        });
        return;
      }

      const nextMarginTop = clampNumber(startMetrics.marginTop + deltaY, 0, 140);
      const nextMarginBottom = clampNumber(totalVerticalSpace - nextMarginTop, 12, 180);
      applyImageFigureMetrics(figure, {
        ...getImageFigureMetrics(figure),
        marginTop: nextMarginTop,
        marginBottom: nextMarginBottom,
      });

      if (startLayout === 'full') {
        return;
      }

      let nextLayout = 'center';
      if (deltaX <= -56) {
        nextLayout = 'left';
      } else if (deltaX >= 56) {
        nextLayout = 'right';
      } else if (startLayout === 'inline' && Math.abs(deltaX) < 28) {
        nextLayout = 'inline';
      }

      if (nextLayout !== resolveImageWrapLayout(figure)) {
        setImageFigureLayout(figure, nextLayout);
      }
    };

    const handlePointerUp = () => {
      const interaction = imageInteractionRef.current;
      if (!interaction) {
        return;
      }

      interaction.figure.classList.remove('is-dragging', 'is-resizing');
      normalizeImageFigureSize(interaction.figure);
      persistActivePageContent();
      setImageContextMenu((current) => ({
        ...current,
        layout: resolveImageWrapLayout(interaction.figure),
      }));
      imageInteractionRef.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [
    applyImageFigureMetrics,
    clampNumber,
    getImageFigureMetrics,
    getImageWidthBounds,
    normalizeImageFigureSize,
    persistActivePageContent,
    resolveImageWrapLayout,
    setImageFigureLayout,
  ]);

  useEffect(() => {
    if (pendingPaginationStart === null) {
      return undefined;
    }

    const rafId = requestAnimationFrame(() => {
      rebalancePaginatedEditors(pendingPaginationStart);
      setPendingPaginationStart(null);
    });

    return () => cancelAnimationFrame(rafId);
  }, [pendingPaginationStart, rebalancePaginatedEditors]);

  useEffect(() => {
    const pendingFocusPageIndex = pendingEnterPageFocusRef.current;
    if (pendingFocusPageIndex === null) {
      return;
    }

    if (!editorRefs.current[pendingFocusPageIndex]) {
      return;
    }

    const editorNode = editorRefs.current[pendingFocusPageIndex];
    const leadingParagraph = ensureEditorLeadingParagraph(editorNode);
    persistActivePageContent(editorNode.innerHTML, pendingFocusPageIndex);
    focusEditorHost();
    placeCaretInsideNode(leadingParagraph, true);
    syncEditorFormatState(pendingFocusPageIndex);
    pendingEnterPageFocusRef.current = null;
  }, [ensureEditorLeadingParagraph, focusEditorHost, materialForm.topics, persistActivePageContent, placeCaretInsideNode, syncEditorFormatState]);

  useEffect(() => {
    const pendingSelectionBookmark = pendingHistorySelectionRef.current;
    const pendingScrollY = pendingHistoryScrollRef.current;
    if (!pendingSelectionBookmark && pendingScrollY === null) {
      return;
    }

    const targetPageIndex = Math.max(0, Number(
      pendingSelectionBookmark?.activePageIndex
      ?? pendingSelectionBookmark?.anchor?.pageIndex
      ?? activePageIndex
    ));
    if (!editorRefs.current[targetPageIndex]) {
      return;
    }

    const rafId = requestAnimationFrame(() => {
      if (pendingSelectionBookmark) {
        restoreSelectionBookmark(pendingSelectionBookmark, targetPageIndex);
        syncEditorFormatState(targetPageIndex);
      }

      if (pendingScrollY !== null) {
        window.scrollTo({ top: pendingScrollY, behavior: 'auto' });
      } else {
        editorRefs.current[targetPageIndex]?.scrollIntoView?.({ block: 'nearest' });
      }

      pendingHistorySelectionRef.current = null;
      pendingHistoryScrollRef.current = null;
    });

    return () => cancelAnimationFrame(rafId);
  }, [activePageIndex, materialForm.topics, restoreSelectionBookmark, syncEditorFormatState]);

  useEffect(() => {
    syncEditorFormatState(activePageIndex);
  }, [activePageIndex, activeTopicIndex, syncEditorFormatState]);

  useEffect(() => () => {
    if (paginationFrameRef.current) {
      cancelAnimationFrame(paginationFrameRef.current);
    }
  }, []);

  useEffect(() => () => {
    if (pdfOcrWorkerRef.current) {
      pdfOcrWorkerRef.current.terminate();
      pdfOcrWorkerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (loading || !activeSection) {
      return;
    }

    const historyState = historyStateRef.current;
    const snapshot = createHistorySnapshot();
    const serializedSnapshot = JSON.stringify(snapshot);
    const source = pendingHistorySourceRef.current || 'generic';

    if (!historyState.initialized) {
      historyState.initialized = true;
      historyState.currentSnapshot = cloneHistoryValue(snapshot);
      historyState.currentSerialized = serializedSnapshot;
      historyState.undoStack = [];
      historyState.redoStack = [];
      historyState.lastSource = source;
      historyState.lastCommitAt = Date.now();
      pendingHistorySourceRef.current = 'generic';
      return;
    }

    if (historyState.restoring) {
      historyState.restoring = false;
      historyState.currentSnapshot = cloneHistoryValue(snapshot);
      historyState.currentSerialized = serializedSnapshot;
      historyState.lastSource = 'history';
      historyState.lastCommitAt = Date.now();
      pendingHistorySourceRef.current = 'generic';
      return;
    }

    if (serializedSnapshot === historyState.currentSerialized) {
      pendingHistorySourceRef.current = 'generic';
      return;
    }

    if (source === 'navigation') {
      historyState.currentSnapshot = cloneHistoryValue(snapshot);
      historyState.currentSerialized = serializedSnapshot;
      historyState.lastSource = 'navigation';
      historyState.lastCommitAt = Date.now();
      pendingHistorySourceRef.current = 'generic';
      return;
    }

    const now = Date.now();
    const shouldMergeTyping = (
      source === 'typing'
      && historyState.lastSource === 'typing'
      && now - historyState.lastCommitAt <= HISTORY_TYPING_MERGE_WINDOW
    );

    if (shouldMergeTyping) {
      historyState.currentSnapshot = cloneHistoryValue(snapshot);
      historyState.currentSerialized = serializedSnapshot;
      historyState.lastCommitAt = now;
      pendingHistorySourceRef.current = 'generic';
      return;
    }

    if (historyState.currentSnapshot) {
      historyState.undoStack.push(cloneHistoryValue(historyState.currentSnapshot));
      if (historyState.undoStack.length > 120) {
        historyState.undoStack.shift();
      }
    }

    historyState.currentSnapshot = cloneHistoryValue(snapshot);
    historyState.currentSerialized = serializedSnapshot;
    historyState.redoStack = [];
    historyState.lastSource = source;
    historyState.lastCommitAt = now;
    pendingHistorySourceRef.current = 'generic';
  }, [activeSection, createHistorySnapshot, loading]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!(event.metaKey || event.ctrlKey) || event.defaultPrevented) {
        return;
      }

      const pressedKey = String(event.key || '').toLowerCase();
      if (pressedKey === 'z') {
        event.preventDefault();
        if (event.shiftKey) {
          runRedoHistory();
          return;
        }

        runUndoHistory();
        return;
      }

      if (pressedKey === 'y') {
        event.preventDefault();
        runRedoHistory();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [runRedoHistory, runUndoHistory]);

  const editorPageClassName = [
    'admin-doc-page',
    'admin-word-page',
    'admin-learning-page-shell',
    'admin-doc-page-a4',
    pageOrientation === 'landscape' ? 'admin-doc-page-landscape' : 'admin-doc-page-portrait',
    editorView === 'compact' ? 'admin-doc-page-compact' : '',
  ].filter(Boolean).join(' ');
  const currentPageSurfaceLabel = pageOrientation === 'landscape' ? 'A4 Landscape' : 'A4 Portrait';
  const currentRulerMarks = WORD_RULER_MARKS[pageOrientation] || WORD_RULER_MARKS.portrait;
  const activeRulerLeftPercent = `${Math.max(0, Math.min(100, (activeParagraphMetrics.leftIndent / PARAGRAPH_INDENT_LIMIT) * 100))}%`;
  const activeRulerFirstLinePercent = `${Math.max(0, Math.min(100, ((activeParagraphMetrics.leftIndent + activeParagraphMetrics.firstLineIndent) / PARAGRAPH_INDENT_LIMIT) * 100))}%`;
  const rulerShellClassName = [
    'admin-learning-ruler-shell',
    pageOrientation === 'landscape' ? 'admin-learning-ruler-shell-landscape' : 'admin-learning-ruler-shell-portrait',
  ].join(' ');

  const handleSave = async () => {
    if (!activeSection) {
      return;
    }

    rebalancePaginatedEditors(0);
    const topics = readTopicsFromEditor();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await apiClient.put('/admin/learning-material', {
        package_id: numericPackageId,
        section_code: activeSection.code,
        title: materialForm.title,
        topics,
        workspace,
        source_url: materialMeta.sourceUrl,
        review_notes: materialMeta.reviewNotes,
      });
      const savedMaterial = response.data.data?.material || null;
      setMaterialForm((current) => ({ ...current, topics }));
      if (savedMaterial) {
        setMaterialMeta({
          status: normalizeMaterialStatus(savedMaterial.status),
          sourceUrl: savedMaterial.source_url || '',
          reviewNotes: savedMaterial.review_notes || '',
          publishedAt: savedMaterial.published_at || null,
        });
        syncLearningMaterialState(savedMaterial);
      } else {
        setMaterialMeta((current) => ({
          ...current,
          status: normalizeMaterialStatus(isDraftWorkspace ? 'draft' : 'published'),
        }));
      }
      setSuccess(response.data?.message || (isDraftWorkspace ? 'Draft berhasil disimpan.' : 'Materi berhasil diperbarui.'));
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menyimpan materi');
    } finally {
      setSaving(false);
    }
  };

  const currentTopicLabel = activeTopic?.title?.trim() || `Document ${Math.max(1, activeTopicIndex + 1)}`;
  const totalTopicPages = Math.max(1, activeTopic?.pages?.length || 0);
  const activePageNumber = Math.min(totalTopicPages, Math.max(1, activePageIndex + 1));
  const activeTopicWordCount = useMemo(() => {
    if (!activeTopic?.pages?.length) {
      return 0;
    }

    return activeTopic.pages.reduce((total, page) => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(String(page?.content_html || ''), 'text/html');
      const plainText = String(doc.body.textContent || '')
        .replace(/\s+/g, ' ')
        .trim();
      if (!plainText) {
        return total;
      }

      return total + plainText.split(' ').filter(Boolean).length;
    }, 0);
  }, [activeTopic]);
  const handleZoomChange = useCallback((nextZoom) => {
    const safeZoom = Math.min(140, Math.max(70, Number(nextZoom) || 100));
    markHistorySource('layout');
    setPageZoom(String(safeZoom));
  }, [markHistorySource]);
  const toggleFocusMode = useCallback(() => {
    markHistorySource('layout');
    setFocusMode((current) => !current);
  }, [markHistorySource]);

  return (
    <AccountShell
      shellClassName="account-shell-learning account-shell-word-editor"
      title={activeTopic?.title || 'Editor Materi'}
      subtitle="Kelola isi halaman di dalam topik materi yang sedang dipilih."
      hidePageHeader
      hideBrandLogo
      hideNavActions
      hideNavbar
    >
      {error && <div className="alert">{error}</div>}
      {success && <div className="account-success">{success}</div>}
      {pdfImportProgress && <div className="alert">{pdfImportProgress}</div>}

      {loading ? (
        <div className="account-card">
          <p>Memuat editor materi...</p>
        </div>
      ) : activeSection ? (
        <section className="account-card admin-material-editor-shell admin-learning-editor-shell-page admin-word-editor-frame">
          <div className="admin-learning-editor-nav-sticky">
            <div className="admin-ribbon-tabs">
              <div className="admin-ribbon-tabs-left">
                <div className="admin-ribbon-tab-list">
                  {[
                    ['home', 'Home'],
                    ['insert', 'Insert'],
                    ['layout', 'Layout'],
                    ['view', 'View'],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={activeRibbonTab === value ? 'admin-ribbon-tab admin-ribbon-tab-active' : 'admin-ribbon-tab'}
                      onClick={() => setActiveRibbonTab(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="admin-ribbon-tabs-center">
                <div className="admin-word-ribbon-topic">
                  <span className="admin-word-ribbon-topic-label">{activeSection?.name || 'Materi'}</span>
                  {activeTopic ? (
                    <input
                      name={`material_topic_title_ribbon_${activeTopicIndex}`}
                      value={activeTopic.title}
                      onChange={(event) => updateTopicTitle(activeTopicIndex, event.target.value)}
                      placeholder="Nama topik aktif"
                      aria-label="Nama topik aktif"
                    />
                  ) : (
                    <strong>{currentTopicLabel}</strong>
                  )}
                </div>
              </div>

              <div className="admin-ribbon-tabs-right">
                <Link
                  to={`/admin?view=materi&package=${numericPackageId}&section=${encodeURIComponent(sectionCode || '')}&workspace=${workspace}`}
                  className="admin-word-ribbon-action-button"
                >
                  Kembali ke Admin
                </Link>
                <button
                  type="button"
                  className="admin-word-ribbon-action-button admin-word-ribbon-action-button-primary"
                  onClick={handleSave}
                  disabled={saving || loading || pdfImporting}
                >
                  {saving ? 'Menyimpan...' : (isDraftWorkspace ? 'Simpan Draft' : 'Simpan Materi')}
                </button>
              </div>
            </div>

            <div
              className="admin-word-ribbon admin-ribbon-panel"
              aria-label="Toolbar format materi"
              onMouseDown={(event) => {
                rememberCurrentSelection();
                if (event.target.closest?.('button')) {
                  event.preventDefault();
                }
              }}
            >
              {activeRibbonTab === 'home' && (
                <>
                  <div className="admin-ribbon-group">
                    <span className="admin-ribbon-group-label">Teks</span>
                    <div className="admin-ribbon-control-row">
                      <select
                        name="editor_block_type"
                        value={editorFormatState.blockType}
                        onChange={(event) => runCommand('formatBlock', event.target.value)}
                      >
                        <option value="p">Paragraf</option>
                        <option value="h2">Heading 1</option>
                        <option value="h3">Heading 2</option>
                      </select>
                      <select
                        name="editor_font_size"
                        value={editorFormatState.fontSize}
                        onChange={(event) => applyFontSize(event.target.value)}
                      >
                        <option value="12">12</option>
                        <option value="14">14</option>
                        <option value="16">16</option>
                        <option value="20">20</option>
                        <option value="28">28</option>
                        <option value="36">36</option>
                      </select>
                      <label className="admin-color-control">
                        Warna
                        <input
                          name="editor_text_color"
                          type="color"
                          value={editorFormatState.textColor}
                          onChange={(event) => runCommand('foreColor', event.target.value)}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="admin-ribbon-group">
                    <span className="admin-ribbon-group-label">Format</span>
                    <div className="admin-ribbon-control-row">
                      <button type="button" className={editorFormatState.bold ? 'admin-ribbon-button-active' : ''} onClick={() => runCommand('bold')}>B</button>
                      <button type="button" className={editorFormatState.italic ? 'admin-ribbon-button-active' : ''} onClick={() => runCommand('italic')}><em>I</em></button>
                      <button type="button" className={editorFormatState.underline ? 'admin-ribbon-button-active' : ''} onClick={() => runCommand('underline')}><u>U</u></button>
                      <button type="button" className={editorFormatState.strikeThrough ? 'admin-ribbon-button-active' : ''} onClick={() => runCommand('strikeThrough')}>S</button>
                      <button type="button" onClick={() => runCommand('removeFormat')}>Reset</button>
                    </div>
                  </div>

                  <div className="admin-ribbon-group">
                    <span className="admin-ribbon-group-label">Paragraf</span>
                    <div className="admin-ribbon-control-row">
                      <button
                        type="button"
                        className={editorFormatState.isBulletList ? 'admin-ribbon-icon-button admin-ribbon-button-active' : 'admin-ribbon-icon-button'}
                        aria-label="Buat bullet list"
                        onClick={() => applyListStyle('unordered', 'disc')}
                      >
                        <RibbonIcon type="bullet" />
                        <span>Bullet</span>
                      </button>
                      <select
                        className="admin-ribbon-inline-select"
                        name="editor_bullet_list_style"
                        defaultValue=""
                        onChange={(event) => {
                          if (!event.target.value) {
                            return;
                          }
                          applyListStyle('unordered', event.target.value);
                          event.target.value = '';
                        }}
                      >
                        <option value="" disabled>Bullet</option>
                        {BULLET_LIST_STYLE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className={editorFormatState.isOrderedList ? 'admin-ribbon-icon-button admin-ribbon-button-active' : 'admin-ribbon-icon-button'}
                        aria-label="Buat numbered list"
                        onClick={() => applyListStyle('ordered', 'decimal')}
                      >
                        <RibbonIcon type="ordered" />
                        <span>Nomor</span>
                      </button>
                      <select
                        className="admin-ribbon-inline-select"
                        name="editor_ordered_list_style"
                        defaultValue=""
                        onChange={(event) => {
                          if (!event.target.value) {
                            return;
                          }
                          applyListStyle('ordered', event.target.value);
                          event.target.value = '';
                        }}
                      >
                        <option value="" disabled>Nomor</option>
                        {ORDERED_LIST_STYLE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="admin-ribbon-icon-button"
                        aria-label="Buat multilevel list"
                        onClick={() => applyMultilevelListStyle('decimal-alpha-roman')}
                      >
                        <RibbonIcon type="multilevel" />
                        <span>Bertingkat</span>
                      </button>
                      <select
                        className="admin-ribbon-inline-select"
                        name="editor_multilevel_list_style"
                        defaultValue=""
                        onChange={(event) => {
                          if (!event.target.value) {
                            return;
                          }
                          applyMultilevelListStyle(event.target.value);
                          event.target.value = '';
                        }}
                      >
                        <option value="" disabled>Bertingkat</option>
                        {MULTILEVEL_LIST_STYLE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                      <button type="button" onClick={() => adjustParagraphIndent(-1)}>Outdent</button>
                      <button type="button" onClick={() => adjustParagraphIndent(1)}>Indent</button>
                      <button type="button" className={editorFormatState.align === 'left' ? 'admin-ribbon-icon-button admin-ribbon-button-active' : 'admin-ribbon-icon-button'} aria-label="Rata kiri" onClick={() => runCommand('justifyLeft')}>
                        <RibbonIcon type="alignLeft" />
                        <span>Kiri</span>
                      </button>
                      <button type="button" className={editorFormatState.align === 'center' ? 'admin-ribbon-icon-button admin-ribbon-button-active' : 'admin-ribbon-icon-button'} aria-label="Rata tengah" onClick={() => runCommand('justifyCenter')}>
                        <RibbonIcon type="alignCenter" />
                        <span>Tengah</span>
                      </button>
                      <button type="button" className={editorFormatState.align === 'right' ? 'admin-ribbon-icon-button admin-ribbon-button-active' : 'admin-ribbon-icon-button'} aria-label="Rata kanan" onClick={() => runCommand('justifyRight')}>
                        <RibbonIcon type="alignRight" />
                        <span>Kanan</span>
                      </button>
                      <button type="button" className={editorFormatState.align === 'justify' ? 'admin-ribbon-icon-button admin-ribbon-button-active' : 'admin-ribbon-icon-button'} aria-label="Rata kiri kanan" onClick={() => runCommand('justifyFull')}>
                        <RibbonIcon type="alignJustify" />
                        <span>Justify</span>
                      </button>
                    </div>
                  </div>
                </>
              )}

              {activeRibbonTab === 'insert' && (
                <>
                  <div className="admin-ribbon-group">
                    <span className="admin-ribbon-group-label">Media</span>
                    <div className="admin-ribbon-control-row">
                      <button type="button" onClick={insertImage} disabled={imageUploading}>
                        {imageUploading ? 'Mengupload...' : 'Gambar'}
                      </button>
                      <button type="button" onClick={openPdfImportOptions} disabled={!activeTopic || pdfImporting}>
                        {pdfImporting ? 'Memproses PDF...' : 'Import PDF'}
                      </button>
                      <button type="button" onClick={insertLink}>Link</button>
                      <button type="button" onClick={insertTable}>Tabel</button>
                    </div>
                  </div>

                  <div className="admin-ribbon-group">
                    <span className="admin-ribbon-group-label">Blok</span>
                    <div className="admin-ribbon-control-row">
                      <button type="button" onClick={insertQuoteBlock}>Quote</button>
                      <button type="button" onClick={insertInfoBox}>Info Box</button>
                      <button type="button" onClick={insertDivider}>Divider</button>
                    </div>
                  </div>
                </>
              )}

              {activeRibbonTab === 'layout' && (
                <>
                  <div className="admin-ribbon-group">
                    <span className="admin-ribbon-group-label">Ukuran Halaman</span>
                    <div className="admin-ribbon-control-row">
                      <button type="button" className="admin-ribbon-button-active">A4</button>
                      <button
                        type="button"
                        className={pageOrientation === 'portrait' ? 'admin-ribbon-button-active' : ''}
                        onClick={() => {
                          markHistorySource('layout');
                          setPageOrientation('portrait');
                        }}
                      >
                        Portrait
                      </button>
                      <button
                        type="button"
                        className={pageOrientation === 'landscape' ? 'admin-ribbon-button-active' : ''}
                        onClick={() => {
                          markHistorySource('layout');
                          setPageOrientation('landscape');
                        }}
                      >
                        Landscape
                      </button>
                    </div>
                  </div>

                  <div className="admin-ribbon-group">
                    <span className="admin-ribbon-group-label">Spasi</span>
                    <div className="admin-ribbon-control-row">
                      <button type="button" onClick={() => setLineHeight('1.4')}>Rapat</button>
                      <button type="button" onClick={() => setLineHeight('1.7')}>Normal</button>
                      <button type="button" onClick={() => setLineHeight('2')}>Longgar</button>
                    </div>
                  </div>
                </>
              )}

              {activeRibbonTab === 'view' && (
                <>
                  <div className="admin-ribbon-group">
                    <span className="admin-ribbon-group-label">Tampilan</span>
                    <div className="admin-ribbon-control-row">
                      <button
                        type="button"
                        className={editorView === 'page' ? 'admin-ribbon-button-active' : ''}
                        onClick={() => {
                          markHistorySource('layout');
                          setEditorView('page');
                        }}
                      >
                        Page View
                      </button>
                      <button
                        type="button"
                        className={editorView === 'compact' ? 'admin-ribbon-button-active' : ''}
                        onClick={() => {
                          markHistorySource('layout');
                          setEditorView('compact');
                        }}
                      >
                        Compact
                      </button>
                    </div>
                  </div>

                  <div className="admin-ribbon-group">
                    <span className="admin-ribbon-group-label">Zoom</span>
                    <div className="admin-ribbon-control-row">
                      {['90', '100', '110'].map((zoom) => (
                        <button
                          key={zoom}
                          type="button"
                          className={pageZoom === zoom ? 'admin-ribbon-button-active' : ''}
                          onClick={() => {
                            markHistorySource('layout');
                            setPageZoom(zoom);
                          }}
                        >
                          {zoom}%
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          {activeTopic && (
            <div className="admin-learning-ruler-dock">
              <div
                className={rulerShellClassName}
                style={{ '--doc-page-zoom': `${Number(pageZoom) / 100}` }}
              >
                <div className="admin-learning-ruler-meta">
                  <span>Ruler Aktif</span>
                  <strong>{`Halaman ${Math.max(1, activeParagraphMetrics.pageIndex + 1)}`}</strong>
                </div>
                <div className="admin-word-ruler" aria-hidden="true">
                  <div
                    className="admin-word-ruler-scale"
                    ref={rulerScaleRef}
                  >
                    {currentRulerMarks.map((mark) => (
                      <span key={`global-ruler-${mark}`}>{mark}</span>
                    ))}
                    {activePage && (
                      <div className="admin-word-ruler-markers">
                        <button
                          type="button"
                          className="admin-word-ruler-marker admin-word-ruler-marker-left"
                          style={{ left: activeRulerLeftPercent }}
                          onPointerDown={(event) => {
                            event.preventDefault();
                            activatePage(activeParagraphMetrics.pageIndex);
                            paragraphRulerDragRef.current = {
                              marker: 'left',
                              pageIndex: activeParagraphMetrics.pageIndex,
                              startLeftIndent: activeParagraphMetrics.leftIndent,
                              startFirstLineIndent: activeParagraphMetrics.firstLineIndent,
                            };
                          }}
                          aria-label="Geser indent kiri paragraf"
                        />
                        <button
                          type="button"
                          className="admin-word-ruler-marker admin-word-ruler-marker-first-line"
                          style={{ left: activeRulerFirstLinePercent }}
                          onPointerDown={(event) => {
                            event.preventDefault();
                            activatePage(activeParagraphMetrics.pageIndex);
                            paragraphRulerDragRef.current = {
                              marker: 'first-line',
                              pageIndex: activeParagraphMetrics.pageIndex,
                              startLeftIndent: activeParagraphMetrics.leftIndent,
                              startFirstLineIndent: activeParagraphMetrics.firstLineIndent,
                            };
                          }}
                          aria-label="Geser indent baris pertama paragraf"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          </div>

          <div className="admin-doc-editor admin-material-doc-editor admin-learning-editor-workspace">
            <input
              ref={imageUploadInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={handleImageFileSelection}
            />
            <input
              ref={pdfImportInputRef}
              type="file"
              accept="application/pdf,.pdf"
              hidden
              onChange={handlePdfFileSelection}
            />
            <div className={focusMode ? 'admin-word-workspace-shell admin-word-workspace-shell-focus' : 'admin-word-workspace-shell'}>
              <aside className="admin-word-sidepane">
                <div className="admin-word-sidepane-section">
                  <span className="admin-word-sidepane-label">Status</span>
                  <span className={`admin-material-status-badge admin-material-status-badge-${activeMaterialStatus}`}>
                    {getMaterialStatusLabel(activeMaterialStatus)}
                  </span>
                  <p>
                    {activeMaterialStatus === 'draft'
                      ? 'Draft hanya terlihat di area admin sampai dipublish dari panel admin.'
                      : `Published untuk peserta. Update terakhir ${formatPublishedAt(materialMeta.publishedAt)}.`}
                  </p>
                </div>

                <details
                  className="admin-word-inspector"
                  open={isInspectorOpen}
                  onToggle={(event) => setIsInspectorOpen(event.currentTarget.open)}
                >
                  <summary>Detail dokumen</summary>
                  <div className="admin-word-inspector-body">
                    <div className="form-group">
                      <label>Nama Kelompok Materi</label>
                      <input
                        name="material_title"
                        value={materialForm.title}
                        onChange={(event) => {
                          markHistorySource('metadata');
                          setMaterialForm((current) => ({ ...current, title: event.target.value }));
                        }}
                        placeholder="Nama kelompok materi"
                      />
                    </div>
                    <div className="form-group">
                      <label>Sumber Referensi</label>
                      <input
                        name="material_source_url"
                        value={materialMeta.sourceUrl}
                        onChange={(event) => {
                          markHistorySource('metadata');
                          setMaterialMeta((current) => ({ ...current, sourceUrl: event.target.value }));
                        }}
                        placeholder="https://contoh.com/sumber-materi"
                      />
                    </div>
                    <div className="form-group">
                      <label>Catatan Review Admin</label>
                      <textarea
                        name="material_review_notes"
                        rows="4"
                        value={materialMeta.reviewNotes}
                        onChange={(event) => {
                          markHistorySource('metadata');
                          setMaterialMeta((current) => ({ ...current, reviewNotes: event.target.value }));
                        }}
                        placeholder="Catatan revisi atau review admin."
                      />
                    </div>

                    {pdfImportOptions.visible && (
                      <div className="admin-learning-pdf-import-panel">
                        <div className="admin-learning-pdf-import-copy">
                          <strong>Import PDF ke Topik Aktif</strong>
                          <p className="text-muted">
                            Pilih `Replace` untuk mengganti isi topik, atau `Append` untuk menyisipkan mulai halaman tertentu.
                          </p>
                        </div>

                        <div className="admin-learning-pdf-import-mode">
                          <button
                            type="button"
                            className={pdfImportOptions.mode === 'replace' ? 'admin-learning-pdf-import-mode-button admin-learning-pdf-import-mode-button-active' : 'admin-learning-pdf-import-mode-button'}
                            onClick={() => setPdfImportOptions((current) => ({
                              ...current,
                              mode: 'replace',
                              startPage: '1',
                            }))}
                          >
                            Replace
                          </button>
                          <button
                            type="button"
                            className={pdfImportOptions.mode === 'append' ? 'admin-learning-pdf-import-mode-button admin-learning-pdf-import-mode-button-active' : 'admin-learning-pdf-import-mode-button'}
                            onClick={() => setPdfImportOptions((current) => ({
                              ...current,
                              mode: 'append',
                              startPage: current.startPage || String(Math.max(1, (activeTopic?.pages?.length || 0) + 1)),
                            }))}
                          >
                            Append
                          </button>
                        </div>

                        {pdfImportOptions.mode === 'append' && (
                          <div className="form-group">
                            <label>Mulai Sisipkan dari Halaman</label>
                            <input
                              type="number"
                              min="1"
                              value={pdfImportOptions.startPage}
                              onChange={(event) => setPdfImportOptions((current) => ({
                                ...current,
                                startPage: event.target.value,
                              }))}
                              placeholder="Contoh: 2"
                            />
                          </div>
                        )}

                        <div className="admin-learning-pdf-range-grid">
                          <div className="form-group">
                            <label>Ambil Halaman PDF Dari</label>
                            <input
                              type="number"
                              min="1"
                              value={pdfImportOptions.pdfPageFrom}
                              onChange={(event) => setPdfImportOptions((current) => ({
                                ...current,
                                pdfPageFrom: event.target.value,
                              }))}
                              placeholder="Contoh: 1"
                            />
                          </div>
                          <div className="form-group">
                            <label>Sampai Halaman PDF</label>
                            <input
                              type="number"
                              min="1"
                              value={pdfImportOptions.pdfPageTo}
                              onChange={(event) => setPdfImportOptions((current) => ({
                                ...current,
                                pdfPageTo: event.target.value,
                              }))}
                              placeholder={selectedPdfImportPageCount > 0 ? `Maks ${selectedPdfImportPageCount}` : 'Contoh: 5'}
                            />
                          </div>
                        </div>

                        {selectedPdfImportFile && (
                          <div className="admin-learning-pdf-file-preview">
                            <span>File PDF Terpilih</span>
                            <strong>{selectedPdfImportFile.name}</strong>
                            <small>Ukuran file: {formatFileSize(selectedPdfImportFile.size)}</small>
                            {selectedPdfImportPageCount > 0 && (
                              <small>Total halaman PDF: {selectedPdfImportPageCount}</small>
                            )}
                          </div>
                        )}

                        <div className="admin-doc-toolbar-actions">
                          <button type="button" className="btn btn-outline" onClick={openPdfImport} disabled={pdfImporting}>
                            {selectedPdfImportFile ? 'Ganti File PDF' : 'Pilih File PDF'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={applySelectedPdfImport}
                            disabled={pdfImporting || !selectedPdfImportFile}
                          >
                            {pdfImporting ? 'Memproses PDF...' : 'Terapkan ke Topik'}
                          </button>
                          <button type="button" className="btn btn-outline" onClick={closePdfImportOptions} disabled={pdfImporting}>
                            Tutup
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </details>
              </aside>

              <div
                ref={editorHostRef}
                className="admin-doc-page-stack admin-learning-editor-content admin-word-editable-host"
                contentEditable
                suppressContentEditableWarning
                onFocus={() => {
                  requestAnimationFrame(() => {
                    const selectionPageIndex = getEditorPageIndexFromNode(window.getSelection()?.anchorNode) ?? activePageIndex;
                    activatePage(selectionPageIndex);
                    rememberCurrentSelection(selectionPageIndex);
                    updateActiveParagraphMetrics(selectionPageIndex);
                    syncEditorFormatState(selectionPageIndex);
                  });
                }}
                onKeyDown={(event) => {
                  const selectionPageIndex = getEditorPageIndexFromNode(window.getSelection()?.anchorNode) ?? activePageIndex;
                  handleEditorKeyDown(event, selectionPageIndex);
                }}
                onKeyUp={() => {
                  const selectionPageIndex = getEditorPageIndexFromNode(window.getSelection()?.anchorNode) ?? activePageIndex;
                  handleEditorKeyUp(selectionPageIndex);
                }}
                onBeforeInput={handleEditorBeforeInput}
                onInput={(event) => {
                  const selectionPageIndex = getEditorPageIndexFromNode(window.getSelection()?.anchorNode) ?? activePageIndex;
                  const mutationContext = pendingMutationContextRef.current;
                  const originPageIndex = mutationContext?.startPageIndex ?? selectionPageIndex;
                  rememberCurrentSelection(selectionPageIndex);
                  handlePageInput(
                    selectionPageIndex,
                    event.nativeEvent?.inputType || mutationContext?.inputType || '',
                    originPageIndex
                  );
                  pendingMutationContextRef.current = null;
                }}
                onPaste={handleEditorPaste}
                onPointerDown={handleEditorPointerDown}
                onClick={handleEditorClick}
                onContextMenu={handleEditorContextMenu}
                onBlur={() => {
                  setMaterialForm((current) => ({
                    ...current,
                    topics: readTopicsFromEditor(),
                  }));
                }}
              >
                {activeTopic && (activeTopic.pages || []).map((page, pageIndex) => (
                  <div
                    key={`material-page-${activeTopicIndex}-${pageIndex}-${editorRenderNonce}`}
                    ref={(node) => {
                      if (node) {
                        editorRefs.current[pageIndex] = node;
                        const editorKey = `${activeTopicIndex}:${pageIndex}:${editorRenderNonce}`;
                        if (node.dataset.editorKey !== editorKey) {
                          node.innerHTML = page.content_html || '<p><br></p>';
                          node.dataset.editorKey = editorKey;
                        }
                      } else {
                        delete editorRefs.current[pageIndex];
                      }
                    }}
                    className={pageIndex === activePageIndex ? `${editorPageClassName} admin-word-editable admin-word-editable-document admin-doc-page-current` : `${editorPageClassName} admin-word-editable admin-word-editable-document`}
                    data-page-index={pageIndex}
                    data-surface-label={currentPageSurfaceLabel}
                    data-page-label={`Page ${pageIndex + 1}`}
                    style={{ '--doc-page-zoom': `${Number(pageZoom) / 100}` }}
                  />
                ))}
              </div>
            </div>

            <div className="admin-word-statusbar">
              <div className="admin-word-statusbar-left">
                <span>{`Page ${activePageNumber} of ${totalTopicPages}`}</span>
                <span>{`${activeTopicWordCount} words`}</span>
                <span>Bahasa Indonesia</span>
                <span>Accessibility: Siap digunakan</span>
              </div>
              <div className="admin-word-statusbar-right">
                <button
                  type="button"
                  className={focusMode ? 'admin-word-statusbar-button admin-word-statusbar-button-active' : 'admin-word-statusbar-button'}
                  onClick={toggleFocusMode}
                >
                  Focus
                </button>
                <button
                  type="button"
                  className={editorView === 'page' ? 'admin-word-statusbar-button admin-word-statusbar-button-active' : 'admin-word-statusbar-button'}
                  onClick={() => {
                    markHistorySource('layout');
                    setEditorView('page');
                  }}
                >
                  Page
                </button>
                <button
                  type="button"
                  className={editorView === 'compact' ? 'admin-word-statusbar-button admin-word-statusbar-button-active' : 'admin-word-statusbar-button'}
                  onClick={() => {
                    markHistorySource('layout');
                    setEditorView('compact');
                  }}
                >
                  Compact
                </button>
                <button
                  type="button"
                  className="admin-word-statusbar-button"
                  onClick={() => handleZoomChange(Number(pageZoom) - 10)}
                >
                  -
                </button>
                <input
                  className="admin-word-statusbar-zoom"
                  type="range"
                  min="70"
                  max="140"
                  step="10"
                  value={Number(pageZoom)}
                  onChange={(event) => handleZoomChange(event.target.value)}
                  aria-label="Zoom editor"
                />
                <button
                  type="button"
                  className="admin-word-statusbar-button"
                  onClick={() => handleZoomChange(Number(pageZoom) + 10)}
                >
                  +
                </button>
                <strong>{`${pageZoom}%`}</strong>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <div className="account-card">
          <p className="text-muted">Subtest tidak ditemukan.</p>
        </div>
      )}

      {imageContextMenu.visible && (
        <div
          className="admin-image-context-menu"
          style={{ top: `${imageContextMenu.y}px`, left: `${imageContextMenu.x}px` }}
        >
          <div className="admin-image-context-menu-head">
            <strong>Wrap Text Gambar</strong>
            <span>Klik kanan gambar untuk ubah layout.</span>
          </div>
          <div className="admin-image-context-menu-options">
            {IMAGE_WRAP_OPTIONS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={imageContextMenu.layout === value ? 'admin-image-context-option admin-image-context-option-active' : 'admin-image-context-option'}
                onClick={() => applyImageWrap(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <button type="button" className="admin-image-context-remove" onClick={removeSelectedImage}>
            Hapus Gambar
          </button>
          <button
            type="button"
            className="admin-image-context-remove admin-image-context-reset"
            onClick={() => {
              const figure = selectedImageFigureRef.current;
              if (!figure) {
                return;
              }
              figure.style.setProperty('--image-width', '320px');
              figure.style.setProperty('--image-margin-top', '16px');
              figure.style.setProperty('--image-margin-bottom', '16px');
              setImageFigureLayout(figure, 'center');
              persistActivePageContent();
              closeImageContextMenu();
            }}
          >
            Reset Ukuran & Posisi
          </button>
        </div>
      )}
    </AccountShell>
  );
}
