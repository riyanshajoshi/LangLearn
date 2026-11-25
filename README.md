# \# LangLearn — AI-Powered Language Learning Platform

# 

# LangLearn is a personalised, multilingual language learning platform powered by generative AI and prompt engineering. It provides interactive lessons, contextual translations, vocabulary building, grammar correction and adaptive assessments based on individual learning preferences.

# 

# \## Features

# 

# \- \*\*AI Tutor:\*\* Personalised multilingual learning and interactive conversations.

# \- \*\*Vocabulary Builder:\*\* Word meanings, pronunciation and contextual examples.

# \- \*\*Grammar Assistant:\*\* Sentence correction with structured explanations.

# \- \*\*Smart Translation:\*\* Context-aware multilingual translation.

# \- \*\*Adaptive Quizzes:\*\* Questions tailored to learner proficiency.

# \- \*\*Conversation Simulator:\*\* Practice through real-world scenarios.

# \- \*\*Mistake Analysis:\*\* Identify recurring mistakes and learning weaknesses.

# \- \*\*Smart Revision:\*\* Spaced repetition and personalised revision.

# \- \*\*Prompt Lab:\*\* Explore and evaluate prompt engineering techniques.

# \- \*\*Offline Learning:\*\* Built-in learning resources when AI services are unavailable.

# \- \*\*Dark and Light Modes:\*\* Responsive and accessible user interface.

# \- \*\*Progress Tracking:\*\* Persistent local learning history.

# 

# \## Prompt Engineering Techniques

# 

# \- Role-based prompting

# \- Few-shot prompting

# \- Context-aware prompting

# \- Structured output generation

# \- Prompt templates

# \- Output validation

# \- Adaptive difficulty control

# \- Prompt evaluation and refinement

# 

# \## Technology Stack

# 

# | Technology | Purpose |

# |---|---|

# | React | Frontend interface |

# | Vite | Development and build tooling |

# | JavaScript | Application logic |

# | CSS | Responsive UI and themes |

# | Groq API | AI-generated learning content |

# | Node.js | Server-side AI proxy |

# | Local Storage | Learner preferences and progress |

# 

# \## Installation and Setup

# 

# \### Prerequisites

# 

# \- Node.js and npm

# \- Git

# \- Groq API key

# 

# \### Run Locally

# 

# Install project dependencies:

# 

# ```bash

# npm install

# ```

# 

# Create a `.env` file using `.env.example` and configure your Groq API credentials:

# 

# ```env

# AI\_PROVIDER=groq

# GROQ\_API\_KEY=your\_api\_key\_here

# GROQ\_MODEL=qwen/qwen3.8-27b

# ```

# 

# Obtain an API key from https://console.groq.com/keys.

# 

# Start the development server:

# 

# ```bash

# npm run dev

# ```

# 

# Open http://localhost:5173 in your browser.

# 

# \## Project Structure

# 

# ```text

# LangLearn/

# ├── public/

# ├── server/

# │   └── ai.js

# ├── src/

# │   ├── components/

# │   ├── lib/

# │   ├── App.jsx

# │   ├── Tutor.jsx

# │   ├── Vocabulary.jsx

# │   ├── Grammar.jsx

# │   ├── Translate.jsx

# │   ├── Quiz.jsx

# │   ├── Simulator.jsx

# │   ├── Revision.jsx

# │   └── PromptLab.jsx

# ├── .env.example

# ├── .gitignore

# ├── package.json

# ├── vite.config.js

# └── README.md

# ```

# 

# \## Security and Limitations

# 

# API keys are managed through server-side environment variables and are not committed to the repository.

# 

# AI-generated content depends on provider availability and usage limits. Offline learning supports curated content but does not replace unrestricted AI translation or conversation.

# 

# The application requires a server-side AI proxy for live AI features. Static hosting alone is insufficient.

# 

# \## Academic Project

# 

# Developed as a Prompt Engineering project to demonstrate practical applications of generative AI in personalised education and multilingual learning.

