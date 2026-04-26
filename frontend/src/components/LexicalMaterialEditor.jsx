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
const FONT_SIZE_OPTIONS = ['12px', '14px', '16px', '20px', '28px', '36px'];
const LINE_HEIGHT_OPTIONS = [
  { value: '1.4', label: 'Rapat' },
  { value: '1.75', label: 'Normal' },
  { value: '2', label: 'Longgar' },
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

function MaterialImageComponent({ src, layout = 'center' }) {
  return (
    <figure
      className={`material-image-frame material-image-wrap-${layout}`}
      style={{
        '--image-width': '320px',
        '--image-margin-top': '16px',
        '--image-margin-bottom': '16px',
      }}
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
    return <MaterialImageComponent src={this.__src} layout={this.__layout} />;
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
  });

  const updateToolbar = useCallback(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) {
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
    </div>
  );
}

const LexicalMaterialEditor = forwardRef(function LexicalMaterialEditor({
  documentKey,
  initialHtml,
  onChange,
  onSelectionMetricsChange,
}, ref) {
  const bridgeRef = useRef(null);
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

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="admin-lexical-shell">
        <LexicalToolbarPlugin />
        <div className="admin-lexical-surface">
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
