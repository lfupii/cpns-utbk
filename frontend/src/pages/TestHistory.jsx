import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AccountShell from '../components/AccountShell';
import apiClient from '../api';
import { formatDateTime } from '../utils/date';

function parseScoreDetails(rawValue) {
  if (!rawValue) {
    return null;
  }

  if (typeof rawValue === 'object') {
    return rawValue;
  }

  try {
    const parsed = JSON.parse(rawValue);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (error) {
    return null;
  }
}

export default function TestHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await apiClient.get('/auth/test-history');
        const normalized = (response.data.data || []).map((item) => ({
          ...item,
          score: Number(item.score || 0),
          percentage: Number(item.percentage || 0),
          total_questions: Number(item.total_questions || 0),
          correct_answers: Number(item.correct_answers || 0),
          score_details: parseScoreDetails(item.score_details || item.score_details_json),
        }));
        setHistory(normalized);
      } catch (err) {
        setError(err.response?.data?.message || 'Gagal memuat riwayat test');
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  return (
    <AccountShell
      title="Riwayat Test"
      subtitle="Lihat hasil test yang sudah pernah kamu selesaikan dan buka kembali halaman hasilnya."
    >
      {loading ? (
        <div className="account-card">
          <p>Memuat riwayat test...</p>
        </div>
      ) : error ? (
        <div className="account-card">
          <div className="alert">{error}</div>
        </div>
      ) : history.length === 0 ? (
        <div className="account-card">
          <p className="text-muted">Belum ada riwayat test yang selesai.</p>
        </div>
      ) : (
        <div className="account-card">
          <div className="account-history-list">
            {history.map((item) => (
              <article key={item.attempt_id} className="account-history-item">
                <div>
                  <span className="account-package-tag">{item.category_name}</span>
                  <h2>{item.package_name}</h2>
                  <p>
                    Dikerjakan pada{' '}
                    <strong>
                      {item.end_time
                        ? formatDateTime(item.end_time)
                        : formatDateTime(item.start_time)}
                    </strong>
                  </p>
                </div>

                <div className="account-history-score">
                  {item.score_details?.scoring_type === 'cpns_skd_points' ? (
                    <>
                      <strong>{Number(item.score_details.total_score || item.score).toLocaleString('id-ID')} poin</strong>
                      <span>
                        {item.score_details.passing?.passed_all ? 'Lulus PG' : 'Belum lulus PG'}
                      </span>
                    </>
                  ) : (
                    <>
                      <strong>{item.percentage.toFixed(1)}%</strong>
                      <span>
                        {item.correct_answers}/{item.total_questions} benar
                      </span>
                    </>
                  )}
                </div>

                <div className="account-history-action">
                  <Link to={`/results/${item.attempt_id}`} className="btn btn-outline">
                    Lihat Hasil
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </AccountShell>
  );
}
