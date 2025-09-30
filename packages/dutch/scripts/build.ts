import { $ } from 'bun'

async function run() {
  const externals = [
    'bun:sqlite',
    'bip39',
    'bip32',
    'tiny-secp256k1',
    'bitcoinjs-lib',
    'postgres',
  ]

  const externalFlags = externals.flatMap((dep) => ['-e', dep])

  await $`bun build src/index.ts --bundle --format=cjs --target=node ${externalFlags} --outfile=dist/index.cjs`

  await $`bun build src/browser.ts --bundle --format=esm --target=browser --outfile=dist/browser.js`
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})


