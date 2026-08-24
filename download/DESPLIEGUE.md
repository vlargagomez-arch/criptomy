# Guía de despliegue — NoKYCSwap

## ⚠️ Aviso legal previo

**Antes de desplegar esta plataforma con fondos reales, consulte a un abogado especializado en criptoactivos de su jurisdicción.** Operar un exchange sin KYC es ilegal en la mayoría de países. Ver `ANALISIS_LEGAL.md` para detalle.

Esta guía asume que usted quiere desplegar el MVP **con fines educativos o en una jurisdicción donde sea legal**.

---

## Requisitos

- Node.js 20+ o Bun 1.1+
- 2 GB RAM mínimo (4 GB recomendado)
- 20 GB disco
- Linux (Ubuntu 22.04+ recomendado)
- Tor daemon (para servicio oculto .onion)
- Dominio opcional (si quiere acceso clearnet además de .onion)

---

## 1. Despliegue del smart contract (Sepolia testnet)

### 1.1 Instalar Hardhat

```bash
mkdir nokyc-contracts && cd nokyc-contracts
npm init -y
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
npm install @openzeppelin/contracts
npx hardhat init  # elegir "Create a JavaScript project"
```

### 1.2 Copiar el contrato

```bash
cp /home/z/my-project/smart-contracts/P2PEscrow.sol ./contracts/
```

### 1.3 Configurar `hardhat.config.js`

```javascript
require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: "0.8.20",
  networks: {
    sepolia: {
      url: "https://rpc.sepolia.org",
      accounts: [process.env.PRIVATE_KEY], // 0x... sin 0x al frente
    },
  },
};
```

### 1.4 Obtener ETH de testnet

Visite https://sepoliafaucet.com (o cualquier faucet de Sepolia) con su wallet, obtenga 0.5 ETH de prueba.

### 1.5 Crear script de despliegue

`scripts/deploy.js`:

```javascript
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployando con:", deployer.address);

  const P2PEscrow = await hre.ethers.getContractFactory("P2PEscrow");
  // feeCollector = el deployer (o otra address)
  const escrow = await P2PEscrow.deploy(deployer.address);
  await escrow.waitForDeployment();

  console.log("✓ P2PEscrow desplegado en:", await escrow.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

### 1.6 Desplegar

```bash
export PRIVATE_KEY="tu_clave_privada_sepolia"
npx hardhat run scripts/deploy.js --network sepolia
# Output: ✓ P2PEscrow desplegado en: 0xABC123...
```

### 1.7 Actualizar la dirección en el frontend

Editar `src/lib/blockchain/contracts.ts`:

```typescript
export const ESCROW_CONTRACT_ADDRESS_SEPOLIA = "0xABC123..."; // su address
```

---

## 2. Despliegue del servidor Next.js

### 2.1 Clonar e instalar

```bash
git clone <su-repo> nokycswap
cd nokycswap
bun install  # o npm install
```

### 2.2 Configurar variables de entorno

`.env`:

```bash
DATABASE_URL="file:./db/custom.db"
# En producción: usar PostgreSQL
# DATABASE_URL="postgresql://user:pass@localhost:5432/nokycswap"

# Opcional: oráculo de precios Chainlink
# CHAINLINK_ETH_USD="0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419"

# Opcional: webhook de notificaciones
# NOTIFICATION_WEBHOOK="https://hooks.example.com/nokyc"
```

### 2.3 Inicializar base de datos

```bash
bun run db:push
bun run db:generate
bun run scripts/seed.ts  # opcional: datos demo
```

### 2.4 Build de producción

```bash
bun run build
# genera .next/standalone/ listo para servir
```

### 2.5 Servir con PM2 (recomendado)

```bash
npm install -g pm2
pm2 start "bun .next/standalone/server.js" --name nokycswap
pm2 startup
pm2 save
```

### 2.6 Reverse proxy con Caddy (auto-TLS)

`Caddyfile`:

```
nokycswap.example.com {
    reverse_proxy 127.0.0.1:3000

    # No loguear IPs (privacidad)
    log {
        output file /var/log/caddy/nokyc.log
        format json
    }
    # Encabezados de privacidad
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Frame-Options "DENY"
        X-Content-Type-Options "nosniff"
        Referrer-Policy "no-referrer"
    }
}
```

```bash
sudo systemctl reload caddy
```

---

## 3. Configurar Tor Hidden Service (.onion)

### 3.1 Instalar Tor

```bash
sudo apt update
sudo apt install tor
```

### 3.2 Configurar servicio oculto

Editar `/etc/tor/torrc`, agregar al final:

```
HiddenServiceDir /var/lib/tor/nokycswap/
HiddenServicePort 80 127.0.0.1:3000
# Opcional: también exponer por HTTPS (necesita cert para .onion v3)
# HiddenServicePort 443 127.0.0.1:3000
```

### 3.3 Reiniciar Tor

```bash
sudo systemctl restart tor
sudo systemctl enable tor
```

### 3.4 Obtener la dirección .onion

```bash
sudo cat /var/lib/tor/nokycswap/hostname
# Output: abc123def456ghi789jkl012mno345pqr678stu901vwx234yz.onion
```

### 3.5 Configurar Caddy para servir también el .onion

`Caddyfile` (agregar):

```
abc123...onion {
    reverse_proxy 127.0.0.1:3000
    # Sin TLS (Tor ya cifra extremo-a-extremo)
    tls internal
}
```

### 3.6 Forzar acceso solo por Tor (opcional)

Si quiere que la plataforma **solo** sea accesible vía Tor (máxima privacidad), bloquee el puerto 3000 al exterior:

```bash
# Cerrar 3000 a internet, solo localhost
sudo ufw deny 3000
sudo ufw allow from 127.0.0.1 to any port 3000
```

---

## 4. Multi-cadena: configurar nodos RPC

Para evitar depender de RPCs públicas (que bloquean Tor o tienen rate-limits), considere correr sus propios nodos:

### 4.1 Nodo Ethereum (Geth)

```bash
# Requiere SSD de 1 TB+ y 8 GB RAM
geth --sepolia --syncmode "snap" --http --http.api eth,net,web3
```

### 4.2 Nodo Bitcoin (bitcoind)

```bash
# Requiere 600 GB+ disco
bitcoind -testnet=1 -server=1 -rpcuser=... -rpcpassword=...
```

### 4.3 Nodo Monero (monerod)

```bash
# Requiere 150 GB+ disco
monerod --stagenet --rpc-bind-ip 127.0.0.1 --rpc-bind-port 38089
```

Actualizar `src/lib/blockchain/config.ts` con las URLs de sus propios nodos.

---

## 5. WebSocket para chat en tiempo real (opcional)

El MVP usa polling cada 3s. Para chat real-time, activar el mini-service:

### 5.1 Configurar

```bash
cd mini-services/chat-service
bun install
```

`mini-services/chat-service/index.ts` ya está estructurado. Iniciar:

```bash
bun run dev  # puerto 3003
```

### 5.2 Iniciar con PM2

```bash
pm2 start "bun run dev" --name nokyc-chat --cwd /path/to/mini-services/chat-service
```

---

## 6. Backups

### 6.1 Base de datos

```bash
# SQLite
cp db/custom.db backups/custom-$(date +%Y%m%d).db

