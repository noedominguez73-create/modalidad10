// fix-all-emojis.cjs - Fix ALL garbled emoji byte sequences in CRM.jsx
// Strategy: search for known garbled UTF-8 mojibake patterns and replace with real Unicode
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'client', 'src', 'CRM.jsx');
let text = fs.readFileSync(file, 'utf8');

// Remove BOM
if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1);
}

// All garbled -> correct mappings
// These are the byte patterns that result from double-encoding UTF-8
const map = {
    // Common emojis used in this CRM
    '\u00c3\u00b1': '\u00f1',  // ñ
    '\u00c3\u00a1': '\u00e1',  // á
    '\u00c3\u00a9': '\u00e9',  // é
    '\u00c3\u00ad': '\u00ed',  // í
    '\u00c3\u00b3': '\u00f3',  // ó
    '\u00c3\u00ba': '\u00fa',  // ú
    '\u00c3\u00bc': '\u00fc',  // ü
    '\u00c2\u00bf': '\u00bf',  // ¿
    '\u00c2\u00a1': '\u00a1',  // ¡

    // 4-byte emoji patterns (F0 9F xx xx)
    '\u00c3\u00b0\u00c2\u009f\u00c2\u0093\u00c2\u008a': '\u{1F4CA}', // 📊
    '\u00c3\u00b0\u00c2\u009f\u00c2\u0091\u00c2\u00a5': '\u{1F465}', // 👥
    '\u00c3\u00b0\u00c2\u009f\u00c2\u0091\u00c2\u00b0': '\u{1F4B0}', // 💰 (wrong - this is actually different)
    '\u00c3\u00b0\u00c2\u009f\u00c2\u0093\u00c2\u009c': '\u{1F4DC}', // 📜
    '\u00c3\u00b0\u00c2\u009f\u00c2\u0093\u00c2\u00b1': '\u{1F4F1}', // 📱
    '\u00c3\u00b0\u00c2\u009f\u00c2\u0093\u00c2\u009e': '\u{1F4DE}', // 📞
    '\u00c3\u00b0\u00c2\u009f\u00c2\u0091\u00c2\u00ac': '\u{1F4AC}', // 💬 (wrong)
    '\u00c3\u00b0\u00c2\u009f\u00c2\u0093\u00c2\u0088': '\u{1F4C8}', // 📈
    '\u00c3\u00b0\u00c2\u009f\u00c2\u0091\u00c2\u00b3': '\u{1F4B3}', // 💳 (wrong)
};

// Simpler approach: just do string replacements for known garbled patterns
// The garbled text appears as specific byte sequences that we can match as strings
const replacements = [
    // Emojis in the file - these are the EXACT garbled strings found
    ['ðŸ"Š', '\u{1F4CA}'],  // 📊 
    ['ðŸ'¥', '\u{ 1F465 }'],  // 👥
    ['ðŸ§'â€ðŸ'¼', '\u{1F9D1}\u200D\u{1F4BC}'],  // 🧑‍💼
    ['ðŸ'°', '\u{ 1F4B0 }'],  // 💰
    ['ðŸ"œ', '\u{1F4DC}'],  // 📜
        ['ðŸ"±', '\u{1F4F1}'],  // 📱
        ['ðŸ"ž', '\u{1F4DE}'],  // 📞
        ['ðŸ'¬', '\u{ 1F4AC }'],  // 💬
        ['ðŸ"ˆ', '\u{1F4C8}'],  // 📈
            ['ðŸ'³', '\u{ 1F4B3 }'],  // 💳
            ['â³', '\u23F3'],        // ⏳
                ['ðŸ'µ', '\u{ 1F4B5 }'],  // 💵
                ['ðŸ"', '\u{1F4CD}'],   // 📍 (check)
                    ['â„¹ï¸', '\u2139\uFE0F'],  // ℹ️
                    ['âš¡', '\u26A1'],       // ⚡
                    ['ðŸ—"', '\u{1F5D3}'],  // 🗓
                    ['ðŸ§®', '\u{1F9EE}'],  // 🧮
                    ['ðŸ"§', '\u{1F4E7}'],  // 📧
                    ['ðŸŽ¯', '\u{1F3AF}'],  // 🎯
                    ['ðŸ"Ž', '\u{1F50E}'],  // 🔎
                    ['âš ï¸', '\u26A0\uFE0F'],  // ⚠️
                    ['ðŸ"¥', '\u{1F525}'],  // 🔥
                    ['ðŸ†—', '\u{1F197}'],  // 🆗
                    ['ðŸ"', '\u{1F4DD}'],   // 📝
                    ['ðŸ¤–', '\u{1F916}'],  // 🤖
                    ['ðŸ'¤', '\u{ 1F464 }'],  // 👤
                    ['ðŸ'‰', '\u{ 1F449 }'],  // 👉
                        ['ðŸ"…', '\u{1F4C5}'],  // 📅
                        ['ðŸ"', '\u{1F512}'],   // 🔒
                        ['ðŸ†•', '\u{1F195}'],  // 🆕
                        ['ðŸ"²', '\u{1F4F2}'],  // 📲
                        ['ðŸ"Œ', '\u{1F4CC}'],  // 📌
                        ['ðŸš€', '\u{1F680}'],  // 🚀
                        ['ðŸ'¼', '\u{ 1F4BC }'],  // 💼
                        ['ðŸ"‹', '\u{1F4CB}'],  // 📋
                            ['ðŸ'', '\u{ 1F4DD }'],   // 📝 (variant)
                            ['ðŸ"', '\u{1F4D7}'],   // 📗 (variant)
                                ['ðŸ'', '\u{ 1F4CD }'],   // (variant)
                                ['âœˆï¸', '\u2708\uFE0F'],  // ✈️
                                    ['âœ…', '\u2705'],       // ✅
                                    ['âœ"', '\u2714'],       // ✔
                                    ['âš™', '\u2699'],       // ⚙
                                    ['â˜Žï¸', '\u260E\uFE0F'],  // ☎️

                                    // Accented characters (double-encoded)
                                    ['Ã¡', '\u00e1'], // á
                                    ['Ã©', '\u00e9'], // é
                                    ['Ã­', '\u00ed'], // í
                                    ['Ã³', '\u00f3'], // ó
                                    ['Ãº', '\u00fa'], // ú
                                    ['Ã±', '\u00f1'], // ñ
                                    ['Ã¼', '\u00fc'], // ü
                                    ['Ã‰', '\u00c9'], // É
                                    ['Â¿', '\u00bf'], // ¿
                                    ['Â¡', '\u00a1'], // ¡
                                    ['â€œ', '\u201C'], // "
                                    ['â€\u009d', '\u201D'], // "
                                    ['â€"', '\u2014'], // —
                                    ['â€"', '\u2013'], // –
                                ];

let totalFixed = 0;
for (const [garbled, correct] of replacements) {
    let count = 0;
    while (text.includes(garbled)) {
        text = text.replace(garbled, correct);
        count++;
    }
    if (count > 0) {
        console.log(`  ${correct} <- "${garbled.substring(0, 10)}..." (${count}x)`);
        totalFixed += count;
    }
}

fs.writeFileSync(file, text, 'utf8');
console.log(`\nTotal replacements: ${totalFixed}`);
