"use client";
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { TablePlugin } from '@lexical/react/LexicalTablePlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useLexicalNodeSelection } from '@lexical/react/useLexicalNodeSelection';
import { $generateHtmlFromNodes, $generateNodesFromDOM } from '@lexical/html';
import { $getSelectionStyleValueForProperty, $patchStyleText } from '@lexical/selection';
import { HeadingNode, QuoteNode, $createHeadingNode, $createQuoteNode } from '@lexical/rich-text';
import { LinkNode, TOGGLE_LINK_COMMAND, $isLinkNode } from '@lexical/link';
import {
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  ListItemNode,
  ListNode,
  REMOVE_LIST_COMMAND,
  $createListNode,
  $isListNode,
} from '@lexical/list';
import { $setBlocksType } from '@lexical/selection';
import {
  TableCellNode,
  TableNode,
  TableRowNode,
  INSERT_TABLE_COMMAND,
} from '@lexical/table';
import { HorizontalRuleNode, INSERT_HORIZONTAL_RULE_COMMAND } from '@lexical/extension';
import {
  $applyNodeReplacement,
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $isDecoratorNode,
  $isElementNode,
  $isNodeSelection,
  $isRangeSelection,
  CAN_REDO_COMMAND,
  CAN_UNDO_COMMAND,
  COMMAND_PRIORITY_EDITOR,
  COMMAND_PRIORITY_LOW,
  DecoratorNode,
  FORMAT_ELEMENT_COMMAND,
  FORMAT_TEXT_COMMAND,
  INDENT_CONTENT_COMMAND,
  KEY_TAB_COMMAND,
  OUTDENT_CONTENT_COMMAND,
  REDO_COMMAND,
  SELECTION_CHANGE_COMMAND,
  UNDO_COMMAND,
} from 'lexical';

const DEFAULT_FONT_SIZE = '16px';
const DEFAULT_TEXT_COLOR = '#16243c';
const DEFAULT_LINE_HEIGHT = '1.75';
const PARAGRAPH_INDENT_STEP = 36;
const FIRST_LINE_INDENT_LIMIT = 72;
const PARAGRAPH_INDENT_LIMIT = 240;
const PAGE_DIMENSIONS = {
  portrait: { width: 794, height: 1123 },
  landscape: { width: 1123, height: 794 },
};
const IMAGE_LAYOUT_OPTIONS = [
  ['inline', 'Inline'],
  ['left', 'Kiri'],
  ['center', 'Tengah'],
  ['right', 'Kanan'],
];
const FONT_SIZE_OPTIONS = ['12px', '14px', '16px', '20px', '28px', '36px'];
const LINE_HEIGHT_OPTIONS = [
  { value: '1.4', label: 'Rapat' },
  { value: '1.75', label: 'Normal' },
  { value: '2', label: 'Longgar' },
];
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

function parseStyleString(styleValue) {
  return String(styleValue || '')
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce((accumulator, entry) => {
      const [propertyName, ...propertyValueParts] = entry.split(':');
      const key = propertyName?.trim();
      const value = propertyValueParts.join(':').trim();

      if (key && value) {
        accumulator[key] = value;
      }

      return accumulator;
    }, {});
}

function stringifyStyleObject(styleObject) {
  return Object.entries(styleObject)
    .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== '')
    .map(([propertyName, value]) => `${propertyName}: ${String(value).trim()}`)
    .join('; ');
}

function mergeStyleString(styleValue, nextStyles) {
  const mergedStyles = {
    ...parseStyleString(styleValue),
  };

  Object.entries(nextStyles).forEach(([propertyName, propertyValue]) => {
    if (propertyValue === null || propertyValue === undefined || String(propertyValue).trim() === '') {
      delete mergedStyles[propertyName];
      return;
    }

    mergedStyles[propertyName] = String(propertyValue).trim();
  });

  return stringifyStyleObject(mergedStyles);
}

function getTopLevelBlocks(selection) {
  if (!$isRangeSelection(selection)) {
    return [];
  }

  const blockMap = new Map();
  selection.getNodes().forEach((node) => {
    const topLevelElement = node.getTopLevelElementOrThrow();
    blockMap.set(topLevelElement.getKey(), topLevelElement);
  });

  return [...blockMap.values()];
}

function getBlockStyleValue(block, propertyName, fallbackValue = '') {
  return parseStyleString(block?.getStyle?.() || '')[propertyName] || fallbackValue;
}

