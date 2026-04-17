import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
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

const FONT_SIZE_COMMANDS = {
  '12': '2',
  '14': '3',
  '16': '4',
  '20': '5',
  '28': '6',
  '36': '7',
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
    .replace(/\u0000/g, '')
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

export default function AdminLearningMaterialEditor() {
  const { packageId, sectionCode } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const editorRefs = useRef({});
  const rulerScaleRefs = useRef({});
  const imageUploadInputRef = useRef(null);
  const pdfImportInputRef = useRef(null);
  const pdfOcrWorkerRef = useRef(null);
  const paginationFrameRef = useRef(null);
  const [learningContent, setLearningContent] = useState([]);
  const [materialForm, setMaterialForm] = useState({ title: '', topics: [] });
  const [activeTopicIndex, setActiveTopicIndex] = useState(0);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [pdfImporting, setPdfImporting] = useState(false);
  const [pdfImportProgress, setPdfImportProgress] = useState('');
  const [pdfImportOptions, setPdfImportOptions] = useState(buildDefaultPdfImportOptions);
  const [selectedPdfImportFile, setSelectedPdfImportFile] = useState(null);
  const [selectedPdfImportPageCount, setSelectedPdfImportPageCount] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeRibbonTab, setActiveRibbonTab] = useState('home');
  const [pageOrientation, setPageOrientation] = useState('portrait');
  const [pageZoom, setPageZoom] = useState('100');
  const [editorView, setEditorView] = useState('page');
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

  const numericPackageId = Number(packageId);
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
  const activeTopic = materialForm.topics[activeTopicIndex] || null;
  const activePage = activeTopic?.pages?.[activePageIndex] || null;
  const getEditorNode = useCallback((pageIndex = activePageIndex) => editorRefs.current[pageIndex] || null, [activePageIndex]);
  const focusEditorAtEnd = useCallback((pageIndex) => {
    requestAnimationFrame(() => {
      const editorNode = editorRefs.current[pageIndex];
      if (!editorNode) {
        return;
      }

      editorNode.focus();
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
  }, []);

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

    setActivePageIndex(pageIndex);
    if (syncUrl) {
      syncSelectionInUrl(activeTopicIndex, pageIndex);
    }
    return true;
  }, [activePageIndex, activeTopicIndex, syncSelectionInUrl]);

  const fetchLearningContent = useCallback(async () => {
    if (!Number.isInteger(numericPackageId) || numericPackageId <= 0 || !sectionCode) {
      setError('Link editor materi tidak valid.');
      setLoading(false);
      return;
    }

    try {
      const response = await apiClient.get(`/admin/learning-content?package_id=${numericPackageId}&_=${Date.now()}`);
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
  }, [numericPackageId, sectionCode, shouldCreateTopic]);

  useEffect(() => {
    fetchLearningContent();
  }, [fetchLearningContent]);

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
    const editorNode = getEditorNode(pageIndex);
    if (!editorNode) {
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !editorNode.contains(selection.anchorNode)) {
      return;
    }

    const blockNode = getClosestEditableBlock(selection.anchorNode, editorNode);
    if (!blockNode) {
      return;
    }

    const metrics = getParagraphIndentMetrics(blockNode);
    setActiveParagraphMetrics({
      pageIndex,
      leftIndent: metrics.leftIndent,
      firstLineIndent: metrics.firstLineIndent,
    });
  }, [activePageIndex, getEditorNode, getParagraphIndentMetrics]);

  const applyParagraphMetrics = useCallback((pageIndex, { leftIndent, firstLineIndent }) => {
    const editorNode = getEditorNode(pageIndex);
    if (!editorNode) {
      return false;
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return false;
    }

    const blockNode = getClosestEditableBlock(selection.anchorNode, editorNode);
    if (!blockNode || blockNode.tagName === 'LI') {
      return false;
    }

    const safeLeftIndent = Math.max(0, Math.min(PARAGRAPH_INDENT_LIMIT, Math.round(leftIndent)));
    const safeFirstLineIndent = Math.max(-FIRST_LINE_INDENT_LIMIT, Math.min(FIRST_LINE_INDENT_LIMIT, Math.round(firstLineIndent)));

    blockNode.style.marginLeft = safeLeftIndent > 0 ? `${safeLeftIndent}px` : '';
    blockNode.style.textIndent = safeFirstLineIndent !== 0 ? `${safeFirstLineIndent}px` : '';

    persistActivePageContent(editorNode.innerHTML, pageIndex);
    setActiveParagraphMetrics({
      pageIndex,
      leftIndent: safeLeftIndent,
      firstLineIndent: safeFirstLineIndent,
    });
    schedulePaginationRebalance(pageIndex);
    return true;
  }, [getEditorNode, persistActivePageContent, schedulePaginationRebalance]);

  const readTopicsFromEditor = () => materialForm.topics.map((topic, topicIndex) => ({
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
  }));

  function persistActivePageContent(rawHtml = null, pageIndex = activePageIndex) {
    const contentHtml = sanitizeEditorHtml(rawHtml ?? (getEditorNode(pageIndex)?.innerHTML || ''));
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
    setMaterialForm((current) => ({
      ...current,
      topics: current.topics.map((topic, index) => (
        index === topicIndex ? { ...topic, title } : topic
      )),
    }));
  };

  const updatePageTitle = (topicIndex, pageIndex, title) => {
    setMaterialForm((current) => ({
      ...current,
      topics: current.topics.map((topic, currentTopicIndex) => (
        currentTopicIndex === topicIndex
          ? {
              ...topic,
              pages: topic.pages.map((page, currentPageIndex) => (
                currentPageIndex === pageIndex ? { ...page, title } : page
              )),
            }
          : topic
      )),
    }));
  };

  const updatePageContent = (topicIndex, pageIndex) => {
    if (topicIndex !== activeTopicIndex || pageIndex !== activePageIndex) {
      return;
    }
    persistActivePageContent();
  };

  const selectTopic = (topicIndex) => {
    setMaterialForm((current) => ({
      ...current,
      topics: readTopicsFromEditor(),
    }));
    setActiveTopicIndex(topicIndex);
    setActivePageIndex(0);
    syncSelectionInUrl(topicIndex, 0);
  };

  const selectPage = (pageIndex) => {
    setMaterialForm((current) => ({
      ...current,
      topics: readTopicsFromEditor(),
    }));
    activatePage(pageIndex);
    focusEditorAtEnd(pageIndex);
  };

  const addTopic = () => {
    const nextTopics = [...readTopicsFromEditor(), createEmptyMaterialTopic(materialForm.topics.length + 1)];
    const nextTopicIndex = nextTopics.length - 1;
    setMaterialForm((current) => ({
      ...current,
      topics: nextTopics,
    }));
    setActiveTopicIndex(nextTopicIndex);
    setActivePageIndex(0);
    syncSelectionInUrl(nextTopicIndex, 0);
  };

  const removeMaterialPage = (pageIndex) => {
    if (!activeTopic || (activeTopic.pages?.length || 0) <= 1) {
      return;
    }

    const nextTopics = readTopicsFromEditor().map((topic, topicIndex) => (
      topicIndex === activeTopicIndex
        ? {
            ...topic,
            pages: topic.pages.filter((_, index) => index !== pageIndex),
          }
        : topic
    ));
    const nextIndex = Math.max(0, Math.min(pageIndex === activePageIndex ? activePageIndex - 1 : activePageIndex, (nextTopics[activeTopicIndex]?.pages?.length || 1) - 1));

    setMaterialForm((current) => ({
      ...current,
      topics: nextTopics,
    }));
    activatePage(nextIndex);
  };

  const isEditorPageEmpty = useCallback((pageIndex) => {
    const editorNode = editorRefs.current[pageIndex];
    if (!editorNode) {
      return false;
    }

    return getMovableEditorNodes(editorNode).length === 0;
  }, [getMovableEditorNodes]);

  const applyParagraphIndent = useCallback((pageIndex, direction = 1) => {
    const editorNode = getEditorNode(pageIndex);
    if (!editorNode) {
      return false;
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return false;
    }

    const blockNode = getClosestEditableBlock(selection.anchorNode, editorNode);
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

    persistActivePageContent(editorNode.innerHTML, pageIndex);
    updateActiveParagraphMetrics(pageIndex);
    schedulePaginationRebalance(pageIndex);
    return true;
  }, [getEditorNode, persistActivePageContent, schedulePaginationRebalance, updateActiveParagraphMetrics]);

  const adjustParagraphIndent = useCallback((direction = 1, pageIndex = activePageIndex) => {
    activatePage(pageIndex);
    const applied = applyParagraphIndent(pageIndex, direction);
    if (!applied) {
      runCommand(direction > 0 ? 'indent' : 'outdent');
    }
  }, [activatePage, activePageIndex, applyParagraphIndent]);

  const handleEditorKeyDown = useCallback((event, pageIndex) => {
    if (event.key === 'Tab') {
      event.preventDefault();
      adjustParagraphIndent(event.shiftKey ? -1 : 1, pageIndex);
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

    const nextPageIndex = Math.max(0, pageIndex - 1);
    const nextTopics = readTopicsFromEditor().map((topic, topicIndex) => (
      topicIndex === activeTopicIndex
        ? {
            ...topic,
            pages: topic.pages.filter((_, index) => index !== pageIndex),
          }
        : topic
    ));

    setMaterialForm((current) => ({
      ...current,
      topics: nextTopics,
    }));
    activatePage(nextPageIndex);
    focusEditorAtEnd(nextPageIndex);
  }, [activatePage, activeTopicIndex, adjustParagraphIndent, focusEditorAtEnd, isEditorPageEmpty, materialForm.topics, readTopicsFromEditor]);

  const rebalancePaginatedEditors = useCallback((startIndex = 0) => {
    const currentTopic = materialForm.topics[activeTopicIndex];
    if (!currentTopic || currentTopic.pages.length === 0) {
      return;
    }

    let createdNewPage = false;
    let focusNextPageIndex = null;
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
        if (getMovableEditorNodes(nextEditorNode).length === 1 && nextEditorNode.textContent.trim() === '') {
          nextEditorNode.innerHTML = '';
        }
        nextEditorNode.insertBefore(movedNode, nextEditorNode.firstChild);
        normalizeEditorContent(editorNode);
        normalizeEditorContent(nextEditorNode);
        focusNextPageIndex = pageIndex + 1;
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
        editorNode.appendChild(movedNode);
        normalizeEditorContent(editorNode);
        didReflow = true;

        if (editorNode.scrollHeight > editorNode.clientHeight + 2) {
          nextEditorNode.insertBefore(movedNode, nextEditorNode.firstChild);
          normalizeEditorContent(nextEditorNode);
          break;
        }

        normalizeEditorContent(nextEditorNode);
      }
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

    if (!createdNewPage && focusNextPageIndex !== null) {
      activatePage(focusNextPageIndex);
      focusEditorAtEnd(focusNextPageIndex);
    }
  }, [
    activatePage,
    activeTopicIndex,
    focusEditorAtEnd,
    getMovableEditorNodes,
    materialForm.topics,
    normalizeEditorContent,
    serializeActiveTopicPagesFromDom,
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

  const handlePageInput = useCallback((pageIndex) => {
    activatePage(pageIndex);
    if (pageNeedsPaginationRebalance(pageIndex)) {
      schedulePaginationRebalance(pageIndex);
    }
  }, [activatePage, pageNeedsPaginationRebalance, schedulePaginationRebalance]);

  function runCommand(command, value = null) {
    const editorNode = getEditorNode();
    if (editorNode) {
      editorNode.focus();
    }
    document.execCommand(command, false, value);
    schedulePaginationRebalance(activePageIndex);
  }

  const applyFontSize = (size) => {
    runCommand('fontSize', FONT_SIZE_COMMANDS[size] || '3');
  };

  const insertImage = () => {
    imageUploadInputRef.current?.click();
  };

  const openPdfImportOptions = () => {
    const suggestedStartPage = String(Math.max(1, (activeTopic?.pages?.length || 0) + 1));
    setPdfImportOptions((current) => ({
      visible: true,
      mode: current.mode || 'replace',
      startPage: current.startPage || suggestedStartPage,
    }));
  };

  const closePdfImportOptions = () => {
    setPdfImportOptions((current) => ({
      ...current,
      visible: false,
    }));
    setSelectedPdfImportFile(null);
    setSelectedPdfImportPageCount(0);
  };

  const openPdfImport = () => {
    pdfImportInputRef.current?.click();
  };

  const uploadAdminMedia = async (file, { trackImageUpload = true } = {}) => {
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
  };

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
  }, [activeTopicIndex, readTopicsFromEditor, syncSelectionInUrl]);

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
    requestAnimationFrame(() => updateActiveParagraphMetrics());
  }, [clearSelectedImageFigure, closeImageContextMenu, ensureImageFigure, normalizeImageFigureSize, persistActivePageContent, selectImageFigure, updateActiveParagraphMetrics]);

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
    if (!figure || !figure.closest('.admin-word-editable')) {
      return;
    }

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
  }, [closeImageContextMenu, getImageFigureMetrics, normalizeImageFigureSize, selectImageFigure]);

  const handleEditorKeyUp = useCallback((pageIndex) => {
    updateActiveParagraphMetrics(pageIndex);
  }, [updateActiveParagraphMetrics]);

  useEffect(() => {
    clearSelectedImageFigure();
    closeImageContextMenu();
  }, [activePageIndex, activeTopicIndex, clearSelectedImageFigure, closeImageContextMenu]);

  useEffect(() => {
    const handleSelectionChange = () => {
      const editorNode = getEditorNode();
      const selection = window.getSelection();
      if (!editorNode || !selection || selection.rangeCount === 0 || !editorNode.contains(selection.anchorNode)) {
        return;
      }
      updateActiveParagraphMetrics(activePageIndex);
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [activePageIndex, getEditorNode, updateActiveParagraphMetrics]);

  useEffect(() => {
    const handlePointerMove = (event) => {
      const dragState = paragraphRulerDragRef.current;
      if (!dragState) {
        return;
      }

      const rulerNode = rulerScaleRefs.current[dragState.pageIndex];
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
      await apiClient.put('/admin/learning-material', {
        package_id: numericPackageId,
        section_code: activeSection.code,
        title: materialForm.title,
        topics,
      });
      setMaterialForm((current) => ({ ...current, topics }));
      setSuccess('Materi berhasil disimpan.');
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menyimpan materi');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AccountShell
      shellClassName="account-shell-learning"
      title={activeTopic?.title || 'Editor Materi'}
      subtitle="Kelola isi halaman di dalam topik materi yang sedang dipilih."
    >
      <div className="admin-material-editor-topbar admin-learning-editor-topbar">
        <Link to="/admin" className="btn btn-outline">Kembali ke Admin</Link>
        <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving || loading || pdfImporting}>
          {saving ? 'Menyimpan...' : 'Simpan Materi'}
        </button>
      </div>

      {error && <div className="alert">{error}</div>}
      {success && <div className="account-success">{success}</div>}
      {pdfImportProgress && <div className="alert">{pdfImportProgress}</div>}

      {loading ? (
        <div className="account-card">
          <p>Memuat editor materi...</p>
        </div>
      ) : activeSection ? (
        <section className="account-card admin-material-editor-shell admin-learning-editor-shell-page">
          <div className="admin-doc-toolbar admin-learning-editor-hero">
            <div>
              <span className="account-package-tag">{activeSection.name}</span>
              <h3>{activeTopic?.title || 'Topik materi baru'}</h3>
            </div>
            <div className="admin-doc-toolbar-actions">
              <button type="button" className="btn btn-outline" onClick={() => navigate('/admin')}>Tutup Editor</button>
            </div>
          </div>

          <div className="admin-learning-editor-nav-sticky">
            <div className="admin-ribbon-tabs">
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

            <div
              className="admin-word-ribbon admin-ribbon-panel"
              aria-label="Toolbar format materi"
              onMouseDown={(event) => {
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
                      <select name="editor_block_type" onChange={(event) => runCommand('formatBlock', event.target.value)} defaultValue="p">
                        <option value="p">Paragraf</option>
                        <option value="h2">Heading 1</option>
                        <option value="h3">Heading 2</option>
                      </select>
                      <select name="editor_font_size" onChange={(event) => applyFontSize(event.target.value)} defaultValue="16">
                        <option value="12">12</option>
                        <option value="14">14</option>
                        <option value="16">16</option>
                        <option value="20">20</option>
                        <option value="28">28</option>
                        <option value="36">36</option>
                      </select>
                      <label className="admin-color-control">
                        Warna
                        <input name="editor_text_color" type="color" defaultValue="#16243c" onChange={(event) => runCommand('foreColor', event.target.value)} />
                      </label>
                    </div>
                  </div>

                  <div className="admin-ribbon-group">
                    <span className="admin-ribbon-group-label">Format</span>
                    <div className="admin-ribbon-control-row">
                      <button type="button" onClick={() => runCommand('bold')}>B</button>
                      <button type="button" onClick={() => runCommand('italic')}><em>I</em></button>
                      <button type="button" onClick={() => runCommand('underline')}><u>U</u></button>
                      <button type="button" onClick={() => runCommand('strikeThrough')}>S</button>
                      <button type="button" onClick={() => runCommand('removeFormat')}>Reset</button>
                    </div>
                  </div>

                  <div className="admin-ribbon-group">
                    <span className="admin-ribbon-group-label">Paragraf</span>
                    <div className="admin-ribbon-control-row">
                      <button type="button" onClick={() => runCommand('insertUnorderedList')}>Bullet</button>
                      <button type="button" onClick={() => runCommand('insertOrderedList')}>Nomor</button>
                      <button type="button" onClick={() => adjustParagraphIndent(-1)}>Outdent</button>
                      <button type="button" onClick={() => adjustParagraphIndent(1)}>Indent</button>
                      <button type="button" onClick={() => runCommand('justifyLeft')}>Kiri</button>
                      <button type="button" onClick={() => runCommand('justifyCenter')}>Tengah</button>
                      <button type="button" onClick={() => runCommand('justifyRight')}>Kanan</button>
                      <button type="button" onClick={() => runCommand('justifyFull')}>Justify</button>
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
                        onClick={() => setPageOrientation('portrait')}
                      >
                        Portrait
                      </button>
                      <button
                        type="button"
                        className={pageOrientation === 'landscape' ? 'admin-ribbon-button-active' : ''}
                        onClick={() => setPageOrientation('landscape')}
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
                        onClick={() => setEditorView('page')}
                      >
                        Page View
                      </button>
                      <button
                        type="button"
                        className={editorView === 'compact' ? 'admin-ribbon-button-active' : ''}
                        onClick={() => setEditorView('compact')}
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
                          onClick={() => setPageZoom(zoom)}
                        >
                          {zoom}%
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
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
            <div className="admin-doc-page-stack admin-learning-editor-content">
              <div className="admin-doc-cover admin-learning-cover-card">
                <label>Nama Kelompok Materi</label>
                <input
                  name="material_title"
                  value={materialForm.title}
                  onChange={(event) => setMaterialForm((current) => ({ ...current, title: event.target.value }))}
                />
              </div>

              {activeTopic && (
                <section className="admin-doc-cover admin-learning-cover-card">
                  <label>Nama Topik</label>
                  <input
                    name={`material_topic_title_${activeTopicIndex}`}
                    value={activeTopic.title}
                    onChange={(event) => updateTopicTitle(activeTopicIndex, event.target.value)}
                    placeholder="Nama topik"
                  />
                  <div className="admin-learning-topic-actions">
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={openPdfImportOptions}
                      disabled={pdfImporting}
                    >
                      {pdfImporting ? 'Memproses PDF...' : 'Upload PDF ke Topik Ini'}
                    </button>
                  </div>
                  {pdfImportOptions.visible && (
                    <div className="admin-learning-pdf-import-panel">
                      <div className="admin-learning-pdf-import-copy">
                        <strong>Import PDF ke Topik Aktif</strong>
                        <p className="text-muted">
                          Pilih `Replace` untuk mengganti semua isi topik ini, atau `Append` untuk menyisipkan isi PDF mulai dari halaman tertentu.
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
                            startPage: current.startPage || String(Math.max(1, (activeTopic.pages?.length || 0) + 1)),
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
                          <small className="text-muted">
                            Jika halaman tujuan belum ada, halaman kosong akan dibuat sampai posisi itu. Jika sudah ada, halaman lama dari posisi itu akan digeser ke belakang setelah halaman PDF yang diimpor.
                          </small>
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
                          Batal
                        </button>
                      </div>
                    </div>
                  )}
                  {(activeTopic.pages || []).length > 0 && (
                    <div className="admin-learning-page-tabs">
                      {activeTopic.pages.map((page, pageIndex) => (
                        <button
                          key={`page-tab-${activeTopicIndex}-${pageIndex}`}
                          type="button"
                          className={pageIndex === activePageIndex ? 'admin-doc-outline-item-active admin-learning-page-tab' : 'admin-learning-page-tab'}
                          onClick={() => selectPage(pageIndex)}
                        >
                          {`Halaman ${pageIndex + 1}`}
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {!activePage && activeTopic && (
                <section
                  className={editorPageClassName}
                  style={{ '--doc-page-zoom': `${Number(pageZoom) / 100}` }}
                >
                  <div className="admin-word-ruler" aria-hidden="true">
                    <div
                      className="admin-word-ruler-scale"
                      ref={(node) => {
                        if (node) {
                          rulerScaleRefs.current.empty = node;
                        } else {
                          delete rulerScaleRefs.current.empty;
                        }
                      }}
                    >
                      {currentRulerMarks.map((mark) => (
                        <span key={`ruler-empty-${mark}`}>{mark}</span>
                      ))}
                    </div>
                  </div>
                  <div className="admin-doc-page-head">
                    <span>{`Topik ${activeTopicIndex + 1}`}</span>
                  </div>
                  <p className="text-muted">Halaman pertama sedang disiapkan. Setelah itu isi materi akan otomatis lanjut ke halaman berikutnya saat sudah penuh.</p>
                  <div className="admin-word-page-footer">
                    <span>{currentPageSurfaceLabel}</span>
                    <strong>Halaman 1</strong>
                  </div>
                </section>
              )}

              {activeTopic && (activeTopic.pages || []).map((page, pageIndex) => (
                <section
                  key={`material-page-${activeTopicIndex}-${pageIndex}-${editorRenderNonce}`}
                  className={pageIndex === activePageIndex ? `${editorPageClassName} admin-doc-page-current` : editorPageClassName}
                  style={{ '--doc-page-zoom': `${Number(pageZoom) / 100}` }}
                >
                  <div className="admin-word-ruler" aria-hidden="true">
                    <div
                      className="admin-word-ruler-scale"
                      ref={(node) => {
                        if (node) {
                          rulerScaleRefs.current[pageIndex] = node;
                        } else {
                          delete rulerScaleRefs.current[pageIndex];
                        }
                      }}
                    >
                      {currentRulerMarks.map((mark) => (
                        <span key={`ruler-${pageIndex}-${mark}`}>{mark}</span>
                      ))}
                      {pageIndex === activeParagraphMetrics.pageIndex && (
                        <div className="admin-word-ruler-markers">
                          <button
                            type="button"
                            className="admin-word-ruler-marker admin-word-ruler-marker-left"
                            style={{ left: activeRulerLeftPercent }}
                            onPointerDown={(event) => {
                              event.preventDefault();
                              activatePage(pageIndex);
                              paragraphRulerDragRef.current = {
                                marker: 'left',
                                pageIndex,
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
                              activatePage(pageIndex);
                              paragraphRulerDragRef.current = {
                                marker: 'first-line',
                                pageIndex,
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
                  <div className="admin-doc-page-head">
                    <span>{`Halaman ${pageIndex + 1}`}</span>
                    <button
                      type="button"
                      className="btn btn-outline admin-option-delete"
                      onClick={() => removeMaterialPage(pageIndex)}
                      disabled={(activeTopic.pages?.length || 0) <= 1}
                    >
                      Hapus
                    </button>
                  </div>
                  <input
                    name={`material_page_title_${activeTopicIndex}_${pageIndex}`}
                    className="admin-doc-title-input"
                    value={page.title}
                    onChange={(event) => updatePageTitle(activeTopicIndex, pageIndex, event.target.value)}
                    onFocus={() => activatePage(pageIndex)}
                    placeholder="Judul halaman materi"
                  />
                  <div
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
                    className="admin-word-editable"
                    contentEditable
                    suppressContentEditableWarning
                    onFocus={() => {
                      activatePage(pageIndex);
                      requestAnimationFrame(() => updateActiveParagraphMetrics(pageIndex));
                    }}
                    onKeyDown={(event) => handleEditorKeyDown(event, pageIndex)}
                    onKeyUp={() => handleEditorKeyUp(pageIndex)}
                    onInput={() => handlePageInput(pageIndex)}
                    onPointerDown={handleEditorPointerDown}
                    onClick={handleEditorClick}
                    onContextMenu={handleEditorContextMenu}
                    onBlur={() => updatePageContent(activeTopicIndex, pageIndex)}
                  />
                  <div className="admin-word-page-footer">
                    <span>{currentPageSurfaceLabel}</span>
                    <strong>{`Halaman ${pageIndex + 1}`}</strong>
                  </div>
                </section>
              ))}
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
