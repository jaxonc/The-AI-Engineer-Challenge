# Merge Instructions for PDF RAG Feature

## Feature Summary
This branch (`feature/pdf-rag-system`) implements a complete PDF RAG system allowing users to upload PDFs, index them using embeddings, and chat with their content using AI.

## Changes Made
- **Backend (FastAPI)**: New endpoints for PDF upload, indexing, chat, and management
- **Frontend (Next.js)**: Dual-mode interface supporting both regular chat and PDF RAG
- **Dependencies**: Added PyPDF2, python-dotenv, numpy, python-multipart
- **Integration**: Full aimakerspace library integration for text processing and vector search

## Method 1: GitHub Pull Request (Recommended)

### Step 1: Push Feature Branch
```bash
git push -u origin feature/pdf-rag-system
```

### Step 2: Create Pull Request
1. Navigate to GitHub repository
2. Click "Compare & pull request"
3. Set base: `main`, compare: `feature/pdf-rag-system`
4. Title: "Add PDF RAG system with aimakerspace integration"
5. Add description of changes and testing notes
6. Create pull request

### Step 3: Review and Merge
1. Wait for code review approval
2. Ensure all checks pass
3. Click "Merge pull request"
4. Choose "Create a merge commit" (preserves feature history)
5. Delete feature branch when prompted

### Step 4: Cleanup Locally
```bash
git checkout main
git pull origin main
git branch -d feature/pdf-rag-system
git remote prune origin
```

## Method 2: GitHub CLI

### Create PR with CLI
```bash
gh pr create \
  --title "Add PDF RAG system with aimakerspace integration" \
  --body "Implements comprehensive PDF RAG functionality with upload, indexing, and semantic chat"
```

### Review and Merge
```bash
# View PR status
gh pr view

# Merge with merge commit
gh pr merge --merge --delete-branch
```

### Cleanup
```bash
git checkout main
git pull origin main
```

## Post-Merge Deployment

### Backend
```bash
cd api
pip install -r requirements.txt
uvicorn app:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Testing Checklist
- [ ] PDF upload functionality works
- [ ] PDF indexing completes successfully
- [ ] RAG chat provides relevant responses
- [ ] Regular chat mode still functions
- [ ] Error handling works for invalid files
- [ ] API endpoints respond correctly
- [ ] Frontend UI displays properly

## Troubleshooting
- **Import errors**: Ensure aimakerspace modules are in Python path
- **PDF processing fails**: Check PyPDF2 installation
- **Embedding errors**: Verify OpenAI API key is valid
- **Vector search issues**: Ensure numpy is properly installed

## Post-Merge Deployment Notes

After merging to main, ensure:

1. **Backend deployment**: 
   - Install new dependencies: `pip install -r api/requirements.txt`
   - Restart FastAPI server
   - Verify all new endpoints are accessible

2. **Frontend deployment**:
   - Install any new dependencies: `npm install` (if package.json changed)
   - Build and deploy frontend
   - Test PDF upload functionality in production

3. **Environment Variables**:
   - Ensure `OPENAI_API_KEY` is set in production environment
   - Verify `FASTAPI_URL` is correctly configured for frontend

## Rollback Plan

If issues are discovered after merge:

```bash
# Find the merge commit hash
git log --oneline --grep="pdf-rag"

# Create a revert commit
git revert -m 1 <merge-commit-hash>
git push origin main
```

Or create a hotfix branch:

```bash
git checkout -b hotfix/pdf-rag-issues
# Make fixes
git push -u origin hotfix/pdf-rag-issues
# Create PR as above
```

---

**Note**: This is a significant feature addition. Consider deploying to a staging environment first and conducting thorough testing before merging to production main branch. 