function parseNumericStyleValue(styleValue) {
  const parsed = Number.parseFloat(String(styleValue || '').replace('px', '').trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function getBlockIndentMetrics(block) {
  return {
    leftIndent: parseNumericStyleValue(getBlockStyleValue(block, 'margin-left', '0')),
    firstLineIndent: parseNumericStyleValue(getBlockStyleValue(block, 'text-indent', '0')),
  };
}

function setBlockIndentMetrics(block, { leftIndent, firstLineIndent }) {
  const safeLeftIndent = Math.max(0, Math.min(PARAGRAPH_INDENT_LIMIT, Math.round(leftIndent)));
  const safeFirstLineIndent = Math.max(-FIRST_LINE_INDENT_LIMIT, Math.min(FIRST_LINE_INDENT_LIMIT, Math.round(firstLineIndent)));

  block.setStyle(mergeStyleString(block.getStyle(), {
    'margin-left': safeLeftIndent > 0 ? `${safeLeftIndent}px` : null,
    'text-indent': safeFirstLineIndent !== 0 ? `${safeFirstLineIndent}px` : null,
  }));

  return {
    leftIndent: safeLeftIndent,
    firstLineIndent: safeFirstLineIndent,
  };
}

function isListSelectionBlock(block) {
  return block?.getType?.() === 'listitem'
    || $isListNode(block)
    || $isListNode(block?.getParent?.());
}

function getPrimarySelectedBlock(selection) {
  return getTopLevelBlocks(selection)[0] || null;
}

function getNearestListNode(node) {
  let currentNode = node;

  while (currentNode) {
    if ($isListNode(currentNode)) {
      return currentNode;
    }

    currentNode = currentNode.getParent?.() || null;
  }

  return null;
}

function getRootListNode(listNode) {
  let currentListNode = listNode;
  let parentNode = currentListNode?.getParent?.() || null;

  while ($isListNode(parentNode)) {
    currentListNode = parentNode;
    parentNode = currentListNode.getParent?.() || null;
  }

  return currentListNode;
}

function getListStyleValue(listNode) {
  if (!$isListNode(listNode)) {
    return '';
  }

  const currentStyles = parseStyleString(listNode.getStyle?.() || '');
  if (currentStyles['list-style-type']) {
    return currentStyles['list-style-type'];
  }

  return listNode.getListType?.() === 'number' ? 'decimal' : 'disc';
}

function getListPresetValue(listNode) {
  if (!$isListNode(listNode)) {
    return '';
  }

  return parseStyleString(listNode.getStyle?.() || '')['--material-list-preset'] || '';
}

function getListStylePresetForDepth(presetValue, depth) {
  const presetMap = {
    'decimal-alpha-roman': ['decimal', 'lower-alpha', 'lower-roman'],
    'decimal-decimal-decimal': ['decimal', 'decimal', 'decimal'],
    'disc-circle-square': ['disc', 'circle', 'square'],
  };

  const styleSequence = presetMap[presetValue];
  if (!styleSequence) {
    return '';
  }

  return styleSequence[Math.min(depth, styleSequence.length - 1)] || styleSequence[0];
}

function applySingleListStyle(listNode, styleValue, { presetValue = '' } = {}) {
  if (!$isListNode(listNode)) {
    return;
  }

  listNode.setStyle(mergeStyleString(listNode.getStyle(), {
    'list-style-type': styleValue || null,
    '--material-list-preset': presetValue || null,
  }));
}

function applyListPresetRecursively(listNode, presetValue, depth = 0) {
  if (!$isListNode(listNode)) {
    return;
  }

  const styleValue = getListStylePresetForDepth(presetValue, depth);
  applySingleListStyle(listNode, styleValue, {
    presetValue: depth === 0 ? presetValue : '',
  });

  listNode.getChildren().forEach((childNode) => {
    childNode.getChildren?.().forEach((nestedNode) => {
      if ($isListNode(nestedNode)) {
        applyListPresetRecursively(nestedNode, presetValue, depth + 1);
      }
    });
  });
}

function MaterialImageComponent({ nodeKey, src, layout = 'center' }) {
  const [editor] = useLexicalComposerContext();
  const [isSelected, setSelected, clearSelection] = useLexicalNodeSelection(nodeKey);

  const handlePointerDown = useCallback((event) => {
    event.preventDefault();
    if (!event.shiftKey) {
      clearSelection();
    }
    setSelected(true);
    editor.focus();
  }, [clearSelection, editor, setSelected]);

  return (
    <figure
      className={isSelected ? `material-image-frame material-image-wrap-${layout} is-selected` : `material-image-frame material-image-wrap-${layout}`}
      style={{
        '--image-width': '320px',
        '--image-margin-top': '16px',
        '--image-margin-bottom': '16px',
      }}
      onPointerDown={handlePointerDown}
      onContextMenu={handlePointerDown}
    >
      <img src={src} alt="Gambar materi" />
    </figure>
  );
}

class MaterialImageNode extends DecoratorNode {
  static getType() {
    return 'material-image';
  }

  static clone(node) {
    return new MaterialImageNode(node.__src, node.__layout, node.__key);
  }

  static importJSON(serializedNode) {
    return $createMaterialImageNode({
      src: serializedNode.src,
      layout: serializedNode.layout,
    });
  }

  static importDOM() {
    return {
      figure: (domNode) => {
        if (!domNode.classList.contains('material-image-frame')) {
          return null;
        }

        return {
          conversion: () => {
            const imageNode = domNode.querySelector('img');
            if (!(imageNode instanceof HTMLImageElement) || !imageNode.src) {
              return { node: null };
            }

            const layoutClass = [...domNode.classList].find((className) => className.startsWith('material-image-wrap-'));
            const layout = layoutClass?.replace('material-image-wrap-', '') || 'center';

            return {
              node: $createMaterialImageNode({
                src: imageNode.getAttribute('src') || imageNode.src,
                layout,
              }),
            };
          },
          priority: 3,
        };
      },
      img: (domNode) => ({
        conversion: () => ({
          node: $createMaterialImageNode({
            src: domNode.getAttribute('src') || domNode.src,
            layout: 'center',
          }),
        }),
        priority: 1,
      }),
    };
  }

  constructor(src, layout = 'center', key) {
    super(key);
    this.__src = src;
    this.__layout = layout;
  }

  getLayout() {
    return this.getLatest().__layout || 'center';
  }

  setLayout(layout) {
    const writable = this.getWritable();
    writable.__layout = layout || 'center';
    return writable;
  }

  getSrc() {
    return this.getLatest().__src || '';
  }

  exportJSON() {
    return {
      type: 'material-image',
      version: 1,
      src: this.__src,
      layout: this.__layout,
    };
  }

  exportDOM() {
    const figure = document.createElement('figure');
    figure.className = `material-image-frame material-image-wrap-${this.__layout}`;
    figure.style.setProperty('--image-width', '320px');
    figure.style.setProperty('--image-margin-top', '16px');
    figure.style.setProperty('--image-margin-bottom', '16px');

    const image = document.createElement('img');
    image.src = this.__src;
    image.alt = 'Gambar materi';

    figure.appendChild(image);
    return { element: figure };
  }

  createDOM() {
    const container = document.createElement('div');
    container.className = 'admin-lexical-image-node';
    return container;
  }

  updateDOM() {
    return false;
  }

  decorate() {
    return <MaterialImageComponent nodeKey={this.getKey()} src={this.__src} layout={this.__layout} />;
  }

  isInline() {
    return false;
  }

  getTextContent() {
    return '';
  }
}

function $createMaterialImageNode({ src, layout = 'center' }) {
  return $applyNodeReplacement(new MaterialImageNode(src, layout));
}

function isMeaningfulTextNode(node) {
  return node?.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim());
}

function isInlineDomElement(node) {
  if (!(node instanceof HTMLElement)) {
    return false;
  }

  const blockTags = new Set([
    'ADDRESS',
    'ARTICLE',
    'ASIDE',
    'BLOCKQUOTE',
    'DIV',
    'DL',
    'FIELDSET',
    'FIGCAPTION',
    'FIGURE',
    'FOOTER',
    'FORM',
    'H1',
    'H2',
    'H3',
    'H4',
    'H5',
    'H6',
    'HEADER',
    'HR',
    'LI',
    'MAIN',
    'NAV',
    'OL',
    'P',
    'PRE',
    'SECTION',
    'TABLE',
    'TBODY',
    'TD',
    'TFOOT',
    'TH',
    'THEAD',
    'TR',
    'UL',
  ]);

  return !blockTags.has(node.tagName);
}

function normalizeListDomNodes(root) {
  const documentRef = root.ownerDocument;
  if (!documentRef) {
    return;
  }

  root.querySelectorAll('ul, ol').forEach((listNode) => {
    [...listNode.childNodes].forEach((childNode) => {
      if (childNode.nodeType === Node.TEXT_NODE) {
        if (!childNode.textContent?.trim()) {
          childNode.remove();
          return;
        }

        const listItem = documentRef.createElement('li');
        listItem.textContent = childNode.textContent.trim();
        childNode.replaceWith(listItem);
        return;
      }

      if (!(childNode instanceof HTMLElement)) {
        childNode.remove();
        return;
      }

      if (childNode.tagName === 'LI') {
        return;
      }

      const listItem = documentRef.createElement('li');
      childNode.replaceWith(listItem);
      listItem.appendChild(childNode);
    });
  });

  root.querySelectorAll('li').forEach((listItemNode) => {
    const parentTagName = listItemNode.parentElement?.tagName;
    if (parentTagName === 'UL' || parentTagName === 'OL') {
      return;
    }

    const wrapperList = documentRef.createElement('ul');
    listItemNode.replaceWith(wrapperList);
    wrapperList.appendChild(listItemNode);

    let nextSibling = wrapperList.nextSibling;
    while (nextSibling instanceof HTMLElement && nextSibling.tagName === 'LI') {
      const currentNode = nextSibling;
      nextSibling = nextSibling.nextSibling;
      wrapperList.appendChild(currentNode);
    }
  });
}

function normalizeRootDomNodes(root) {
  const documentRef = root.ownerDocument;
  if (!documentRef) {
    return;
  }

  let currentParagraph = null;
  [...root.childNodes].forEach((childNode) => {
    const isInlineNode = isMeaningfulTextNode(childNode)
      || (childNode instanceof HTMLElement && (childNode.tagName === 'BR' || isInlineDomElement(childNode)));

    if (!isInlineNode) {
      currentParagraph = null;
      return;
    }

    if (!currentParagraph) {
      currentParagraph = documentRef.createElement('p');
      childNode.before(currentParagraph);
    }

    currentParagraph.appendChild(childNode);
  });
}

function normalizeHtmlForLexical(dom) {
  const root = dom?.body || dom;
  if (!root) {
    return dom;
  }

  normalizeListDomNodes(root);
  normalizeRootDomNodes(root);
  return dom;
}

function normalizeLexicalTopLevelNodes(nodes) {
  const normalizedNodes = [];
  let currentParagraph = null;
  let currentList = null;

  const flushParagraph = () => {
    if (currentParagraph && currentParagraph.getChildrenSize() > 0) {
      normalizedNodes.push(currentParagraph);
    }
    currentParagraph = null;
  };

  const flushList = () => {
    if (currentList && currentList.getChildrenSize() > 0) {
      normalizedNodes.push(currentList);
    }
    currentList = null;
  };

  nodes.forEach((node) => {
    if ($isListNode(node)) {
      flushParagraph();
      flushList();
      normalizedNodes.push(node);
      return;
    }

    if (node.getType?.() === 'listitem') {
      flushParagraph();
      if (!currentList) {
        currentList = $createListNode('bullet');
      }
      currentList.append(node);
      return;
    }

    flushList();
    if ($isDecoratorNode(node) || ($isElementNode(node) && !node.isInline())) {
      flushParagraph();
      normalizedNodes.push(node);
      return;
    }

    if (!currentParagraph) {
      currentParagraph = $createParagraphNode();
    }
    currentParagraph.append(node);
  });

  flushParagraph();
  flushList();

  return normalizedNodes.length > 0 ? normalizedNodes : [$createParagraphNode()];
}

function createLexicalNodesFromHtml(editor, html) {
  const parser = new DOMParser();
  const dom = parser.parseFromString(String(html || ''), 'text/html');
  normalizeHtmlForLexical(dom);
  return normalizeLexicalTopLevelNodes($generateNodesFromDOM(editor, dom));
}

function LexicalInitialHtmlPlugin({ initialHtml }) {
  const [editor] = useLexicalComposerContext();
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) {
      return;
    }

    initializedRef.current = true;
    editor.update(() => {
      const root = $getRoot();
      root.clear();

      if (initialHtml) {
        const nodes = createLexicalNodesFromHtml(editor, initialHtml);
        root.append(...nodes);
      }

      if (!root.getFirstChild()) {
        root.append($createParagraphNode());
      }
    });
  }, [editor, initialHtml]);

  return null;
}

