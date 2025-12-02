# Contributors Help

## The Workflow

- The user can pick listed company ticker and the workflow proceeds to fetch pdfs of annual reports of the company from nse servers and parses it into text.
- For analysis of the report, the user creates a rules file(currently harcoded) where they mention the respective topics they want to analyse the selected company on.
- For fetching data from the pdf, a py script gives each page a topic name (by trying to find the largest bit of text on the page) and then uses a vector search to fetch the respective pages according to the topic names mentioned in rules.
- With each topic name and relevant content fetched, the same is sent to ai to analyse and summarize each topic info
- This processed data is finally displayed as a mindmap.

### Different components in use

- Frontend:
  - React for frontend logic and shadcn for simple UI.
- Backend:
  - Node.js and Express for API layer
  - Python files for parsing and semantic search

## Solve possible issues while running locally

- Ensure that your frontend runs in the same port as the one mentioned in server.js file (if not change port num in the file)

- Make sure no other processes are running on the port you are supposed to run the program (kill other processes if running)

- If process loads inifnitely make sure to check backend logs! (and if no errors from logs appear but button is still loading then refresh page)

- If loading ends but no output appears on page then check for output files (in backend). If file is created but empty then delete the file and rerun the process.

## PR Guidelines

Make sure to tag the issue number that you are attempting to solve with the PR. Give credits and resources when its due.

## Issues guidelines

Ones that are trying to propose new issue, make sure you explain the problem clearly. Along with any initial solutions. Also attach any screenshots that might explain the error.
