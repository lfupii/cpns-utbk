import React, { useEffect, useMemo, useState } from 'react';
import { isMaterialPdfVisualHtml, paginateMaterialHtml } from '../utils/materialPagination';

const PAGE_DIMENSIONS = {
  portrait: { width: 794, height: 1123 },
  landscape: { width: 1123, height: 794 },
};

export default function LexicalPaginatedPreview({
  html,
  orientation = 'portrait',
  onPageCountChange,
}) {
  const [pages, setPages] = useState(['<p><br></p>']);
  const pageSize = useMemo(
    () => PAGE_DIMENSIONS[orientation] || PAGE_DIMENSIONS.portrait,
    [orientation]
  );
  const pageEntries = useMemo(
    () => pages.map((pageHtml) => ({
      html: pageHtml,
      isPdfVisualPage: isMaterialPdfVisualHtml(pageHtml),
    })),
    [pages]
  );

  useEffect(() => {
    const nextPages = paginateMaterialHtml(html, { orientation });
    setPages(nextPages);
    onPageCountChange?.(nextPages.length);
  }, [html, onPageCountChange, orientation]);

  return (
    <div className="admin-lexical-preview-root">
      <div className="admin-lexical-preview-copy">
        <span>Preview A4</span>
        <strong>{pages.length} halaman tersusun dari state Lexical aktif</strong>
        <p>
          Pratinjau ini read-only dan dihitung dari HTML editor saat ini, jadi pagination tidak lagi bergantung
          pada DOM editable per halaman.
        </p>
      </div>

      <div className="admin-lexical-preview-stack">
        {pageEntries.map((pageEntry, pageIndex) => (
          <section
            key={`lexical-preview-page-${pageIndex}`}
            className={pageEntry.isPdfVisualPage ? 'admin-lexical-preview-page admin-lexical-preview-page-pdf-visual' : 'admin-lexical-preview-page'}
            style={{ maxWidth: `${pageSize.width}px`, minHeight: `${pageSize.height}px`, height: `${pageSize.height}px` }}
          >
            <div className="admin-lexical-preview-page-header">
              <span className="admin-lexical-preview-page-label">Halaman {pageIndex + 1}</span>
              <div className="admin-lexical-preview-page-brand" aria-hidden="true">
                <img className="admin-lexical-preview-page-logo" src="/ujiin-logo.png" alt="Ujiin" />
              </div>
            </div>
            <div
              className="admin-lexical-preview-page-body learning-rich-content"
              dangerouslySetInnerHTML={{ __html: pageEntry.html }}
            />
          </section>
        ))}
      </div>
    </div>
  );
}