function resolveBlockTypeFromSelection(selection) {
  if (!$isRangeSelection(selection)) {
    return 'paragraph';
  }

  const anchorNode = selection.anchor.getNode();
  const topLevelElement = anchorNode.getTopLevelElementOrThrow();
  const parentNode = topLevelElement.getParent();

  if ($isListNode(topLevelElement)) {
    return topLevelElement.getListType();
  }

  if ($isListNode(parentNode)) {
    return parentNode.getListType();
  }

  const topLevelType = topLevelElement.getType();
  if (topLevelType === 'heading' && typeof topLevelElement.getTag === 'function') {
    return topLevelElement.getTag();
  }

  return topLevelType;
}

function setBlockType(editor, blockType) {
  editor.update(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) {
      return;
    }

    if (blockType === 'bullet') {
      editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
      return;
    }

    if (blockType === 'number') {
      editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
      return;
    }

    if (blockType === 'paragraph') {
      editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
      $setBlocksType(selection, () => $createParagraphNode());
      return;
    }

    if (blockType === 'quote') {
      editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
      $setBlocksType(selection, () => $createQuoteNode());
      return;
    }

    if (blockType === 'h2' || blockType === 'h3') {
      editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
      $setBlocksType(selection, () => $createHeadingNode(blockType));
    }
  });
}

