import React, { useEffect, useMemo, useRef, useState } from 'react';
import { sanitizeMaterialHtml } from '../utils/materialHtml';

const EMPTY_PAGE_HTML = '<p><br></p>';
const DEFAULT_PAGE_WIDTH = 794;
const A4_HEIGHT_RATIO = 297 / 210;

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

export default function LexicalPaginatedPreview({
  html,
  onPageCountChange,
}) {
  const rootRef = useRef(null);
  const measureBodyRef = useRef(null);
  const [pageWidth, setPageWidth] = useState(DEFAULT_PAGE_WIDTH);
  const [pages, setPages] = useState([EMPTY_PAGE_HTML]);
  const sanitizedHtml = useMemo(
    () => sanitizeMaterialHtml(html) || EMPTY_PAGE_HTML,
    [html]
  );

  useEffect(() => {
    const rootNode = rootRef.current;
    if (!rootNode || typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const observer = new ResizeObserver(([entry]) => {
      const nextWidth = Math.max(320, Math.floor(entry.contentRect.width || DEFAULT_PAGE_WIDTH));
      setPageWidth(nextWidth);
    });

    observer.observe(rootNode);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const measureBodyNode = measureBodyRef.current;
    if (!measureBodyNode) {
      return;
    }

    const blocks = normalizePreviewBlocks(sanitizedHtml);
    const nextPages = [];
    let currentPageNodes = [];

    const renderMeasurePage = (nodes) => {
      measureBodyNode.innerHTML = '';
      nodes.forEach((node) => {
        measureBodyNode.appendChild(node.cloneNode(true));
      });
    };

    blocks.forEach((block) => {
      const candidateNodes = [...currentPageNodes, block];
      renderMeasurePage(candidateNodes);

      if (measureBodyNode.scrollHeight > measureBodyNode.clientHeight + 1 && currentPageNodes.length > 0) {
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

    setPages(nextPages);
    onPageCountChange?.(nextPages.length);
  }, [onPageCountChange, pageWidth, sanitizedHtml]);

  const pageHeight = Math.round(pageWidth * A4_HEIGHT_RATIO);

  return (
    <div ref={rootRef} className="admin-lexical-preview-root">
      <div className="admin-lexical-preview-copy">
        <span>Preview A4</span>
        <strong>{pages.length} halaman tersusun dari state Lexical aktif</strong>
        <p>
          Pratinjau ini read-only dan dihitung dari HTML editor saat ini, jadi pagination tidak lagi bergantung
          pada DOM editable per halaman.
        </p>
      </div>

      <div className="admin-lexical-preview-stack">
        {pages.map((pageHtml, pageIndex) => (
          <section
            key={`lexical-preview-page-${pageIndex}`}
            className="admin-lexical-preview-page"
            style={{ maxWidth: `${pageWidth}px`, minHeight: `${pageHeight}px`, height: `${pageHeight}px` }}
          >
            <div className="admin-lexical-preview-page-header">
              <span className="admin-lexical-preview-page-label">Halaman {pageIndex + 1}</span>
              <div className="admin-lexical-preview-page-brand" aria-hidden="true">
                <img className="admin-lexical-preview-page-logo" src="/ujiin-logo.png" alt="Ujiin" />
              </div>
            </div>
            <div
              className="admin-lexical-preview-page-body learning-rich-content"
              dangerouslySetInnerHTML={{ __html: pageHtml }}
            />
          </section>
        ))}
      </div>

      <div className="admin-lexical-preview-measure" aria-hidden="true">
        <section
          className="admin-lexical-preview-page admin-lexical-preview-page-measure"
          style={{ width: `${pageWidth}px`, minHeight: `${pageHeight}px`, height: `${pageHeight}px` }}
        >
          <div className="admin-lexical-preview-page-header">
            <span className="admin-lexical-preview-page-label">Halaman</span>
            <div className="admin-lexical-preview-page-brand">
              <img className="admin-lexical-preview-page-logo" src="/ujiin-logo.png" alt="Ujiin" />
            </div>
          </div>
          <div ref={measureBodyRef} className="admin-lexical-preview-page-body learning-rich-content" />
        </section>
      </div>
    </div>
  );
}
