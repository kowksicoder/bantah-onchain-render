# Eliza Plugin Registry Checklist

This is the operational checklist for getting `@elizaos/plugin-bantah` into the Eliza plugin ecosystem.

## Package scaffold now in repo

Package path:

```text
Onchain/plugin-bantah
```

What is already prepared:

- package name: `@elizaos/plugin-bantah`
- TypeScript source scaffold
- Eliza `Plugin` export
- Bantah skill action client over HTTP
- README with install and config examples
- images folder target for registry/repo assets

## Before publish

1. Move or mirror `Onchain/plugin-bantah` into its final standalone repository:
   - suggested repo: `github.com/bantah/plugin-bantah`
2. Confirm the final public Bantah endpoint examples in the README
3. Add final package screenshots / hero assets if desired
4. Run:

```bash
npm install
npm run build
npm publish --access public
```

## Registry PR payload

Target registry:

```text
https://github.com/elizaos-plugins/registry
```

Suggested entry:

```json
{
  "name": "@elizaos/plugin-bantah",
  "description": "Bantah Protocol — prediction market actions for AI agents",
  "url": "https://github.com/bantah/plugin-bantah"
}
```

Suggested PR title:

```text
feat: add plugin-bantah
```

## Honest status

What is ready now:

- package scaffold
- Bantah action/plugin interface
- registry submission prep

What still needs finalization:

- standalone repo extraction
- npm publish
- final repository URL in metadata