function LexicalEditorBridge({ editorRef }) {
  const [editor] = useLexicalComposerContext();

  useImperativeHandle(editorRef, () => ({
    focus() {
      editor.focus();
    },
    insertHtml(html) {
      editor.update(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) {
          return;
        }

        const nodes = createLexicalNodesFromHtml(editor, html);
        selection.insertNodes(nodes);
      });
      editor.focus();
    },
    insertImage(src, layout = 'center') {
      editor.update(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !src) {
          return;
        }

        selection.insertNodes([
          $createMaterialImageNode({ src, layout }),
          $createParagraphNode(),
        ]);
      });
      editor.focus();
    },
    insertTable() {
      editor.dispatchCommand(INSERT_TABLE_COMMAND, {
        columns: '2',
        rows: '2',
        includeHeaders: false,
      });
      editor.focus();
    },
    insertDivider() {
      editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, undefined);
      editor.focus();
    },
    setLineHeight(value) {
      editor.update(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) {
          return;
        }

        getTopLevelBlocks(selection).forEach((block) => {
          block.setStyle(mergeStyleString(block.getStyle(), {
            'line-height': value,
          }));
        });
      });
      editor.focus();
    },
    setParagraphMetrics({ leftIndent = 0, firstLineIndent = 0 } = {}) {
      editor.update(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) {
          return;
        }

        getTopLevelBlocks(selection).forEach((block) => {
          if (isListSelectionBlock(block)) {
            return;
          }

          setBlockIndentMetrics(block, {
            leftIndent,
            firstLineIndent,
          });
        });
      });
      editor.focus();
    },
  }), [editor]);

  return null;
}

function LexicalParagraphTabPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => editor.registerCommand(
    KEY_TAB_COMMAND,
    (event) => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) {
        return false;
      }

      const selectedBlocks = getTopLevelBlocks(selection);
      if (selectedBlocks.length === 0) {
        return false;
      }

      event?.preventDefault();

      if (selectedBlocks.some((block) => isListSelectionBlock(block))) {
        editor.dispatchCommand(event?.shiftKey ? OUTDENT_CONTENT_COMMAND : INDENT_CONTENT_COMMAND, undefined);
        return true;
      }

      let changed = false;
      selectedBlocks.forEach((block) => {
        const currentMetrics = getBlockIndentMetrics(block);
        let nextLeftIndent = currentMetrics.leftIndent;
        let nextFirstLineIndent = currentMetrics.firstLineIndent;

        if (event?.shiftKey) {
          if (currentMetrics.firstLineIndent > 0) {
            nextFirstLineIndent = Math.max(0, currentMetrics.firstLineIndent - PARAGRAPH_INDENT_STEP);
          } else if (currentMetrics.firstLineIndent < 0) {
            nextFirstLineIndent = Math.min(0, currentMetrics.firstLineIndent + PARAGRAPH_INDENT_STEP);
          } else if (currentMetrics.leftIndent > 0) {
            nextLeftIndent = Math.max(0, currentMetrics.leftIndent - PARAGRAPH_INDENT_STEP);
          } else {
            return;
          }
        } else {
          nextFirstLineIndent = Math.min(FIRST_LINE_INDENT_LIMIT, currentMetrics.firstLineIndent + PARAGRAPH_INDENT_STEP);
        }

        if (nextLeftIndent === currentMetrics.leftIndent && nextFirstLineIndent === currentMetrics.firstLineIndent) {
          return;
        }

        setBlockIndentMetrics(block, {
          leftIndent: nextLeftIndent,
          firstLineIndent: nextFirstLineIndent,
        });
        changed = true;
      });

      return changed;
    },
    COMMAND_PRIORITY_EDITOR
  ), [editor]);

  return null;
}

