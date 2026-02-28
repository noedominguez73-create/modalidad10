import { readFileSync, writeFileSync } from 'fs';

const file = 'client/src/CRM.jsx';
let text = readFileSync(file, 'utf8');

// Find the first "export default CRM" and keep everything up to and including it
const marker = 'export default CRM';
const idx = text.indexOf(marker);
if (idx !== -1) {
    text = text.substring(0, idx + marker.length) + '\n';
    writeFileSync(file, text, 'utf8');
    console.log('SUCCESS: Truncated at first "export default CRM"');
    console.log(`File size: ${text.length} chars`);
} else {
    console.log('ERROR: marker not found');
}
