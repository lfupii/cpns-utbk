import React, { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import apiClient from '../api';

export default function Payment() {
  const { packageId } = useParams();
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const numericPackageId = Number(packageId);
  const [packageData, setPackageData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const isProduction = import.meta.env.VITE_IS_PRODUCTION === 'true';
  const midtransClientKey = import.meta.env.VITE_MIDTRANS_CLIENT_KEY;
  const midtransSnapJsUrl = isProduction
    ? 'https://app.midtrans.com/snap/snap.js'
    : 'https://app.sandbox.midtrans.com/snap/snap.js';

  useEffect(() => {
    const fetchPackageData = async () => {
      if (!Number.isInteger(numericPackageId) || numericPackageId <= 0) {
        setError('Link paket tidak valid. Silakan pilih ulang paket yang tersedia.');
        setLoading(false);
        return;
      }

      try {
        const response = await apiClient.get('/questions/packages');
        const pkg = response.data.data.find((p) => Number(p.id) === numericPackageId);
        if (pkg) {
          setPackageData(pkg);
        } else {
          setError('Paket yang kamu pilih tidak ditemukan atau sudah tidak tersedia.');
        }
      } catch (_err) {
        setError('Gagal memuat data paket');
      } finally {
        setLoading(false);
      }
    };

    fetchPackageData();
  }, [numericPackageId]);

  const handlePayment = async () => {
    setProcessing(true);
    setError('');

    if (!midtransClientKey) {
      setError('Midtrans client key belum dikonfigurasi.');
      setProcessing(false);
      return;
    }

    try {
      const response = await apiClient.post('/payment/create', {
        package_id: numericPackageId
      });

      const snapToken = response.data.data?.snap_token;
      const orderId = response.data.data?.order_id;
      if (!snapToken) {
        setError('Snap token tidak tersedia. Coba ulangi proses pembayaran.');
        return;
      }

      const openSnap = () => {
        if (!window.snap?.pay) {
          setError('Widget pembayaran Midtrans gagal dimuat.');
          return;
        }

        window.snap.pay(snapToken, {
          onSuccess: async (result) => {
            try {
              await apiClient.post('/payment/confirm', {
                order_id: result?.order_id || orderId,
                transaction_id: result?.transaction_id || null,
              });
              console.log('Payment successful:', result);
              window.sessionStorage.setItem(
                'paymentSuccessMessage',
                `Pembayaran untuk paket ${packageData?.name || 'tryout'} berhasil. Akses sudah aktif dan kamu bisa mulai test dari halaman Paket Aktif kapan saja.`
              );
              navigate('/active-packages');
            } catch (confirmError) {
              setError(
                confirmError.response?.data?.message ||
                  'Pembayaran terdeteksi, tapi akses test belum aktif. Silakan tunggu konfirmasi atau cek lagi sebentar.'
              );
            }
          },
          onPending: (result) => {
            setError(
              isProduction
                ? 'Transaksi masih pending. Selesaikan pembayaran lalu cek kembali statusnya.'
                : 'Transaksi sandbox masih pending. Untuk QRIS sandbox, selesaikan lewat QRIS Simulator Midtrans.'
            );
            console.log('Payment pending:', result);
          },
          onError: (result) => {
            setError('Pembayaran gagal. Silakan coba lagi.');
            console.log('Payment error:', result);
          }
        });
      };

      const existingScript = document.querySelector('script[data-midtrans-snap="true"]');
      if (window.snap?.pay) {
        openSnap();
        return;
      }

      if (existingScript) {
        existingScript.addEventListener('load', openSnap, { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = midtransSnapJsUrl;
      script.setAttribute('data-client-key', midtransClientKey);
      script.setAttribute('data-midtrans-snap', 'true');
      script.onload = openSnap;
      script.onerror = () => {
        setError('Script Midtrans gagal dimuat. Periksa koneksi atau konfigurasi sandbox.');
      };
      document.body.appendChild(script);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal membuat transaksi pembayaran');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!packageData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <p className="text-red-600 mb-3 font-semibold">{error || 'Paket tidak ditemukan'}</p>
          <p className="text-gray-600 mb-6">
            Paket mungkin sudah berubah, belum tersedia, atau link yang dibuka tidak lengkap.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button onClick={() => navigate('/#paket')} className="btn-primary">
              Pilih Paket Lagi
            </button>
            <button onClick={() => navigate('/')} className="btn-outline">
              Kembali ke Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8 sm:py-12">
      <div className="container mx-auto max-w-2xl px-4">
        <button
          onClick={() => navigate('/#paket')}
          className="mb-8 text-blue-600 hover:underline"
        >
          ← Kembali ke paket
        </button>

        <div className="card">
          <h1 className="mb-8 text-2xl font-bold sm:text-3xl">{isAdmin ? 'Akses Test Admin' : 'Konfirmasi Pembayaran'}</h1>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
              {error}
            </div>
          )}

          {/* Order Summary */}
          <div className="bg-gray-50 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-bold mb-4">Ringkasan Pesanan</h2>
            <div className="space-y-3 mb-4 pb-4 border-b border-gray-200">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-gray-700">Paket:</span>
                <span className="font-semibold sm:text-right">{packageData.name}</span>
              </div>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-gray-700">Kategori:</span>
                <span className="font-semibold sm:text-right">{packageData.category_name}</span>
              </div>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-gray-700">Jumlah Soal:</span>
                <span className="font-semibold sm:text-right">{packageData.question_count} soal</span>
              </div>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-gray-700">Waktu Test:</span>
                <span className="font-semibold sm:text-right">{packageData.time_limit} menit</span>
              </div>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-gray-700">Percobaan:</span>
                <span className="font-semibold sm:text-right">{packageData.max_attempts}x</span>
              </div>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-gray-700">Akses:</span>
                <span className="font-semibold sm:text-right">{packageData.duration_days} hari</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-lg font-bold">Total Harga:</span>
              <span className="text-2xl font-bold text-green-600 sm:text-3xl sm:text-right">
                Rp {packageData.price.toLocaleString('id-ID')}
              </span>
            </div>
          </div>

          {/* User Info */}
          <div className="bg-blue-50 rounded-lg p-6 mb-8">
            <h2 className="text-lg font-bold mb-4">Data Pembeli</h2>
            <div className="space-y-2">
              <p><span className="text-gray-700">Nama:</span> {user?.full_name}</p>
              <p><span className="text-gray-700">Email:</span> {user?.email}</p>
            </div>
          </div>

          {isAdmin ? (
            <>
              <div className="bg-green-50 rounded-lg p-6 mb-8 border border-green-200 text-green-800">
                <h3 className="font-bold mb-2">Bypass Pembayaran Admin Aktif</h3>
                <p>
                  Role admin bisa langsung mengakses test ini tanpa transaksi pembayaran.
                </p>
              </div>

              <div className="flex flex-col gap-4 sm:flex-row">
                <button
                  onClick={() => navigate('/#paket')}
                  className="flex-1 btn-outline"
                >
                  Kembali
                </button>
                <Link
                  to={`/test/${numericPackageId}`}
                  className="flex-1 btn btn-primary text-center"
                >
                  Mulai Test
                </Link>
              </div>
            </>
          ) : (
            <>
              {/* Payment Methods Info */}
              <div className="bg-yellow-50 rounded-lg p-6 mb-8 border border-yellow-200">
                <h3 className="font-bold mb-2">Metode Pembayaran Tersedia:</h3>
                <ul className="text-sm space-y-1 text-gray-700">
                  <li>✓ Kartu Kredit / Debit</li>
                  <li>✓ Transfer Bank</li>
                  <li>✓ E-Wallet (GoPay, OVO, Dana)</li>
                  <li>✓ QRIS</li>
                </ul>
                {!isProduction && (
                  <p className="mt-4 text-sm text-amber-800">
                    Mode sandbox aktif. Untuk uji coba QRIS, jangan bayar pakai aplikasi QRIS asli.
                    Gunakan QRIS Simulator Midtrans.
                  </p>
                )}
                <p className="mt-4 text-sm text-slate-700">
                  Dengan melanjutkan pembayaran, Anda menyetujui{' '}
                  <Link to="/terms" className="text-blue-600 hover:underline">
                    Syarat &amp; Ketentuan
                  </Link>{' '}
                  ,{' '}
                  <Link to="/terms#privacy-policy" className="text-blue-600 hover:underline">
                    Kebijakan Privasi
                  </Link>{' '}
                  dan{' '}
                  <Link to="/terms#refund-policy" className="text-blue-600 hover:underline">
                    Kebijakan Refund
                  </Link>{' '}
                  yang berlaku untuk produk digital tryout ini.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-4 sm:flex-row">
                <button
                  onClick={() => navigate('/#paket')}
                  className="flex-1 btn-outline"
                >
                  Batal
                </button>
                <button
                  onClick={handlePayment}
                  disabled={processing}
                  className="flex-1 btn-primary disabled:opacity-50"
                >
                  {processing ? 'Processing...' : 'Lanjut ke Pembayaran'}
                </button>
              </div>

              {/* Notice */}
              <div className="mt-8 p-4 bg-blue-100 rounded-lg border border-blue-300 text-sm text-blue-800">
                <p>
                  💡 <strong>Penting:</strong> Setelah pembayaran berhasil, Anda akan mendapatkan akses untuk mengerjakan test ini.
                  Anda hanya bisa mengerjakan {packageData.max_attempts} kali. Untuk test ulang, Anda harus membayar lagi.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
