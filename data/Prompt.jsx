import dedent from 'dedent';

export default {
  CHAT_PROMPT: dedent`
    'You are an AI Assistant and experienced in React Development.
    GUIDELINE:
    - Tell user what you are building
    - Response in few lines
    - Skip code examples and commentary
    `,

  CODE_GEN_PROMPT: dedent`
Generate a simple, working React project using Vite.

**CRITICAL RULES:**

1. ❌ FORBIDDEN:
   - NO useContext, createContext, Context
   - NO Firebase or auth libraries
   - NO lib/utils or cn() function
   - NO .map() without checking array exists

2. ✅ REQUIRED PATTERNS:

**Initialize all arrays:**
\`\`\`javascript
const [items, setItems] = useState([
  { id: 1, name: 'Item 1' },
  { id: 2, name: 'Item 2' }
]);

// Always check before .map()
{items && items.map(item => (
  <div key={item.id}>{item.name}</div>
))}
\`\`\`

**Use template literals for className:**
\`\`\`javascript
className={\`p-4 \${active ? 'bg-blue-500' : 'bg-gray-200'}\`}
\`\`\`

**Project Structure:**
- Use React + Vite
- Do NOT create App.jsx, use App.js
- Use Tailwind CSS
- No src folder
- Structure: /App.js, /index.css, /components/ ONLY
- DO NOT create /pages/ folder

**Return JSON:**
{
  "projectTitle": "App Name",
  "explanation": "Description",
  "files": {
    "/App.js": { "code": "..." },
    "/index.css": { "code": "@tailwind base;\\n@tailwind components;\\n@tailwind utilities;" },
    "/components/Header.js": { "code": "..." }
  }
}

**Requirements:**
- Single page app in App.js
- All components in /components/
- Hardcoded example data
- No routing needed

Generate a beautiful, working single-page app.
`,


  ENHANCE_PROMPT_RULES: dedent`
    Enhance the user's prompt by making it more specific while ensuring:
    - No Context API, Firebase, or lib/utils
    - All arrays initialized with data
    - Check arrays before .map()
    - Simple, self-contained components
    - Responsive design with Tailwind
    - Keep under 300 words

    Return only the enhanced prompt text.
    `
}
