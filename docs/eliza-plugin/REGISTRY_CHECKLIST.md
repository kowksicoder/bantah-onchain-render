# Eliza Plugin Registry Checklist

This is the operational checklist for getting `@bantah-protocol/plugin-bantah` into the Eliza plugin ecosystem.

## Package scaffold now in repo

Package path:

```text
Onchain/plugin-bantah
```

What is already prepared:

- package name: `@bantah-protocol/plugin-bantah`
- TypeScript source scaffold
- Eliza `Plugin` export
- Bantah skill action client over HTTP
- README with install and config examples
- `images/logo.jpg` and `images/banner.jpg`
- `agentConfig` metadata in `package.json`

## Current registry format

Target registry:

```text
https://github.com/elizaos-plugins/registry
```

The current registry expects a simple mapping in `index.json`:

```json
{
  "@bantah-protocol/plugin-bantah": "github:kowksicoder/plugin-bantah"
}
```

Important:

- only modify `index.json`
- entries should be alphabetically sorted
- do not include extra plugin metadata in the PR body as file changes

## Before publish

1. Move or mirror `Onchain/plugin-bantah` into its final standalone repository:
   - suggested repo: `github.com/bantah/plugin-bantah`
2. Confirm the final public Bantah endpoint examples in the README
3. Ensure the GitHub repo has topic:
   - `elizaos-plugins`
4. Ensure repo branding assets are present:
   - `images/logo.jpg`
   - `images/banner.jpg`
5. Run:

```bash
npm install
npm run build
npm publish --access public
```

## Registry PR

Suggested PR title:

```text
feat: add @bantah-protocol/plugin-bantah to registry
```

Suggested PR body:

- package published on npm as `@bantah-protocol/plugin-bantah`
- repository: `github:bantah/plugin-bantah`
- plugin provides Bantah prediction market actions for Eliza agents
- branding assets and README are included in the plugin repository

## Honest status

What is ready now:

- package scaffold
- Bantah action/plugin interface
- registry-ready image/file layout
- registry submission snippet

What still needs finalization:

- standalone repo extraction
- npm publish
- final repository URL in metadata if the repo name changes
