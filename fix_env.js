const fs = require('fs');
const content = `VITE_GROQ_API_KEY=gsk_3jL2bC57x6Y4j6y4j6y4j6y4j6y4j6y4j6y4j6y4j6y4
VITE_OPENROUTER_API_KEY=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,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,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,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,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,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
VITE_GEMINI_API_KEY=AIzaSyC4BES8McHt8RqfgpXU3Hd8hf6pxiIp5XYs`;
fs.writeFileSync('.env.local', content, { encoding: 'utf8' });
console.log('.env.local updated successfully');
