import { readFileSync } from 'fs';

const buf = readFileSync('client/src/CRM.jsx');
// Find "Dashboard CRM" and show bytes before it
const dashIdx = buf.indexOf(Buffer.from('Dashboard CRM'));
if (dashIdx > 0) {
    const before = buf.slice(dashIdx - 20, dashIdx);
    console.log('Before "Dashboard CRM":');
    console.log('Hex:', before.toString('hex'));
    console.log('UTF8:', before.toString('utf8'));
}

// Find "Prospectos\r\n" in dashboard stat area (line ~734)
const statIdx = buf.indexOf(Buffer.from('stat-icon'));
if (statIdx > 0) {
    const after = buf.slice(statIdx + 10, statIdx + 30);
    console.log('\nAfter first "stat-icon":');
    console.log('Hex:', after.toString('hex'));
    console.log('UTF8:', after.toString('utf8'));
}

// Find the garbled text on line 730 (0-indexed 729)
const lines = buf.toString('utf8').split('\n');
if (lines[729]) {
    const line730buf = Buffer.from(lines[729], 'utf8');
    console.log('\nLine 730 bytes (first 40):');
    console.log('Hex:', line730buf.slice(0, 40).toString('hex'));
}
