import React, { useState } from 'react';

const TwilioPhone = () => {
    const [number, setNumber] = useState('');
    const [status, setStatus] = useState('idle'); // idle, calling, success, error
    const [message, setMessage] = useState('');
    const [adminPhone, setAdminPhone] = useState(localStorage.getItem('adminPhone') || '');
    const [showSettings, setShowSettings] = useState(false);

    const makeCall = async () => {
        if (!number) return;

        try {
            setStatus('calling');
            setMessage('Iniciando puente de llamada...');

            const response = await fetch('/api/twilio/llamar-puente', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    numeroDestino: number,
                    numeroAdmin: adminPhone // Opcional, el backend usa el de ENV por defecto
                }),
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Error desconocido');
            }

            setStatus('success');
            setMessage(data.message || 'Llamada conectada a tu celular.');

            // Restablecer después de 5 segundos
            setTimeout(() => {
                setStatus('idle');
                setMessage('');
                setNumber('');
            }, 6000);

        } catch (err) {
            console.error('Error in bridge call:', err);
            setStatus('error');
            setMessage(err.message);
        }
    };

    const handleSaveAdminPhone = (e) => {
        const val = e.target.value;
        setAdminPhone(val);
        localStorage.setItem('adminPhone', val);
    };

    return (
        <div className="twilio-phone bg-slate-800 text-white p-6 rounded-2xl shadow-xl border border-slate-700">
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center space-x-2">
                    <span className="material-icons-outlined text-blue-400">phone_in_talk</span>
                    <h3 className="text-lg font-bold">Marcador Inteligente</h3>
                </div>
                <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="text-slate-400 hover:text-white transition-colors p-1"
                    title="Configurar mi teléfono"
                >
                    <span className="material-icons-outlined text-sm">settings</span>
                </button>
            </div>

            {showSettings && (
                <div className="mb-4 p-4 bg-slate-900 rounded-xl border border-slate-700 text-xs text-slate-300">
                    <label className="block mb-2 font-semibold text-slate-400">Mi Teléfono Receptor (Quien atiende)</label>
                    <input
                        type="tel"
                        placeholder="Ej. +521234567890 (opcional)"
                        value={adminPhone}
                        onChange={handleSaveAdminPhone}
                        className="w-full bg-slate-800 border border-slate-600 p-3 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
                    />
                    <p className="mt-2 text-[10px] text-slate-500">
                        Si lo dejas vacío, Twilio llamará al número de Whatsapp configurado en tu panel.
                    </p>
                </div>
            )}

            <div className="space-y-4">
                <div className="flex flex-col">
                    <label className="text-xs text-slate-400 mb-2 font-medium">Teléfono a marcar (Prospecto)</label>
                    <input
                        type="tel"
                        placeholder="+52..."
                        value={number}
                        onChange={(e) => setNumber(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-600 p-3.5 rounded-xl mb-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono text-sm transition-all"
                        disabled={status === 'calling'}
                    />
                    <button
                        onClick={makeCall}
                        disabled={status === 'calling' || !number.trim()}
                        className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.98] disabled:bg-slate-600 disabled:active:scale-100 py-3.5 rounded-xl font-bold transition-all flex justify-center items-center shadow-lg shadow-blue-900/30 text-sm"
                    >
                        {status === 'calling' ? (
                            <><span className="material-icons-outlined animate-spin mr-2 text-sm">refresh</span> Enlazando...</>
                        ) : (
                            'Llamar Prospecto'
                        )}
                    </button>
                </div>

                {message && (
                    <div className={`p-4 rounded-xl text-xs flex items-start space-x-3 ${status === 'error' ? 'bg-red-500/10 text-red-200 border border-red-500/20' :
                            status === 'success' ? 'bg-emerald-500/10 text-emerald-200 border border-emerald-500/20' :
                                'bg-blue-500/10 text-blue-200 border border-blue-500/20'
                        }`}>
                        <span className="material-icons-outlined text-lg">
                            {status === 'error' ? 'error_outline' : status === 'success' ? 'check_circle' : 'info'}
                        </span>
                        <span className="pt-0.5 leading-relaxed">{message}</span>
                    </div>
                )}
            </div>

            <div className="mt-5 pt-4 border-t border-slate-700/50 text-[10.5px] text-slate-500/80 leading-relaxed">
                El marcador usa <strong>Click-to-Call</strong>. Twilio llamará a tu celular primero, y al contestar, enlazará la llamada al prospecto. No requiere configurar APIs complejas.
            </div>
        </div>
    );
};

export default TwilioPhone;
