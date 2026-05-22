# Deployent Auction Front

## Descripción del Proyecto

**Auction Front** es una plataforma de subastas descentralizada construida sobre **Solana** utilizando **Anchor** para el smart contract en Rust y **Next.js** para el frontend.

El contrato inteligente (`auction-backend`) expone las siguientes funcionalidades:

- **`crear_subasta`** — Crear una nueva subasta con nombre, descripción, importe mínimo y rango de fechas.
- **`iniciar_subasta`** — El creador activa la subasta una vez que la fecha de inicio ha llegado.
- **`crear_puja`** — Los usuarios pujan enviando SOL a una vault PDA. Si ya hay un ganador anterior, se le reembolsa automáticamente antes de aceptar la nueva puja.
- **`finalizar_subasta`** — El creador cierra la subasta después de la fecha de fin y retira los fondos de la vault.

El frontend está desarrollado con **Next.js** y se conecta a la red Solana (localnet) mediante Anchor y Wallet Adapter.

---

## Requisitos

- Node.js >= 18
- Solana CLI
- Anchor CLI
- Yarn (opcional, usado por Anchor)

---

## Pasos para correr el proyecto localmente (Estos pasos estan pensados ejecutando linux desde WSL en windows)

### 1. Arrancar el validator local (borra todo el estado previo): sustituye la direccion 172.20.110.62 por tu porpia direccion, si estas trabajando directo en linux (sin wsl) o en mac generalemtne es 127.0.0.1

```bash
solana-test-validator --reset --bind-address 172.20.110.62
```

### 2. Configurar la CLI de Solana (en una nueva terminal)

```bash
solana config set --url http://172.20.110.62:8899
```

### 3. Configurar Anchor Provider URL

```bash
export ANCHOR_PROVIDER_URL=http://172.20.110.62:8899
```

### 4. Build + Deploy del smart contract

```bash
cd auction-backend
anchor build
anchor deploy
```

### 5. Hacer airdrop a las cuentas de prueba (Sustituye por tus propias cuentas de Phantom en Localnet)

```bash
solana airdrop 10 52feSF6iGpAXG3migyYvGUx5oh1H4ks5RF3hHXoyfK7G --url http://172.20.110.62:8899
solana airdrop 10 CtuB7QRa5NPcevSoNCUqLWnrEgZv1QUMJgeqffnQ5dmM --url http://172.20.110.62:8899
solana airdrop 10 Gk1NVG5yNnJ9jRNak1517FjMcERkQwq1wDcwqiYFQeEg --url http://172.20.110.62:8899
```

### 6. Verificar saldo de las cuentas

```bash
solana balance 52feSF6iGpAXG3migyYvGUx5oh1H4ks5RF3hHXoyfK7G --url http://172.20.110.62:8899
solana balance CtuB7QRa5NPcevSoNCUqLWnrEgZv1QUMJgeqffnQ5dmM --url http://172.20.110.62:8899
solana balance 52feSF6iGpAXG3migyYvGUx5oh1H4ks5RF3hHXoyfK7G --url http://172.20.110.62:8899
```

### 7. Copiar el IDL generado al frontend

```bash
cp target/idl/auction_backend.json ../auction-front/src/idl/auction_backend.json
```

### 8. Arrancar el frontend

```bash
cd ../auction-front
rm -rf .next
npm run dev -- -H 0.0.0.0 -p 3000
```

---

Hecho.
