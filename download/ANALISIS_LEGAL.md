# Análisis legal — NoKYCSwap

## ⚠️ Descargo de responsabilidad

Este documento es **informativo y educativo**, no constituye asesoría legal. Antes de operar esta plataforma con fondos reales, consulte a un abogado especializado en criptoactivos y derecho financiero de su jurisdicción.

---

## 1. Por qué LocalBitcoins cerró

LocalBitcoins operó desde 2012 hasta febrero de 2023. Los factores que llevaron a su cierre:

### 1.1 Línea de tiempo regulatoria

| Fecha | Evento |
|-------|--------|
| 2012 | Lanzamiento. Sin KYC, escrow centralizado en Bitcoin. |
| 2014-2016 | Finlandia (donde operaba) empieza a exigir KYC a exchanges. |
| 2018 | EU implementa 5AMLD: exchanges deben identificar usuarios. |
| **2019** | **LocalBitcoins implementa KYC obligatorio** (respondiendo a 5AMLD finlandesa). |
| 2020 | 6AMLD europea refuerza obligaciones AML. |
| 2022 | "Cripto invierno": caen volúmenes y revenue. |
| **Feb 2023** | **Cierre definitivo**, citando "condiciones de mercado". |
| 2023 | Forbes reveló que fue citado en caso Bizlato (EE.UU.) por lavado de dinero. |

### 1.2 Lecciones

1. **Sin KYC no es sostenible en jurisdicciones con AML fuerte.**
2. **Implementar KYC destruye el valor diferencial** (los usuarios migran a Bisq, HodlHodl, RoboSats).
3. **El cripto-invierno agrava** cuando los márgenes ya son finos.
4. **Casos penales (Bizlato)** generan presión adicional sobre exchanges P2P.

---

## 2. Marco legal — Colombia

### 2.1 Normativa aplicable

| Norma | Materia | Aplicabilidad a NoKYCSwap |
|-------|---------|---------------------------|
| **Circular Externa 029 de 2014** (Superfinanciera) | Establece que Bitcoin no es moneda de curso legal pero sí bien. Regula a instituciones financieras que tocan cripto. | Si la plataforma toca sistema financiero colombiano (PSE, Nequi, bancos), requiere registrarse como SAGRILAFT. |
| **Ley 1581 de 2012** | Protección de datos personales. | Aplicable si se almacena cualquier dato personal. Por diseño, NoKYCSwap no almacena PII. |
| **Estatuto Orgánico del Sistema Financiero (EOSF)** | Define qué es "actividad financiera vigilada". | Captación masiva de fondos (custodia) requiere autorización Superfinanciera. NoKYCSwap **no custodia** (escrow on-chain), pero el argumento es discutible. |
| **Ley 1900 de 2018** | Regula los juegos de azar en internet (no aplica a cripto directamente). | N/A. |
| **Circular 007 de 2022** (UIAF) | Instrucciones a entidades vigiladas sobre riesgo de lavado de activos en criptoactivos. | Indirecta: si un banco detecta patrón inusual en cuenta usada para NoKYCSwap, reporta SAGRILAFT. |
| **Código Penal — Art. 323 (Lavado de Activos)** | Tipifica el lavado de activos. | Aplicable si la plataforma facilita lavado (aún sin intención, si hay "ceguera voluntaria"). |
| **Código Penal — Art. 383 (Operaciones no autorizadas)** | Castiga captación masiva sin autorización. | Riesgo si la plataforma toma custodia de fondos fiat. |

### 2.2 ¿Es legal operar NoKYCSwap desde Colombia?

**Respuesta corta: No es claramente legal, y opera en zona gris con alto riesgo.**

**Factores de riesgo:**

1. **Captación de fondos:** aunque el escrow es on-chain, la plataforma procesa pagos fiat (Nequi, PSE, etc.) entre partes. La Superfinanciera podría argumentar que esto es "actividad financiera vigilada".

2. **SAGRILAFT:** cualquier entidad que procese más de ciertos umbrales (USD 10.000/mes en transacciones relacionadas con cripto) debe reportar. La plataforma podría ser considerada "sujeto obligado".