# PostgreSQL
pg_dump nokycswap > backups/nokyc-$(date +%Y%m%d).sql
```

Cron diario:

```cron
0 3 * * * cp /home/z/my-project/db/custom.db /backups/custom-$(date +\%Y\%m\%d).db
```

### 6.2 Claves del smart contract

- La `feeCollector` address debe ser una wallet segura (hardware wallet recomendado).
- El `PRIVATE_KEY` de deploy solo se usa una vez; bórrelo tras deployar.

---

## 7. Monitoreo

### 7.1 Logs

```bash
pm2 logs nokycswap
pm2 logs nokyc-chat
sudo journalctl -u tor -f
sudo tail -f /var/log/caddy/nokyc.log
```

### 7.2 Salud

```bash
# HTTP check
curl -s https://nokycswap.example.com/api/chain-config | jq .

# Tor check (debe resolver)
curl -s --socks5-hostname 127.0.0.1:9050 http://abc123...onion/api/chain-config | jq .
```

### 7.3 Alertas

Configurar alertas en Uptime Robot (o similar) sobre:
- HTTP 200 en `/api/chain-config` (clearnet)
- HTTP 200 en `/api/chain-config` vía .onion
- Espacio en disco del nodo
- Sincronización de nodos RPC

---

## 8. Hardening

### 8.1 Firewall

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
# NO abrir 3000 (solo localhost)
sudo ufw enable
```

### 8.2 SSH

- Desactivar login por contraseña
- Usar claves ED25519
- Cambiar puerto default (22 → otro)

### 8.3 Fail2ban

```bash
sudo apt install fail2ban
sudo systemctl enable fail2ban
```

### 8.4 Actualizaciones automáticas

```bash
sudo apt install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

---

## 9. Roadmap post-MVP

- [ ] Integración real con MetaMask / WalletConnect
- [ ] Oráculo Chainlink para precios de mercado
- [ ] IPFS para evidencia de disputas
- [ ] Kleros para arbitraje descentralizado
- [ ] PostgreSQL en producción
- [ ] Socket.io para chat real-time
- [ ] P2P network tipo Bisq (sin servidor central)
- [ ] Mobile app (React Native)
- [ ] Auditoría de smart contract (CertiK/OpenZeppelin)
- [ ] Bug bounty program

---

## 10. Troubleshooting

### "No conecta wallet"
- Verificar que el navegador soporta Web Crypto API (HTTPS requerido, o localhost).
- En Tor Browser: activar `dom.crypto.enabled` en `about:config`.

### "Smart contract no responde"
- Verificar la address en `src/lib/blockchain/contracts.ts`.
- Verificar RPC URL en `src/lib/blockchain/config.ts`.
- Comprobar en Etherscan Sepolia que el contrato está deployado.

### "Tor .onion no carga"
- Verificar `sudo systemctl status tor`.
- Verificar `/var/lib/tor/nokycswap/hostname` existe.
- En Caddy: configurar `tls internal` para .onion.

### "Chat no actualiza"
- El MVP usa polling cada 3s. Si no actualiza, revisar consola del navegador.
- Para tiempo real: activar el mini-service WebSocket.

---

Para soporte: consultar `ARQUITECTURA.md` para detalles técnicos o `ANALISIS_LEGAL.md` antes de desplegar en producción.
