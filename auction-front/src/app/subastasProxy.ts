
"use client";

import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import { AnchorProvider, BN, Idl, Program } from "@coral-xyz/anchor";
import bs58 from "bs58";

// IDL copiado desde auction-backend/target/idl/auction_backend.json
import idl from "../idl/auction_backend.json";

const RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "http://127.0.0.1:8899";

const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_AUCTION_PROGRAM_ID ||
    // fallback (tu program id actual)
    "AKjkfu64ZMHs3cufaQKoZxUCZGgRYr8iiD3KDDSwndNf"
);

// -------------------------
// Helpers PDA
// -------------------------
export function getSubastaPda(id: BN) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("subasta33"), id.toArrayLike(Buffer, "le", 8)],
    PROGRAM_ID
  )[0];
}

export function getVaultPda(id: BN) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), id.toArrayLike(Buffer, "le", 8)],
    PROGRAM_ID
  )[0];
}

export function getPujaPda(id: BN, user: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("puja2222"), id.toArrayLike(Buffer, "le", 8), user.toBuffer()],
    PROGRAM_ID
  )[0];
}

// -------------------------
// Provider/Program
// -------------------------
function getProvider(wallet: any) {
  const connection = new Connection(RPC_URL, "confirmed");
  return new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
}

function getProgram(wallet: any) {
  const provider = getProvider(wallet);
  // Tipado flexible para evitar fricción de types en frontend
  return new Program(idl as Idl, provider) as Program;
}

// -------------------------
// Utils
// -------------------------
function estadoToLabel(estado: any) {
  const n = Number(estado);
  if (n === 0) return "creada";
  if (n === 1) return "activa";
  if (n === 2) return "finalizada";
  return String(estado);
}

/**
 * UI ingresa SOL o lamports?
 * - Por simplicidad: UI ingresará lamports (como test)
 * - Si quieres SOL: convierte aquí con * 1e9
 */
export function toLamports(amountStr: string) {
  // asumiendo input en lamports
  return new BN(amountStr);
}

// -------------------------
// API
// -------------------------

export async function getSubastas(wallet: any) {
  const program = getProgram(wallet);
  const subastas = await program.account.subasta.all();

  return subastas.map(({ account, publicKey }: any) => ({
    id: account.id.toString(),
    nombre: account.nombre,
    descripcion: account.descripcion,
    importe_minimo: account.importeMinimo.toString(),
    fecha_inicio: account.fechaInicio.toString(), // segundos
    fecha_fin: account.fechaFin.toString(),       // segundos
    estado: estadoToLabel(account.estado),
    publicKey: publicKey.toBase58(),
    creador: account.creador.toBase58(),
    ganador: account.ganador.toBase58(),
    importe_ganador: account.importeGanador.toString(),
  }));
}

export async function getSubastaById(wallet: any, idStr: string) {
  const program = getProgram(wallet);
  const id = new BN(idStr);
  const subastaPda = getSubastaPda(id);

  const account: any = await program.account.subasta.fetch(subastaPda);

  return {
    id: account.id.toString(),
    nombre: account.nombre,
    descripcion: account.descripcion,
    importe_minimo: account.importeMinimo.toString(),
    fecha_inicio: account.fechaInicio.toString(),
    fecha_fin: account.fechaFin.toString(),
    estado: estadoToLabel(account.estado),
    publicKey: subastaPda.toBase58(),
    creador: account.creador.toBase58(),
    ganador: account.ganador.toBase58(),
    importe_ganador: account.importeGanador.toString(),
  };
}

export async function createSubasta(
  wallet: any,
  {
    nombre,
    descripcion,
    importe_minimo,
    fecha_inicio,
    fecha_fin,
  }: {
    nombre: string;
    descripcion: string;
    importe_minimo: string;
    fecha_inicio: string; // segundos
    fecha_fin: string; // segundos
  }
) {
  const program = getProgram(wallet);

  // id u64: puedes usar Date.now() (ms) pero se guarda como u64.
  // No importa si está en ms, solo debe ser único.
  const id = new BN(Date.now());

  const subastaPda = getSubastaPda(id);
  const vaultPda = getVaultPda(id);

  await program.methods
    .crearSubasta(
      id,
      nombre,
      descripcion,
      toLamports(importe_minimo),
      new BN(fecha_inicio),
      new BN(fecha_fin)
    )
    .accounts({
      subasta: subastaPda,
      vault: vaultPda, // ✅ requerido por tu program (y lo crea on-chain si no existe)
      user: wallet.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return id.toString();
}

export async function iniciarSubasta(wallet: any, idStr: string) {
  const program = getProgram(wallet);
  const id = new BN(idStr);
  const subastaPda = getSubastaPda(id);

  await program.methods
    .iniciarSubasta(id)
    .accounts({
      subasta: subastaPda,
      user: wallet.publicKey,
    })
    .rpc();
}

export async function crearPuja(
  wallet: any,
  { id: idStr, importe_puja }: { id: string; importe_puja: string }
) {
  const program = getProgram(wallet);
  const id = new BN(idStr);

  const subastaPda = getSubastaPda(id);
  const vaultPda = getVaultPda(id);
  const pujaPda = getPujaPda(id, wallet.publicKey);

  // Necesitamos prev_ganador. Lo leemos del estado actual.
  const subasta: any = await program.account.subasta.fetch(subastaPda);
  const ganadorActual: PublicKey = subasta.ganador;

  const defaultPk = PublicKey.default;
  const prevGanador = ganadorActual.equals(defaultPk)
    ? wallet.publicKey // primer bid: envía tu propia key para cumplir account metas
    : ganadorActual;

  await program.methods
    .crearPuja(id, toLamports(importe_puja))
    .accounts({
      subasta: subastaPda,
      vault: vaultPda,
      prevGanador, // ✅ requerido
      puja: pujaPda,
      user: wallet.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

export async function finalizarSubasta(wallet: any, idStr: string) {
  const program = getProgram(wallet);
  const id = new BN(idStr);

  const subastaPda = getSubastaPda(id);
  const vaultPda = getVaultPda(id);

  await program.methods
    .finalizarSubasta(id)
    .accounts({
      subasta: subastaPda,
      vault: vaultPda,
      user: wallet.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

export async function getPujas(wallet: any, subastaId: string) {
  const program = getProgram(wallet);
  const id = new BN(subastaId);

  // filtro por id en offset 8 (discriminator)
  const idBuffer = id.toArrayLike(Buffer, "le", 8);

  const pujas = await program.account.puja.all([
    {
      memcmp: {
        offset: 8,
        bytes: bs58.encode(idBuffer),
      },
    },
  ]);

  return pujas.map(({ account, publicKey }: any) => ({
    id: account.id.toString(),
    importe_puja: account.importe.toString(),
    // tu program guarda ts en segundos; para UI convertimos a ms
    ts: (Number(account.ts.toString()) * 1000).toString(),
    pk: account.user.toBase58(),
    publicKey: publicKey.toBase58(),
  }));
}
