// fix-encoding.cjs - Replace garbled emoji text with clean text alternatives
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'client', 'src', 'CRM.jsx');
let text = fs.readFileSync(file, 'utf8');

// Remove BOM
if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1);
    console.log('Removed BOM');
}

// Strategy: Replace garbled emoji sequences in the navigation buttons
// with simple text labels. These appear as multi-byte mojibake.
// We target the known button text patterns.

const navReplacements = [
    // Nav buttons - replace garbled emoji + label with clean emoji + label  
    [/[^\n]*Dashboard\s*\n/g, (m) => m.replace(/^(\s*).*Dashboard/, '$1          \u{1F4CA} Dashboard')],
    [/[^\n]*Prospectos\s*\n/g, (m) => m.replace(/^(\s*).*Prospectos/, '$1          \u{1F465} Prospectos')],
    [/[^\n]*Clientes\s*\n/g, (m) => m.replace(/^(\s*).*Clientes/, '$1          \u{1F9D1}\u200D\u{1F4BC} Clientes')],
    [/[^\n]*Pagos\s*\n/g, (m) => {
        // Only replace the nav button, not other "Pagos" text
        if (m.includes('cambiarVista') || m.trim().match(/^[^\w]*Pagos\s*$/)) return m;
        return m.replace(/^(\s*).*Pagos/, '$1          \u{1F4B0} Pagos');
    }],
    [/[^\n]*Historial\s*\n/g, (m) => m.replace(/^(\s*).*Historial/, '$1          \u{1F4DC} Historial')],
    [/[^\n]*Notificaciones\s*\n/g, (m) => m.replace(/^(\s*).*Notificaciones/, '$1          \u{1F4F1} Notificaciones')],
    [/[^\n]*Llamadas\s*\n/g, (m) => m.replace(/^(\s*).*Llamadas/, '$1          \u{1F4DE} Llamadas')],
];

// Actually, the simplest approach is to just read line by line and fix the specific nav button lines.
const lines = text.split('\n');
let fixCount = 0;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Fix navigation buttons (lines between <button> tags)
    if (trimmed.endsWith('Dashboard') && !trimmed.startsWith('<') && !trimmed.startsWith('//')) {
        lines[i] = '          \u{1F4CA} Dashboard';
        fixCount++;
    }
    else if (trimmed.endsWith('Prospectos') && !trimmed.startsWith('<') && !trimmed.startsWith('//')) {
        lines[i] = '          \u{1F465} Prospectos';
        fixCount++;
    }
    else if (trimmed.endsWith('Clientes') && !trimmed.startsWith('<') && !trimmed.startsWith('//') && !trimmed.includes('=')) {
        lines[i] = '          \u{1F9D1}\u200D\u{1F4BC} Clientes';
        fixCount++;
    }
    else if (trimmed === 'Pagos' || (trimmed.endsWith('Pagos') && !trimmed.startsWith('<') && !trimmed.startsWith('//') && !trimmed.includes('=') && !trimmed.includes('{') && !trimmed.includes('>'))) {
        // Only fix if it's a standalone line
        if (!line.includes('cambiarVista') && !line.includes('className') && !line.includes('<h')) {
            lines[i] = '          \u{1F4B0} Pagos';
            fixCount++;
        }
    }
    else if (trimmed.endsWith('Historial') && !trimmed.startsWith('<') && !trimmed.startsWith('//') && !trimmed.includes('=')) {
        lines[i] = '          \u{1F4DC} Historial';
        fixCount++;
    }
    else if (trimmed.endsWith('Notificaciones') && !trimmed.startsWith('<') && !trimmed.startsWith('//')) {
        lines[i] = '          \u{1F4F1} Notificaciones';
        fixCount++;
    }
    else if (trimmed.endsWith('Llamadas') && !trimmed.startsWith('<') && !trimmed.startsWith('//') && !trimmed.includes('=')) {
        lines[i] = '          \u{1F4DE} Llamadas';
        fixCount++;
    }
    else if (trimmed.endsWith('WhatsApp') && !trimmed.startsWith('<') && !trimmed.startsWith('//') && !trimmed.includes('=')) {
        lines[i] = '          \u{1F4AC} WhatsApp';
        fixCount++;
    }
    else if (trimmed.endsWith('Telegram') && !trimmed.startsWith('<') && !trimmed.startsWith('//') && !trimmed.includes('=')) {
        lines[i] = '          \u2708\uFE0F Telegram';
        fixCount++;
    }

    // Fix dashboard section titles - look for lines with garbled chars followed by known text
    if (trimmed.endsWith('Dashboard CRM') && !trimmed.startsWith('<') && !trimmed.startsWith('//')) {
        lines[i] = '        \u{1F4CA} Dashboard CRM';
        fixCount++;
    }
    if (trimmed.endsWith('Resumen del Mes') && !trimmed.startsWith('<')) {
        lines[i] = '          \u{1F4C8} Resumen del Mes';
        fixCount++;
    }
    if (trimmed.endsWith('Prospectos por Estatus') && !trimmed.startsWith('<')) {
        lines[i] = '          \u{1F465} Prospectos por Estatus';
        fixCount++;
    }
    if (trimmed.endsWith('Clientes por Modalidad') && !trimmed.startsWith('<')) {
        lines[i] = '          \u{1F4CB} Clientes por Modalidad';
        fixCount++;
    }
    if (trimmed.endsWith('Pagos por Metodo') && !trimmed.startsWith('<')) {
        lines[i] = '          \u{1F4B3} Pagos por Metodo';
        fixCount++;
    }
    if (trimmed.endsWith('Acciones Rapidas') && !trimmed.startsWith('<')) {
        lines[i] = '          \u26A1 Acciones Rapidas';
        fixCount++;
    }
}

text = lines.join('\n');
fs.writeFileSync(file, text, 'utf8');
console.log(`Fixed ${fixCount} lines with garbled emojis`);
