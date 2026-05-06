import React, { useEffect, useRef, useState } from 'react';
import apiClient from '../api';
import {
  formatQuestionReportAssessmentType,
  formatQuestionReportTargetLabel,
  truncateQuestionReportText,
} from '../utils/questionReports';

const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024;

export default function QuestionReportModal({
  isOpen,
  onClose,
  onSubmitted,
  assessmentType = 'tryout',
  targetType = 'question',
  originContext = 'tryout_active',
  packageId,
  questionId,
  attemptId = null,
  sectionTestAttemptId = null,
  sectionCode = '',
  sectionLabel = '',
  questionNumber = null,
  questionText = '',
  questionImageUrl = '',
}) {
  const [message, setMessage] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [attachmentPreviewUrl, setAttachmentPreviewUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setMessage('');
    setAttachment(null);
    setSubmitting(false);
    setError('');
    setAttachmentPreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return '';
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [isOpen, questionId, targetType]);

  useEffect(() => () => {
    if (attachmentPreviewUrl) {
      URL.revokeObjectURL(attachmentPreviewUrl);
    }
  }, [attachmentPreviewUrl]);

  if (!isOpen) {
    return null;
  }

  const targetLabel = formatQuestionReportTargetLabel(targetType).toLowerCase();
  const assessmentLabel = formatQuestionReportAssessmentType(assessmentType);
  const trimmedQuestionText = truncateQuestionReportText(questionText, 220);

  const handleFileChange = (event) => {
    const nextFile = event.target.files?.[0] || null;
    setError('');

    if (!nextFile) {
      setAttachment(null);
      setAttachmentPreviewUrl((current) => {
        if (current) {
          URL.revokeObjectURL(current);
        }
        return '';
      });
      return;
    }

    if (!nextFile.type.startsWith('image/')) {
      setAttachment(null);
      setError('Lampiran harus berupa gambar.');
      event.target.value = '';
      return;
    }

    if (nextFile.size > MAX_ATTACHMENT_SIZE) {
      setAttachment(null);
      setError('Ukuran gambar maksimal 5MB.');
      event.target.value = '';
      return;
    }

    const nextPreviewUrl = URL.createObjectURL(nextFile);
    setAttachmentPreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return nextPreviewUrl;
    });
    setAttachment(nextFile);
  };

  const clearAttachment = () => {
    setAttachment(null);
    setAttachmentPreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return '';
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!message.trim() && !attachment) {
      setError('Tulis catatan atau lampirkan gambar sebelum mengirim laporan.');
      return;
    }

    setSubmitting(true);

    try {
      let uploadPayload = null;
      if (attachment) {
        const formData = new FormData();
        formData.append('file', attachment);
        formData.append('context', 'question-report');
        const uploadResponse = await apiClient.post('/reports/media-upload', formData);
        uploadPayload = uploadResponse.data?.data || null;
      }

      const response = await apiClient.post('/reports/question', {
        assessment_type: assessmentType,
        target_type: targetType,
        origin_context: originContext,
        package_id: Number(packageId || 0),
        attempt_id: attemptId ? Number(attemptId) : null,
        section_test_attempt_id: sectionTestAttemptId ? Number(sectionTestAttemptId) : null,
        section_code: sectionCode || '',
        section_label: sectionLabel || '',
        question_id: Number(questionId || 0),
        question_number: questionNumber ? Number(questionNumber) : null,
        message: message.trim(),
        image_url: uploadPayload?.url || '',
        image_path: uploadPayload?.path || '',
      });

      onSubmitted?.(response.data?.message || 'Laporan berhasil dikirim ke admin.');
      onClose?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal mengirim laporan soal.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="question-report-modal-overlay" role="presentation" onClick={() => onClose?.()}>
      <div
        className="question-report-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="question-report-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="question-report-modal-head">
          <div>
            <span className="question-report-modal-eyebrow">
              {assessmentLabel} • {formatQuestionReportTargetLabel(targetType)}
            </span>
            <h3 id="question-report-modal-title">
              Laporkan {targetLabel}
            </h3>
            <p>
              Ceritakan bagian yang keliru, membingungkan, atau perlu dicek ulang admin. Kamu juga bisa melampirkan screenshot.
            </p>
          </div>
          <button
            type="button"
            className="question-report-modal-close"
            onClick={() => onClose?.()}
            aria-label="Tutup form laporan"
          >
            ×
          </button>
        </div>

        <div className="question-report-modal-context">
          <div className="question-report-modal-context-meta">
            <strong>{sectionLabel || 'Bagian soal aktif'}</strong>
            <span>
              {questionNumber ? `Soal ${questionNumber}` : 'Soal aktif'}
              {questionImageUrl && !trimmedQuestionText ? ' • Soal berbasis gambar' : ''}
            </span>
          </div>
          {trimmedQuestionText ? (
            <p>{trimmedQuestionText}</p>
          ) : questionImageUrl ? (
            <p>Soal ini menggunakan gambar, jadi detail konteksnya bisa kamu jelaskan lewat catatan atau screenshot.</p>
          ) : null}
        </div>

        <form className="question-report-modal-form" onSubmit={handleSubmit}>
          <label className="question-report-field">
            <span>Catatan laporan</span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={targetType === 'explanation'
                ? 'Contoh: langkah pembahasan tidak sesuai dengan jawaban yang dipilih, atau rumus yang dipakai keliru.'
                : 'Contoh: opsi benar tidak cocok, soal ambigu, gambar tidak tampil, atau ada typo penting.'}
              rows={6}
            />
          </label>

          <label className="question-report-field">
            <span>Lampiran gambar</span>
            <div className="question-report-upload-row">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleFileChange}
              />
              <small>Maksimal 5MB. Format JPG, PNG, WEBP, atau GIF.</small>
            </div>
          </label>

          {attachmentPreviewUrl && (
            <div className="question-report-upload-preview">
              <img src={attachmentPreviewUrl} alt="Preview lampiran laporan" />
              <button type="button" className="btn btn-outline" onClick={clearAttachment}>
                Hapus Lampiran
              </button>
            </div>
          )}

          {error && <div className="test-feedback test-feedback-error">{error}</div>}

          <div className="question-report-modal-actions">
            <button type="button" className="btn btn-outline" onClick={() => onClose?.()} disabled={submitting}>
              Batal
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Mengirim...' : 'Kirim Laporan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
