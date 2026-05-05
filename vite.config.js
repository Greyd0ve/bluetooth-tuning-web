import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages project sites are usually published at:
// https://<username>.github.io/<repository-name>/
// In GitHub Actions, GITHUB_REPOSITORY is "owner/repository-name", so this
// automatically sets the correct base path for your repository.
// Local dev still runs at http://localhost:5173/.
const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1];
const base = process.env.GITHUB_ACTIONS && repoName ? `/${repoName}/` : './';

export default defineConfig({
  plugins: [react()],
  base,
});
