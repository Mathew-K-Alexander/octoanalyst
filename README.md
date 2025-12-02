# OctoAnalyst

An AI engine for deeply analyzing stock entities listed on NSE. Tranditional LLMs give generic analysis and more often without the relevant context. This project aims to use relevant data and custom set of rules for accurate research.

This project is written in Javascript and Python along with libraries such as React and Node.js!

Make sure you check out [contribution help](https://github.com/acmpesuecc/octoanalyst/CONTRIBUTING.md) for better understanding. This will also help **_address common issues that you could face_** while running locally.

## Installation

```bash
git clone https://github.com/acmpesuecc/octoanalyst.git
cd octoanalyst
```

For frontend:

```bash
cd frontend
npm install   #installs packages
npm run dev   #runs the frontend
```

For backend:

- Install packages
  ```bash
  cd backend
  npm install
  ```
- Create .env file in the backend dir with following details(fill them by creating your own api keys)
  ```dotenv
   GEMINI_API_KEY=
   OPENROUTER_API_KEY=
  ```
- Create a venv for running the python scripts

  - Using uv

    ```bash
    uv venv
    source .venv/bin/activate
    uv pip install -r requirements.txt
    huggingface-cli download sentence-transformers/all-MiniLM-L6-v2   --local-dir ./models/all-MiniLM-L6-v2
    ```

  - If you dont have uv installed, you could use pip to create the venv as well.

## Preview

<img width="1919" height="959" alt="image" src="https://github.com/user-attachments/assets/aec5f56f-8a04-42e7-9c61-de3b91040ca0" />

### License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for more details.
