
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AuctionBackend } from "../target/types/auction_backend";
import assert from "assert";

describe("subastas", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.getProvider() as anchor.AnchorProvider;
 const program = anchor.workspace.AuctionBackend as Program<AuctionBackend>;

  const id = new anchor.BN(Math.floor(Math.random() * 100000) + 1);

  const [subastaPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("subasta33"), id.toArrayLike(Buffer, "le", 8)],
    program.programId
  );

  const [vaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), id.toArrayLike(Buffer, "le", 8)],
    program.programId
  );

  const bidder1 = anchor.web3.Keypair.generate();
  const bidder2 = anchor.web3.Keypair.generate();

  const [puja1Pda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("puja2222"), id.toArrayLike(Buffer, "le", 8), bidder1.publicKey.toBuffer()],
    program.programId
  );

  const [puja2Pda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("puja2222"), id.toArrayLike(Buffer, "le", 8), bidder2.publicKey.toBuffer()],
    program.programId
  );

  const oneSol = 1_000_000_000;

  async function airdrop(pubkey: anchor.web3.PublicKey, sol: number) {
    const sig = await provider.connection.requestAirdrop(pubkey, sol * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(sig, "confirmed");
  }

  it("airdrop bidders", async () => {
    await airdrop(bidder1.publicKey, 10);
    await airdrop(bidder2.publicKey, 10);
    const b1 = await provider.connection.getBalance(bidder1.publicKey);
    const b2 = await provider.connection.getBalance(bidder2.publicKey);
    assert.ok(b1 > 0 && b2 > 0);
  });

  it("crear + iniciar subasta", async () => {
    const now = Math.floor(Date.now() / 1000);
    const inicio = new anchor.BN(now - 2);
    const fin = new anchor.BN(now + 30);

    const tx1 = await program.methods
      .crearSubasta(
        id,
        "Subasta 1",
        "Descripción 1",
        new anchor.BN(oneSol / 10),
        inicio,
        fin
      )
      .accounts({
        subasta: subastaPda,
        vault: vaultPda,
        user: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    assert.ok(tx1);

    const tx2 = await program.methods
      .iniciarSubasta(id)
      .accounts({
        subasta: subastaPda,
        user: provider.wallet.publicKey,
      })
      .rpc();

    assert.ok(tx2);

    const sub = await program.account.subasta.fetch(subastaPda);
    assert.equal(sub.estado, 1); // Activa
  });

  it("bidder1 puja 1 SOL", async () => {
    const b1_before = await provider.connection.getBalance(bidder1.publicKey);

    const tx = await program.methods
      .crearPuja(id, new anchor.BN(oneSol))
      .accounts({
        subasta: subastaPda,
        vault: vaultPda,
        prevGanador: bidder1.publicKey, // no winner yet
        puja: puja1Pda,
        user: bidder1.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([bidder1])
      .rpc();

    assert.ok(tx);

    const vaultBal = await provider.connection.getBalance(vaultPda);
    assert.ok(vaultBal >= oneSol);

    const sub = await program.account.subasta.fetch(subastaPda);
    assert.equal(sub.importeGanador.toNumber(), oneSol);
    assert.equal(sub.ganador.toBase58(), bidder1.publicKey.toBase58());

    const b1_after = await provider.connection.getBalance(bidder1.publicKey);
    assert.ok(b1_after < b1_before); // pagó + fee
  });

  it("bidder2 puja 2 SOL y reembolsa a bidder1", async () => {
    const b1_before_refund = await provider.connection.getBalance(bidder1.publicKey);
    const b2_before = await provider.connection.getBalance(bidder2.publicKey);

    const tx = await program.methods
      .crearPuja(id, new anchor.BN(2 * oneSol))
      .accounts({
        subasta: subastaPda,
        vault: vaultPda,
        prevGanador: bidder1.publicKey, // clave: anterior ganador real
        puja: puja2Pda,
        user: bidder2.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([bidder2])
      .rpc();

    assert.ok(tx);

    const sub = await program.account.subasta.fetch(subastaPda);
    assert.equal(sub.importeGanador.toNumber(), 2 * oneSol);
    assert.equal(sub.ganador.toBase58(), bidder2.publicKey.toBase58());

    // vault debe quedar con 2 SOL (entra 2, sale 1 refund)
    const vaultBal = await provider.connection.getBalance(vaultPda);
    assert.ok(vaultBal >= 2 * oneSol);

    const b1_after_refund = await provider.connection.getBalance(bidder1.publicKey);

    // bidder1 debió recuperar ~1 SOL (menos fees de sus tx previas)
    // tolerancia: fees y variaciones menores
    assert.ok(b1_after_refund > b1_before_refund - 50_000);

    const b2_after = await provider.connection.getBalance(bidder2.publicKey);
    assert.ok(b2_after < b2_before); // pagó 2 SOL + fee
  });

  it("finalizar subasta paga al creador", async () => {
    // esperar a que pase fecha_fin
    await new Promise((r) => setTimeout(r, 35_000));

    const creator_before = await provider.connection.getBalance(provider.wallet.publicKey);

    const tx = await program.methods
      .finalizarSubasta(id)
      .accounts({
        subasta: subastaPda,
        vault: vaultPda,
        user: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    assert.ok(tx);

    const vaultBal = await provider.connection.getBalance(vaultPda);
    assert.ok(vaultBal <= 10_000);

    const creator_after = await provider.connection.getBalance(provider.wallet.publicKey);
    assert.ok(creator_after > creator_before); // recibió 2 SOL (menos fees)
  });
});
