# NPM Publish Checklist

This is the last-mile checklist for publishing `@bantah-protocol/plugin-bantah`.

## Package path

```text
Onchain/plugin-bantah
```

## Pre-publish checks

1. Confirm final repository URL
2. Confirm `package.json` version
3. Confirm `README.md` install instructions
4. Confirm `images/logo.jpg` and `images/banner.jpg` exist
5. Confirm `npm whoami`
6. Run:

```bash
npm install
npm run build
```

## Publish command

```bash
npm publish --access public
```

## Post-publish verification

1. Open npm package page
2. Verify README renders correctly
3. Verify package includes:
   - `dist`
   - `README.md`
   - `images`
4. Install-test in a clean Eliza project:

```bash
npm install @bantah-protocol/plugin-bantah
```

## Then do the registry PR

Use:

- [REGISTRY_INDEX_SNIPPET.json](/c:/Users/MIKKI/3D%20Objects/dnej5yh84940-main/Onchain/docs/eliza-plugin/REGISTRY_INDEX_SNIPPET.json)
- [REGISTRY_CHECKLIST.md](/c:/Users/MIKKI/3D%20Objects/dnej5yh84940-main/Onchain/docs/eliza-plugin/REGISTRY_CHECKLIST.md)
