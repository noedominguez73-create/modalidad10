import React, { useState, useEffect, useRef } from 'react';
import { Device } from '@twilio/voice-sdk';

const TwilioPhone = ({ identity }) => {
    const [device, setDevice] = useState(null);
    const [call, setCall] = useState(null);
    const [status, setStatus] = useState('offline');
    const [number, setNumber] = useState('');
    const [isMuted, setIsMuted] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        initTwilio();
        return () => {
            if (device) {
                device.destroy();
            }
        };
    }, [identity]);

    const initTwilio = async () => {
        try {
            setStatus('initializing');
            const response = await fetch(`/api/twilio/token?identity=${identity}`);
            const data = await response.json();

            if (!data.success) throw new Error(data.error);

            const newDevice = new Device(data.token, {
                codecPreferences: ['opus', 'pcmu'],
                fakeLocalAudioStats: true,
                enableIceRestart: true,
            });

            newDevice.on('registered', () => {
                setStatus('ready');
                console.log('✓ Twilio Device Registered');
            });

            newDevice.on('error', (twError) => {
                console.error('Twilio Device Error:', twError);
                setError(twError.message);
                setStatus('error');
            });

            newDevice.on('incoming', (incomingCall) => {
                setCall(incomingCall);
                setStatus('ringing');

                incomingCall.on('disconnect', () => {
                    setCall(null);
                    setStatus('ready');
                });
            });

            await newDevice.register();
            setDevice(newDevice);

        } catch (err) {
            console.error('Error initializing Twilio:', err);
            setError(err.message);
            setStatus('error');
        }
    };

    const makeCall = async () => {
        if (!device || !number) return;

        try {
            const params = { To: number };
            const outgoingCall = await device.connect({ params });

            setCall(outgoingCall);
            setStatus('busy');

            outgoingCall.on('accept', () => setStatus('on-call'));
            outgoingCall.on('disconnect', () => {
                setCall(null);
                setStatus('ready');
            });

            outgoingCall.on('error', (err) => {
                console.error('Call Error:', err);
                setError(err.message);
                setCall(null);
                setStatus('ready');
            });

        } catch (err) {
            setError(err.message);
        }
    };

    const hangup = () => {
        if (call) {
            call.disconnect();
        }
    };

    const toggleMute = () => {
        if (call) {
            const newMute = !isMuted;
            call.mute(newMute);
            setIsMuted(newMute);
        }
    };

    const acceptCall = () => {
        if (call) {
            call.accept();
            setStatus('on-call');
        }
    };

    return (
        <div className="twilio-phone bg-gray-800 text-white p-4 rounded-lg shadow-xl border border-gray-700">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">Teléfono Web</h3>
                <span className={`px-2 py-1 rounded text-xs ${status === 'ready' ? 'bg-green-600' :
                        status === 'ringing' ? 'bg-yellow-500 animate-pulse' :
                            status === 'on-call' ? 'bg-blue-600' : 'bg-red-600'
                    }`}>
                    {status.toUpperCase()}
                </span>
            </div>

            {error && (
                <div className="bg-red-900/50 text-red-200 p-2 rounded mb-3 text-xs border border-red-800">
                    Error: {error}
                </div>
            )}

            <div className="space-y-4">
                {status === 'ringing' ? (
                    <div className="flex flex-col items-center">
                        <p className="mb-3 animate-bounce">Llamada entrante...</p>
                        <div className="flex gap-3">
                            <button onClick={acceptCall} className="bg-green-600 hover:bg-green-700 p-3 rounded-full">
                                📞 Contestar
                            </button>
                            <button onClick={hangup} className="bg-red-600 hover:bg-red-700 p-3 rounded-full">
                                ❌ Rechazar
                            </button>
                        </div>
                    </div>
                ) : status === 'on-call' || status === 'busy' ? (
                    <div className="flex flex-col items-center">
                        <p className="text-xl mb-4 font-mono">{number || 'En llamada'}</p>
                        <div className="flex gap-4">
                            <button
                                onClick={toggleMute}
                                className={`p-3 rounded-full ${isMuted ? 'bg-yellow-600' : 'bg-gray-600'}`}
                            >
                                {isMuted ? '🎤 Unmute' : '🔇 Mute'}
                            </button>
                            <button onClick={hangup} className="bg-red-600 hover:bg-red-700 p-3 rounded-full">
                                🛑 Colgar
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col">
                        <input
                            type="text"
                            placeholder="+52..."
                            value={number}
                            onChange={(e) => setNumber(e.target.value)}
                            className="bg-gray-700 border border-gray-600 p-2 rounded mb-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                            onClick={makeCall}
                            disabled={status !== 'ready' || !number}
                            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 p-2 rounded font-bold transition-colors"
                        >
                            Llamar
                        </button>
                    </div>
                )}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-700 text-[10px] text-gray-400 flex justify-between">
                <span>Identity: {identity}</span>
                <button onClick={initTwilio} className="underline hover:text-white">Reconectar</button>
            </div>
        </div>
    );
};

export default TwilioPhone;