3. **Lavado de activos:** sin KYC, es imposible detectar patrones de lavado. La "ceguera voluntaria" (willful blindness) es doctrina penal reconocida en Colombia.

4. **Reputational risk:** bancos colombianos (Bancolombia, BBVA) cierran cuentas de plataformas P2P con frecuencia, bajo presión de Superfinanciera.

5. **DIAN:** si la plataforma cobra comisiones, debe declarar y pagar IVA (19%) y renta. Sin KYC, no es posible emitir factura electrónica válida.

### 2.3 Sanciones potenciales

| Infracción | Sanción |
|------------|---------|
| Operar actividad financiera sin autorización | Multa hasta 200 SMMLV + cierre (EOSF art. 211) |
| Lavado de activos (penal) | 6 a 30 años de prisión (Código Penal art. 323) |
| Omisión de SAGRILAFT | Multa hasta 500 SMMLV por la UIAF |
| Evasión fiscal (DIAN) | Multa + intereses + posible penal |

---

## 3. Marco legal comparado

### 3.1 Estados Unidos

- **FinCEN:** exige registro como Money Services Business (MSB) para cualquier exchange.
- **Bank Secrecy Act (BSA):** requiere KYC + reportes SAR (Suspicious Activity Reports).
- **OFAC:** sanciones a países (Cuba, Irán, Corea del Norte, etc.).
- **Casos relevantes:** LocalBitcoins fue citado en caso Bizlato (2023); Paxful se auto-reguló; Bisq opera P2P sin servidor central pero es давление.

### 3.2 Unión Europea

- **5AMLD (2018) y 6AMLD (2020):** exchanges deben KYC.
- **MiCA (Markets in Crypto-Assets, 2024):** regula CASPs (Crypto-Asset Service Providers). Exige licencia en un estado miembro.
- **Sin KYC no es posible** operar legalmente como CASP.

### 3.3 El Salvador

- **Único país donde Bitcoin es moneda de curso legal** (Ley Bitcoin, 2021).
- Exento de impuestos sobre ganancias.
- Pero AML sigue aplicando vía leyes internacionales (FATF).

### 3.4 Suiza

- **Ley Blockchain (2021):** establece marco claro pero exige KYC para exchanges.
- Lugano y Zug son hubs cripto, pero con KYC.

### 3.5 Jurisdicciones "amigables" a no-KYC

Ninguna jurisdicción del mundo autoriza formalmente exchanges sin KYC. Las que más se acercan:

- **Portugal** (antes de 2023, ahora alineado con 6AMLD)
- **El Salvador** (para BTC P2P entre particulares, no para exchanges)
- **Países Caribbean CBPI** (Saint Vincent, Granada) — pero bajo presión FATF

---

## 4. Análisis comparado con alternativas

| Plataforma | Modelo | Estado legal |
|-----------|--------|--------------|
| **LocalBitcoins** (cerrado) | Custodial + KYC post-2019 | Cerró por presión regulatoria |
| **Bisq** | P2P desktop app, sin servidor | Zona gris; nunca han sido demandados, pero han recibido cartas cease-and-desist |
| **HodlHodl** | Non-custodial, multisig | Opera con KYC en países que lo exigen; no-KYC en otros |
| **RoboSats** | Lightning Network, .onion only | Operadores anónimos; nunca han sido demandados (todavía) |
| **Paxful** | Cerró en 2023 por presión regulatoria + KYC estricto | Cerrado |
| **NoKYCSwap** (este MVP) | Non-custodial, smart contract escrow, sin KYC | Ilegal en la mayoría de jurisdicciones |

---

## 5. Estrategias de mitigación legal

Si decide operar NoKYCSwap pese a los riesgos, estas estrategias reducen (no eliminan) el riesgo:

### 5.1 Estructura legal

