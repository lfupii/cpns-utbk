function normalizeText(value, fallback = '-') {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

function slugifyFilePart(value, fallback = 'soal') {
  const normalized = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || fallback;
}

function normalizeOption(option, index) {
  const letter = String(option?.letter || String.fromCharCode(65 + index)).trim() || String.fromCharCode(65 + index);
  const text = String(option?.text || '').trim();
  const imageUrl = String(option?.image_url || '').trim();
  const isCorrect = Boolean(Number(option?.is_correct));

  return {
    letter,
    text,
    imageUrl,
    isCorrect,
  };
}

export function hasQuestionExtractContent(question) {
  if (!question) {
    return false;
  }

  const hasQuestionBody = String(question.question_text || '').trim() !== '' || String(question.question_image_url || '').trim() !== '';
  const hasTopic = String(question.material_topic || '').trim() !== '';
  const hasExplanation = String(question.explanation_notes || '').trim() !== '';
  const hasOptions = Array.isArray(question.options) && question.options.some((option) => (
    String(option?.text || '').trim() !== '' || String(option?.image_url || '').trim() !== ''
  ));

  return hasQuestionBody || hasTopic || hasExplanation || hasOptions;
}

export function buildQuestionExtractText(question, metadata = {}) {
  const sectionName = String(metadata.sectionName || question?.section_name || question?.section_code || '').trim();
  const options = Array.isArray(question?.options) ? question.options.map(normalizeOption) : [];
  const optionLines = options.length > 0
    ? options.flatMap((option, index) => ([
        `${index + 1}. ${option.letter}. ${option.text || '(opsi berbasis gambar)'}`,
        `Penanda jawaban benar: ${option.isCorrect ? 'BENAR' : '-'}`,
        `URL gambar opsi ${option.letter}: ${option.imageUrl || '-'}`,
        '',
      ]))
    : ['- Belum ada opsi jawaban', 'Penanda jawaban benar: -', 'URL gambar opsi: -', ''];

  if (optionLines[optionLines.length - 1] === '') {
    optionLines.pop();
  }

  return [
    'Teks soal:',
    normalizeText(question?.question_text),
    '',
    `Topik materi: ${normalizeText(question?.material_topic)}`,
    sectionName ? `Subtes: ${sectionName}` : null,
    `URL gambar soal: ${normalizeText(question?.question_image_url)}`,
    '',
    'Opsi jawaban:',
    ...optionLines,
    '',
    'Pembahasan/Catatan:',
    normalizeText(question?.explanation_notes),
  ]
    .filter((line) => line !== null)
    .join('\n');
}

export function downloadQuestionExtractFile(question, metadata = {}) {
  if (typeof document === 'undefined' || typeof URL === 'undefined') {
    throw new Error('Download file belum tersedia di perangkat ini.');
  }

  const text = buildQuestionExtractText(question, metadata);
  const filenameParts = [
    slugifyFilePart(metadata.prefix || 'extract-soal', 'extract-soal'),
    metadata.sectionName ? slugifyFilePart(metadata.sectionName, '') : '',
    question?.material_topic ? slugifyFilePart(question.material_topic, '') : '',
    question?.id ? `id-${question.id}` : '',
  ].filter(Boolean);

  const filename = `${filenameParts.join('-') || 'extract-soal'}.txt`;
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(blobUrl);
}