function LexicalSelectionMetricsPlugin({ onSelectionMetricsChange }) {
  const [editor] = useLexicalComposerContext();

  const emitMetrics = useCallback(() => {
    if (!onSelectionMetricsChange) {
      return;
    }

    const selection = $getSelection();
    if (!$isRangeSelection(selection)) {
      onSelectionMetricsChange({
        leftIndent: 0,
        firstLineIndent: 0,
      });
      return;
    }

    const primaryBlock = getPrimarySelectedBlock(selection);
    if (!primaryBlock) {
      onSelectionMetricsChange({
        leftIndent: 0,
        firstLineIndent: 0,
      });
      return;
    }

    onSelectionMetricsChange(getBlockIndentMetrics(primaryBlock));
  }, [onSelectionMetricsChange]);

  useEffect(() => {
    const unregisterUpdate = editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        emitMetrics();
      });
    });

    const unregisterSelection = editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        emitMetrics();
        return false;
      },
      COMMAND_PRIORITY_LOW
    );

    return () => {
      unregisterUpdate();
      unregisterSelection();
    };
  }, [editor, emitMetrics]);

  return null;
}

function LexicalToolbarPlugin() {
  const [editor] = useLexicalComposerContext();
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [blockType, setCurrentBlockType] = useState('paragraph');
  const [formatState, setFormatState] = useState({
    bold: false,
    italic: false,
    underline: false,
    strikeThrough: false,
    link: false,
    align: 'left',
    fontSize: DEFAULT_FONT_SIZE,
    textColor: DEFAULT_TEXT_COLOR,
    lineHeight: DEFAULT_LINE_HEIGHT,
    listStyle: '',
    listPreset: '',
    imageSelected: false,
    imageLayout: 'center',
  });

  const updateToolbar = useCallback(() => {
    const selection = $getSelection();
    if ($isNodeSelection(selection)) {
      const selectedNodes = selection.getNodes();
      const selectedImageNode = selectedNodes.find((node) => node instanceof MaterialImageNode) || null;

      setFormatState((current) => ({
        ...current,
        imageSelected: Boolean(selectedImageNode),
        imageLayout: selectedImageNode?.getLayout?.() || 'center',
      }));
      return;
    }

    if (!$isRangeSelection(selection)) {
      setFormatState((current) => ({
        ...current,
        listStyle: '',
        listPreset: '',
        imageSelected: false,
        imageLayout: 'center',
      }));
      return;
    }

    const anchorNode = selection.anchor.getNode();
    const parentNode = anchorNode.getParent();
    const selectedBlocks = getTopLevelBlocks(selection);
    const firstLineHeight = selectedBlocks.length > 0
      ? getBlockStyleValue(selectedBlocks[0], 'line-height', DEFAULT_LINE_HEIGHT)
      : DEFAULT_LINE_HEIGHT;
    const lineHeight = selectedBlocks.every((block) => (
      getBlockStyleValue(block, 'line-height', DEFAULT_LINE_HEIGHT) === firstLineHeight
    ))
      ? firstLineHeight
      : '';
    const nearestListNode = getNearestListNode(anchorNode);
    const rootListNode = getRootListNode(nearestListNode);

    setCurrentBlockType(resolveBlockTypeFromSelection(selection));
    setFormatState({
      bold: selection.hasFormat('bold'),
      italic: selection.hasFormat('italic'),
      underline: selection.hasFormat('underline'),
      strikeThrough: selection.hasFormat('strikethrough'),
      link: $isLinkNode(anchorNode) || $isLinkNode(parentNode),
      align: anchorNode.getTopLevelElementOrThrow().getFormatType() || 'left',
      fontSize: $getSelectionStyleValueForProperty(selection, 'font-size', DEFAULT_FONT_SIZE) || DEFAULT_FONT_SIZE,
      textColor: $getSelectionStyleValueForProperty(selection, 'color', DEFAULT_TEXT_COLOR) || DEFAULT_TEXT_COLOR,
      lineHeight,
      listStyle: getListStyleValue(nearestListNode),
      listPreset: getListPresetValue(rootListNode),
      imageSelected: false,
      imageLayout: 'center',
    });
  }, []);

  useEffect(() => {
    const unregisterUpdate = editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        updateToolbar();
      });
    });

    const unregisterSelection = editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        updateToolbar();
        return false;
      },
      COMMAND_PRIORITY_LOW
    );

    const unregisterCanUndo = editor.registerCommand(
      CAN_UNDO_COMMAND,
      (payload) => {
        setCanUndo(payload);
        return false;
      },
      COMMAND_PRIORITY_LOW
    );

    const unregisterCanRedo = editor.registerCommand(
      CAN_REDO_COMMAND,
      (payload) => {
        setCanRedo(payload);
        return false;
      },
      COMMAND_PRIORITY_LOW
    );

    return () => {
      unregisterUpdate();
      unregisterSelection();
      unregisterCanUndo();
      unregisterCanRedo();
    };
  }, [editor, updateToolbar]);

  const toggleLink = () => {
    if (formatState.link) {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
      return;
    }

    const nextUrl = window.prompt('Masukkan URL link');
    if (nextUrl && nextUrl.trim()) {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, nextUrl.trim());
    }
  };

  const applyTextStyle = (stylePatch) => {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) {
        return;
      }

      $patchStyleText(selection, stylePatch);
    });
  };

  const applyLineHeight = (value) => {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) {
        return;
      }

      getTopLevelBlocks(selection).forEach((block) => {
        block.setStyle(mergeStyleString(block.getStyle(), {
          'line-height': value,
        }));
      });
    });
  };

  const ensureListThenRun = (kind, runner) => {
    const desiredBlockType = kind === 'unordered' ? 'bullet' : 'number';
    const selection = editor.getEditorState().read(() => $getSelection());
    const hasList = $isRangeSelection(selection) && Boolean(getNearestListNode(selection.anchor.getNode()));

    if (hasList) {
      runner();
      return;
    }

    setBlockType(editor, desiredBlockType);
    requestAnimationFrame(runner);
  };

  const applyListStyle = (kind, styleValue) => {
    ensureListThenRun(kind, () => {
      editor.update(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) {
          return;
        }

        const listNode = getNearestListNode(selection.anchor.getNode());
        if (!listNode) {
          return;
        }

        applySingleListStyle(listNode, styleValue, { presetValue: '' });
      });
    });
  };

  const applyMultilevelListPreset = (presetValue) => {
    const kind = presetValue === 'disc-circle-square' ? 'unordered' : 'ordered';
    ensureListThenRun(kind, () => {
      editor.update(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) {
          return;
        }

        const listNode = getNearestListNode(selection.anchor.getNode());
        const rootListNode = getRootListNode(listNode);
        if (!rootListNode) {
          return;
        }

        applyListPresetRecursively(rootListNode, presetValue);
      });
    });
  };

  const updateSelectedImageLayout = (layout) => {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isNodeSelection(selection)) {
        return;
      }

      selection.getNodes().forEach((node) => {
        if (node instanceof MaterialImageNode) {
          node.setLayout(layout);
        }
      });
    });
  };

  const removeSelectedImage = () => {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isNodeSelection(selection)) {
        return;
      }

      selection.getNodes().forEach((node) => {
        if (node instanceof MaterialImageNode) {
          node.remove();
        }
      });
    });
    editor.focus();
  };

  const resetFormatting = () => {
    if (formatState.bold) {
      editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold');
    }
    if (formatState.italic) {
      editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic');
    }
    if (formatState.underline) {
      editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline');
    }
    if (formatState.strikeThrough) {
      editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough');
    }
    if (formatState.link) {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
    }

    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) {
        return;
      }

      $patchStyleText(selection, {
        color: null,
        'font-size': null,
        'background-color': null,
      });

      getTopLevelBlocks(selection).forEach((block) => {
        block.setStyle(mergeStyleString(block.getStyle(), {
          'line-height': null,
        }));
      });
    });
  };

  return (
    <div className="admin-lexical-toolbar">
      <div className="admin-lexical-toolbar-group">
        <label className="admin-lexical-toolbar-label" htmlFor="lexical-block-type">Blok</label>
        <select
          id="lexical-block-type"
          value={blockType}
          onChange={(event) => setBlockType(editor, event.target.value)}
        >
          <option value="paragraph">Paragraf</option>
          <option value="h2">Heading 1</option>
          <option value="h3">Heading 2</option>
          <option value="quote">Quote</option>
          <option value="bullet">Bullet</option>
          <option value="number">Nomor</option>
        </select>
      </div>

      <div className="admin-lexical-toolbar-group">
        <label className="admin-lexical-toolbar-label" htmlFor="lexical-font-size">Ukuran</label>
        <select
          id="lexical-font-size"
          value={formatState.fontSize}
          onChange={(event) => applyTextStyle({ 'font-size': event.target.value })}
        >
          {FONT_SIZE_OPTIONS.map((option) => (
            <option key={option} value={option}>{option.replace('px', '')}</option>
          ))}
        </select>
        <label className="admin-lexical-toolbar-color" htmlFor="lexical-text-color">
          <span>Warna</span>
          <input
            id="lexical-text-color"
            type="color"
            value={formatState.textColor}
            onChange={(event) => applyTextStyle({ color: event.target.value })}
          />
        </label>
      </div>

      <div className="admin-lexical-toolbar-group">
        <button
          type="button"
          className={formatState.bold ? 'admin-lexical-toolbar-button admin-lexical-toolbar-button-active' : 'admin-lexical-toolbar-button'}
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')}
        >
          B
        </button>
        <button
          type="button"
          className={formatState.italic ? 'admin-lexical-toolbar-button admin-lexical-toolbar-button-active' : 'admin-lexical-toolbar-button'}
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')}
        >
          I
        </button>
        <button
          type="button"
          className={formatState.underline ? 'admin-lexical-toolbar-button admin-lexical-toolbar-button-active' : 'admin-lexical-toolbar-button'}
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline')}
        >
          U
        </button>
        <button
          type="button"
          className={formatState.strikeThrough ? 'admin-lexical-toolbar-button admin-lexical-toolbar-button-active' : 'admin-lexical-toolbar-button'}
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough')}
        >
          S
        </button>
        <button
          type="button"
          className={formatState.link ? 'admin-lexical-toolbar-button admin-lexical-toolbar-button-active' : 'admin-lexical-toolbar-button'}
          onClick={toggleLink}
        >
          Link
        </button>
        <button type="button" className="admin-lexical-toolbar-button" onClick={resetFormatting}>
          Reset
        </button>
      </div>

      <div className="admin-lexical-toolbar-group">
        <label className="admin-lexical-toolbar-label" htmlFor="lexical-line-height">Spasi</label>
        <select
          id="lexical-line-height"
          value={formatState.lineHeight || ''}
          onChange={(event) => applyLineHeight(event.target.value)}
        >
          <option value="">Campuran</option>
          {LINE_HEIGHT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      <div className="admin-lexical-toolbar-group">
        <label className="admin-lexical-toolbar-label" htmlFor="lexical-bullet-style">List</label>
        <select
          id="lexical-bullet-style"
          value={formatState.listStyle && formatState.listStyle !== 'decimal' ? formatState.listStyle : ''}
          onChange={(event) => {
            if (!event.target.value) {
              return;
            }
            applyListStyle('unordered', event.target.value);
          }}
        >
          <option value="">Bullet</option>
          {BULLET_LIST_STYLE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <select
          id="lexical-number-style"
          value={formatState.listStyle && !['disc', 'circle', 'square'].includes(formatState.listStyle) ? formatState.listStyle : ''}
          onChange={(event) => {
            if (!event.target.value) {
              return;
            }
            applyListStyle('ordered', event.target.value);
          }}
        >
          <option value="">Nomor</option>
          {ORDERED_LIST_STYLE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <select
          id="lexical-list-preset"
          value={formatState.listPreset || ''}
          onChange={(event) => {
            if (!event.target.value) {
              return;
            }
            applyMultilevelListPreset(event.target.value);
          }}
        >
          <option value="">Bertingkat</option>
          {MULTILEVEL_LIST_STYLE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      <div className="admin-lexical-toolbar-group">
        <button
          type="button"
          className={formatState.align === 'left' ? 'admin-lexical-toolbar-button admin-lexical-toolbar-button-active' : 'admin-lexical-toolbar-button'}
          onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'left')}
        >
          Kiri
        </button>
        <button
          type="button"
          className={formatState.align === 'center' ? 'admin-lexical-toolbar-button admin-lexical-toolbar-button-active' : 'admin-lexical-toolbar-button'}
          onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'center')}
        >
          Tengah
        </button>
        <button
          type="button"
          className={formatState.align === 'right' ? 'admin-lexical-toolbar-button admin-lexical-toolbar-button-active' : 'admin-lexical-toolbar-button'}
          onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'right')}
        >
          Kanan
        </button>
        <button
          type="button"
          className={formatState.align === 'justify' ? 'admin-lexical-toolbar-button admin-lexical-toolbar-button-active' : 'admin-lexical-toolbar-button'}
          onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'justify')}
        >
          Justify
        </button>
      </div>

      <div className="admin-lexical-toolbar-group">
        <button type="button" className="admin-lexical-toolbar-button" onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)} disabled={!canUndo}>Undo</button>
        <button type="button" className="admin-lexical-toolbar-button" onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)} disabled={!canRedo}>Redo</button>
      </div>

      {formatState.imageSelected && (
        <div className="admin-lexical-toolbar-group">
          <label className="admin-lexical-toolbar-label" htmlFor="lexical-image-layout">Gambar</label>
          <select
            id="lexical-image-layout"
            value={formatState.imageLayout}
            onChange={(event) => updateSelectedImageLayout(event.target.value)}
          >
            {IMAGE_LAYOUT_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <button type="button" className="admin-lexical-toolbar-button" onClick={removeSelectedImage}>
            Hapus Gambar
          </button>
        </div>
      )}
    </div>
  );
}

