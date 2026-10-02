const fs = require("fs");
const path = require("path");
const { VersionedTransaction, Transaction } = require("@solana/web3.js");

const dir = path.join(process.cwd(), "stonkfun-tx-tests");

const files = fs.readdirSync(dir)
  .filter(f => f.endsWith(".bin"))
  .sort();

for (const file of files) {
  const bytes = fs.readFileSync(path.join(dir, file));

  let tx;
  let versioned = true;

  try {
    tx = VersionedTransaction.deserialize(bytes);
  } catch {
    tx = Transaction.from(bytes);
    versioned = false;
  }

  console.log("\n================================================");
  console.log(file);
  console.log("================================================");
  console.log("TYPE:", versioned ? "VersionedTransaction" : "Legacy Transaction");

  if (versioned) {
    console.log("STATIC ACCOUNT KEYS:");

    tx.message.staticAccountKeys.forEach((key, i) => {
      console.log(`${i}: ${key.toBase58()}`);
    });

    console.log("\nINSTRUCTIONS:");

    tx.message.compiledInstructions.forEach((ix, i) => {
      console.log(`\nInstruction ${i}`);
      console.log("Program index:", ix.programIdIndex);
      console.log("Account indexes:", Array.from(ix.accountKeyIndexes).join(","));
      console.log("Data hex:", Buffer.from(ix.data).toString("hex"));
    });
  } else {
    console.log("INSTRUCTIONS:");

    tx.instructions.forEach((ix, i) => {
      console.log(`\nInstruction ${i}`);
      console.log("Program:", ix.programId.toBase58());
      console.log("Accounts:", ix.keys.map(k => k.pubkey.toBase58()).join(","));
      console.log("Data hex:", ix.data.toString("hex"));
    });
  }
}