- **No incorpore en Colombia.** Considere DAO o fundación en Suiza (Zug), Liechtenstein, o Panamá.
- **Servidores offshore** (Suiza, Islandia, Panamá).
- **Dominio .onion exclusivo** (sin clearnet) reduce superficie regulatoria.
- **Operadores anónimos** (como RoboSats) — pero esto tiene sus propios riesgos.

### 5.2 Limitaciones técnicas

- **No custodie fiat.** Solo procesa cripto on-chain (escrow).
- **No toque el sistema bancario.** Solo efectivo en persona, Western Union, o cripto-a-cripto.
- **Límites por trade** (ej: máximo USD 1.000/trade) reduce riesgo AML.
- **Blacklist de OFAC** (impedir wallets sancionadas).

### 5.3 Compliance diferido

- **Implementar KYC opcional** para usuarios que quieran límites más altos.
- **Reportes SAR voluntarios** si detecta actividad sospechosa.
- **Geobloqueo** de países con KYC obligatorio (EE.UU., UE, Reino Unido).

### 5.4 Comunicación

- **No use marketing agresivo.** No prometa "lavar dinero" ni "evadir impuestos".
- **Términos de servicio claros:** la plataforma es software, no servicio financiero.
- **Disclaimer de no-asesoría financiera.**

---

## 6. Riesgo personal del operador

| Riesgo | Probabilidad | Severidad |
|--------|-------------|-----------|
| Cierre administrativo (Superfinanciera) | Alta | Media |
| Multas UIAF | Media | Alta |
| Bloqueo de cuentas bancarias personales | Alta | Media |
| Investigación penal por lavado de activos | Baja | Muy alta |
| Extradición (si opera offshore) | Muy baja | Muy alta |
- **Riesgo personal del operador:**

| Riesgo | Probabilidad | Severidad |
|--------|-------------|-----------|
| Cierre administrativo (Superfinanciera) | Alta | Media |
| Multas UIAF | Media | Alta |
| Bloqueo de cuentas bancarias personales | Alta | Media |
| Investigación penal por lavado de activos | Baja | Muy alta |
| Extradición (si opera offshore) | Muy baja | Muy alta |

---

## 7. Conclusión y recomendación

**No es recomendable operar NoKYCSwap con fondos reales desde Colombia.** El riesgo legal es alto y las sanciones potenciales severas.

**Usos legítimos del MVP:**

1. **Educación:** entender cómo funcionaba LocalBitcoins y por qué cerró.
2. **Investigación académica:** estudiar arquitecturas P2P con escrow on-chain.
3. **Prototipo para una versión con KYC:** usar este código como base, agregando cumplimiento.
4. **Auto-custodia personal:** no como servicio público, solo para sus propios trades con amigos/familia (uso privado no comercial).

**Si quiere operar legalmente un exchange P2P en Colombia:**

1. Constituya una sociedad SAS.
2. Inscriba la sociedad ante la Cámara de Comercio.
3. Solicite registro como SAGRILAFT ante la UIAF.
4. Implemente KYC con proveedor certificado (Onfido, Jumio, etc.).
5. Implemente monitoreo de transacciones (Chainalysis, Elliptic).
6. Contrate un Compliance Officer certificado.
7. Mantenga reservas de capital mínimas.
8. Reporte SAR mensuales.

Este proceso cuesta entre USD 50.000 y USD 200.000 en setup, más costos operativos anuales.

---

## 8. Recursos

- **Superfinanciera Colombia:** https://www.superfinanciera.gov.co
- **UIAF:** https://www.uiaf.gov.co
- **FATF (estándares AML internacionales):** https://www.fatf-gafi.org
- **Chainalysis Crypto Crime Report:** https://www.chainalysis.com/reports
- **Bisq (open source P2P):** https://bisq.network
- **HodlHodl (legal):** https://hodlhodl.com
- **RoboSats (Tor-only):** https://github.com/RoboSats/robosats

---

**Última actualización:** 2026-08-22
**Jurisdicción de referencia:** Colombia (America/Bogota timezone)
**Consultor recomendado:** Buscar abogado con experiencia en "derecho fintech" o "derecho cripto" en Colombia.
