# AFL Disposal Edge Engine — V6 Starter

V6 focuses on making screenshot parsing easier to debug and correct.

## What changed from V5
- Added candidate-debug output from the parser
- Shows all likely name/line pairs the server found
- Lets you use the top 5 candidates with one click
- Keeps server-side OCR
- Keeps scoring endpoint
- Easier workflow for fixing OCR misses

## Step-by-step: local use
1. Install Node 18 or newer.
2. Open a terminal in this folder.
3. Run:
   ```bash
   npm install
   ```
4. Start the app:
   ```bash
   npm run dev
   ```
5. Open:
   ```bash
   http://localhost:3000
   ```

## Step-by-step: use the app
1. Upload your screenshot.
2. Click **Upload + OCR + Parse**.
3. Wait for the status to say **Screenshot parsed.**
4. Look at **Candidate debug list**.
5. Click **Use Top 5 Candidates**.
6. Check **Parsed player lines**.
7. Click **Load Parsed Into Editor**.
8. Adjust player roles / risks if needed.
9. Click **Score Players**.
10. Read:
   - Best leg
   - Cut leg
   - Script read
   - Opponent read

## If screenshot parsing still misses
1. Copy the screenshot text manually.
2. Paste into **OCR / pasted text**.
3. Click **Parse Pasted Text**.
4. Use the candidate list the same way.

## Deploy to Render
1. Push this folder to GitHub.
2. Create a new Web Service in Render.
3. Connect the repo.
4. Build command:
   ```bash
   npm install
   ```
5. Start command:
   ```bash
   npm start
   ```

## What V7 should add
- better player dictionary
- previous matchup API
- weather API integration on the backend
- live QT/HT/3QT parsing
- persistent database