const LexicalMaterialEditor = forwardRef(function LexicalMaterialEditor({
  documentKey,
  initialHtml,
  onChange,
  onSelectionMetricsChange,
  pageOrientation = 'portrait',
  estimatedPageCount = 1,
}, ref) {
  const bridgeRef = useRef(null);
  const surfaceRef = useRef(null);
  const pageSize = useMemo(
    () => PAGE_DIMENSIONS[pageOrientation] || PAGE_DIMENSIONS.portrait,
    [pageOrientation]
  );
  const [currentVirtualPage, setCurrentVirtualPage] = useState(1);
  const initialConfig = useMemo(() => ({
    namespace: `material-lexical-editor-${documentKey}`,
    onError: (error) => {
      throw error;
    },
    nodes: [
      HeadingNode,
      QuoteNode,
      ListNode,
      ListItemNode,
      LinkNode,
      MaterialImageNode,
      TableNode,
      TableRowNode,
      TableCellNode,
      HorizontalRuleNode,
    ],
    theme: {
      paragraph: 'admin-lexical-paragraph',
      quote: 'admin-lexical-quote',
      heading: {
        h2: 'admin-lexical-heading admin-lexical-heading-h2',
        h3: 'admin-lexical-heading admin-lexical-heading-h3',
      },
      text: {
        bold: 'admin-lexical-text-bold',
        italic: 'admin-lexical-text-italic',
        underline: 'admin-lexical-text-underline',
      },
      list: {
        ul: 'admin-lexical-list-ul',
        ol: 'admin-lexical-list-ol',
        listitem: 'admin-lexical-list-item',
      },
      link: 'admin-lexical-link',
      table: 'admin-lexical-table',
      tableRow: 'admin-lexical-table-row',
      tableCell: 'admin-lexical-table-cell',
      tableCellHeader: 'admin-lexical-table-cell-header',
      hr: 'admin-lexical-divider',
    },
  }), [documentKey]);

  useImperativeHandle(ref, () => ({
    focus() {
      bridgeRef.current?.focus?.();
    },
    insertHtml(html) {
      bridgeRef.current?.insertHtml?.(html);
    },
    insertImage(src, layout) {
      bridgeRef.current?.insertImage?.(src, layout);
    },
    insertTable() {
      bridgeRef.current?.insertTable?.();
    },
    insertDivider() {
      bridgeRef.current?.insertDivider?.();
    },
    setLineHeight(value) {
      bridgeRef.current?.setLineHeight?.(value);
    },
    setParagraphMetrics(metrics) {
      bridgeRef.current?.setParagraphMetrics?.(metrics);
    },
  }), []);

  const pageJumpTargets = useMemo(() => {
    const totalPages = Math.max(1, Number(estimatedPageCount) || 1);
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    return [1, 2, 3, 4, 5, totalPages - 1, totalPages];
  }, [estimatedPageCount]);

  const scrollToVirtualPage = useCallback((pageNumber) => {
    const safePageNumber = Math.max(1, Math.min(Number(estimatedPageCount) || 1, Number(pageNumber) || 1));
    const surfaceNode = surfaceRef.current;
    if (!surfaceNode) {
      return;
    }

    const rect = surfaceNode.getBoundingClientRect();
    const targetY = window.scrollY + rect.top + ((safePageNumber - 1) * pageSize.height) - 156;
    window.scrollTo({
      top: Math.max(0, targetY),
      behavior: 'smooth',
    });
  }, [estimatedPageCount, pageSize.height]);

  useEffect(() => {
    const updateCurrentVirtualPage = () => {
      const surfaceNode = surfaceRef.current;
      if (!surfaceNode) {
        return;
      }

      const rect = surfaceNode.getBoundingClientRect();
      const relativeTop = Math.max(0, (window.scrollY + 196) - (window.scrollY + rect.top));
      const nextPage = Math.max(1, Math.min(
        Math.max(1, Number(estimatedPageCount) || 1),
        Math.floor(relativeTop / pageSize.height) + 1
      ));
      setCurrentVirtualPage(nextPage);
    };

    updateCurrentVirtualPage();
    window.addEventListener('scroll', updateCurrentVirtualPage, { passive: true });
    window.addEventListener('resize', updateCurrentVirtualPage);
    return () => {
      window.removeEventListener('scroll', updateCurrentVirtualPage);
      window.removeEventListener('resize', updateCurrentVirtualPage);
    };
  }, [estimatedPageCount, pageSize.height]);

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="admin-lexical-shell">
        <LexicalToolbarPlugin />
        <div className="admin-lexical-page-jump-bar">
          <span>Mode edit dokumen • estimasi {Math.max(1, estimatedPageCount)} halaman A4</span>
          {pageJumpTargets.length > 1 && (
            <div className="admin-lexical-page-jump-actions">
              {pageJumpTargets.map((pageNumber) => (
                <button
                  key={`virtual-page-${pageNumber}`}
                  type="button"
                  className={pageNumber === currentVirtualPage ? 'admin-lexical-page-jump-button admin-lexical-page-jump-button-active' : 'admin-lexical-page-jump-button'}
                  onClick={() => scrollToVirtualPage(pageNumber)}
                >
                  Page {pageNumber}
                </button>
              ))}
            </div>
          )}
        </div>
        <div
          ref={surfaceRef}
          className="admin-lexical-surface"
          style={{
            '--lexical-page-height': `${pageSize.height}px`,
            '--lexical-page-width': `${pageSize.width}px`,
            minHeight: `${Math.max(pageSize.height, pageSize.height * Math.max(1, estimatedPageCount))}px`,
          }}
        >
          <div className="admin-lexical-page-guide-layer" aria-hidden="true">
            {Array.from({ length: Math.max(0, (Number(estimatedPageCount) || 1) - 1) }, (_, index) => (
              <div
                key={`lexical-page-break-${index + 1}`}
                className="admin-lexical-page-break"
                style={{ top: `${pageSize.height * (index + 1)}px` }}
              >
                <span>Page {index + 2}</span>
              </div>
            ))}
          </div>
          <RichTextPlugin
            contentEditable={<ContentEditable className="admin-lexical-editor" />}
            placeholder={<div className="admin-lexical-placeholder">Mulai tulis materi di sini...</div>}
            ErrorBoundary={LexicalErrorBoundary}
          />
          <HistoryPlugin />
          <ListPlugin />
          <LinkPlugin />
          <TablePlugin />
          <LexicalParagraphTabPlugin />
          <LexicalSelectionMetricsPlugin onSelectionMetricsChange={onSelectionMetricsChange} />
          <LexicalEditorBridge editorRef={bridgeRef} />
          <LexicalInitialHtmlPlugin initialHtml={initialHtml} />
          <OnChangePlugin
            onChange={(editorState, editor) => {
              editorState.read(() => {
                onChange?.({
                  html: $generateHtmlFromNodes(editor, null),
                  json: editorState.toJSON(),
                });
              });
            }}
          />
        </div>
      </div>
    </LexicalComposer>
  );
});

export default LexicalMaterialEditor;
