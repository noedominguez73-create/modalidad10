import React, { useState } from 'react';

const CreateVoiceAgent = ({ onBack }) => {
    const [formData, setFormData] = useState({
        nombre: '',
        descripcion: '',
        saludo: '',
        instrucciones: '',
        voz: 'Alloy',
        idioma: 'Español (México)',
        telefono: '+19154654372',
        telefonoActivo: true
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        try {
            const response = await fetch('/api/agentes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (result.success) {
                onBack(); // Regresar a la pantalla anterior si fue exitoso
            } else {
                throw new Error(result.error || 'Fallo interno al crear el agente');
            }
        } catch (err) {
            console.error('Error creando agente:', err);
            setError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 min-h-screen pb-24 font-sans">
            <header className="px-5 py-3 flex items-center justify-between sticky top-0 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-md z-40 border-b border-slate-200 dark:border-slate-800">
                <button
                    onClick={onBack}
                    className="text-blue-600 flex items-center font-medium hover:text-blue-700"
                >
                    <span className="material-icons-outlined">chevron_left</span>
                    <span>Atrás</span>
                </button>
                <h1 className="text-base font-bold">Crear Agente</h1>
                <div className="w-12"></div>
            </header>

            <main className="max-w-md mx-auto px-5 pt-6 space-y-8">
                <section>
                    <h2 className="text-2xl font-bold mb-1">Crear Agente de Voz</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Configura un nuevo agente de IA para atender llamadas telefónicas</p>
                </section>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {error && (
                        <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
                            <span className="material-icons-outlined inline-block align-middle mr-2 text-base">error_outline</span>
                            {error}
                        </div>
                    )}
                    <div className="space-y-2">
                        <div className="flex justify-between items-end">
                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Nombre <span className="text-red-500">*</span></label>
                            <span className="text-[10px] text-slate-500">{formData.nombre.length}/100</span>
                        </div>
                        <input
                            name="nombre"
                            value={formData.nombre}
                            onChange={handleChange}
                            maxLength={100}
                            required
                            className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                            placeholder="Ej: Asistente de Ventas"
                            type="text"
                        />
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between items-end">
                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Descripción <span className="text-slate-400 text-xs">(opcional)</span></label>
                            <span className="text-[10px] text-slate-500">{formData.descripcion.length}/500</span>
                        </div>
                        <textarea
                            name="descripcion"
                            value={formData.descripcion}
                            onChange={handleChange}
                            maxLength={500}
                            className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 resize-none"
                            placeholder="Describe brevemente qué hace este agente..."
                            rows="3"
                        ></textarea>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between items-end">
                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Mensaje de Saludo <span className="text-red-500">*</span></label>
                            <span className="text-[10px] text-slate-500">{formData.saludo.length}/500</span>
                        </div>
                        <textarea
                            name="saludo"
                            value={formData.saludo}
                            onChange={handleChange}
                            maxLength={500}
                            required
                            className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 resize-none"
                            placeholder="Ej: ¡Hola! Gracias por llamar. ¿En qué puedo ayudarte hoy?"
                            rows="3"
                        ></textarea>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 italic">Este mensaje se reproducirá al inicio de cada llamada</p>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between items-end">
                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Instrucciones del Sistema <span className="text-red-500">*</span></label>
                            <span className="text-[10px] text-slate-500">{formData.instrucciones.length}/4000</span>
                        </div>
                        <textarea
                            name="instrucciones"
                            value={formData.instrucciones}
                            onChange={handleChange}
                            maxLength={4000}
                            required
                            className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 resize-none"
                            placeholder="Ej: Eres un asistente de ventas profesional y amable. Tu objetivo es ayudar a los clientes con información sobre nuestros productos..."
                            rows="8"
                        ></textarea>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Define la personalidad, objetivos y comportamiento del agente</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Voz</label>
                            <div className="relative flex items-center">
                                <select
                                    name="voz"
                                    value={formData.voz}
                                    onChange={handleChange}
                                    className="w-full pl-4 pr-10 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl appearance-none focus:ring-2 focus:ring-blue-600 outline-none text-sm z-10 bg-transparent"
                                >
                                    <option value="Alloy">Alloy (Neutral)</option>
                                    <option value="Echo">Echo (Calm)</option>
                                    <option value="Fable">Fable (Storyteller)</option>
                                </select>
                                <span className="material-icons-outlined absolute right-3 text-slate-400 pointer-events-none text-xl z-0">expand_more</span>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Idioma</label>
                            <div className="relative flex items-center">
                                <select
                                    name="idioma"
                                    value={formData.idioma}
                                    onChange={handleChange}
                                    className="w-full pl-4 pr-10 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl appearance-none focus:ring-2 focus:ring-blue-600 outline-none text-sm z-10 bg-transparent"
                                >
                                    <option>Español (México)</option>
                                    <option>English (US)</option>
                                    <option>Português (Brasil)</option>
                                </select>
                                <span className="material-icons-outlined absolute right-3 text-slate-400 pointer-events-none text-xl z-0">expand_more</span>
                            </div>
                        </div>
                    </div>

                    <div className="p-5 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
                        <div className="flex items-center space-x-2 text-blue-600">
                            <span className="material-icons-outlined text-xl">phone_in_talk</span>
                            <h3 className="font-bold text-sm">Asignación de Teléfono</h3>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">Asigna un número de Twilio para que este agente reciba llamadas entrantes</p>

                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Teléfono Asignado <span className="text-[10px] normal-case font-normal">(opcional)</span></label>
                            <input
                                name="telefono"
                                value={formData.telefono}
                                onChange={handleChange}
                                className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all text-sm font-mono"
                                type="tel"
                            />
                            <p className="text-[10px] text-slate-500 italic">Formato internacional con código de país</p>
                        </div>

                        <div className="flex items-center justify-between pt-2">
                            <span className="text-sm font-medium">Teléfono Activo</span>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    name="telefonoActivo"
                                    checked={formData.telefonoActivo}
                                    onChange={handleChange}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-green-500"></div>
                            </label>
                        </div>
                    </div>

                    <div className="flex flex-col space-y-3 pt-6">
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full py-4 bg-blue-600 text-white font-bold rounded-2xl shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                        >
                            {isSubmitting ? (
                                <>
                                    <span className="material-icons-outlined animate-spin mr-2">refresh</span>
                                    Guardando...
                                </>
                            ) : (
                                'Crear Agente'
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={onBack}
                            disabled={isSubmitting}
                            className="w-full py-4 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold rounded-2xl hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Cancelar
                        </button>
                    </div>
                </form>
            </main>
            <style dangerouslySetInnerHTML={{
                __html: `
        .ios-toggle:checked + .ios-toggle-label {
            background-color: #22c55e;
        }
        .ios-toggle:checked + .ios-toggle-label::after {
            transform: translateX(1.25rem);
        }
      `}} />
        </div>
    );
};

export default CreateVoiceAgent;
