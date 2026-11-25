# LangLearn
A multilingual language-learning application built with React and Vite. Includes an AI tutor, translation, vocabulary, grammar, quizzes, conversations, mistake tracking, revision and Prompt Lab. Real progress is saved locally. Light/dark preference is persistent.

## Run on Windows
1. Extract the project and open `language-learning-tutor` in VS Code.
2. Run `npm install`.
3. Run `copy .env.example .env` in CMD and paste your existing Groq key into `.env`. If your working Groq configuration uses another model, copy that model value too.
4. Run `npm run dev` and open the displayed URL (usually http://localhost:5173).
5. Settings > Test AI connection checks live generation. The status indicator only indicates configuration.

No Ollama download is necessary. Keep `.env` private; it is excluded by `.gitignore`. Offline practice remains available where supported, but arbitrary translation and open-ended tutoring require an AI provider. Real progress is stored under the original browser storage key for compatibility; legacy flagged sample records are removed automatically. No sample data or artificial clock controls are exposed.

The Vite middleware provides the local AI proxy for dev and preview. A production static hosting deployment needs an equivalent server endpoint; do not embed the API key in frontend code.
