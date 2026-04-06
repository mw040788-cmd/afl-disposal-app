# AFL Disposal Edge Engine — V7 Starter

V7 fixes:
1. Literal \n text showing in fields
2. Manual-feeling flow after upload

## What changed
- Candidate debug list now shows real new lines
- Parsed player lines now show real new lines
- Upload + OCR now automatically:
  - fills OCR text
  - fills matchup / venue if found
  - fills candidates
  - fills parsed players
  - loads parsed players into editor
  - scores players

## Update Render
Push these files to the same GitHub repo and Render should auto-deploy.
If not, use Manual Deploy.
