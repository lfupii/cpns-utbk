export function formatQuestionReportAssessmentType(value) {
  return value === 'mini_test' ? 'Mini Test' : 'Tryout';
}

export function formatQuestionReportTargetLabel(value) {
  return value === 'explanation' ? 'Pembahasan' : 'Soal';
}

export function formatQuestionReportOriginLabel(value) {
  switch (value) {
    case 'mini_test_active':
      return 'Mini test aktif';
    case 'tryout_review':
      return 'Review tryout';
    case 'mini_test_review':
      return 'Review mini test';
    case 'tryout_active':
    default:
      return 'Tryout aktif';
  }
}

export function formatQuestionReportStatusLabel(value) {
  switch (value) {
    case 'reviewed':
      return 'Ditinjau';
    case 'resolved':
      return 'Selesai';
    case 'open':
    default:
      return 'Baru';
  }
}

export function truncateQuestionReportText(value, maxLength = 180) {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}
