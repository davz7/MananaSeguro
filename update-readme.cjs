const fs = require('fs');
const path = 'C:\\Users\\LI_PC\\.openclaw\\MananaSeguro\\README.md';
let content = fs.readFileSync(path, 'utf8');

const archStart = content.indexOf('## Architecture');
if (archStart < 0) { console.log('Architecture section not found'); process.exit(1); }

const afterArch = content.substring(archStart + 15);
const nextHeading = afterArch.indexOf('\n\n## ');
const archEnd = archStart + 15 + nextHeading;

const newArch = `## Architecture

### Project Structure

\`\`\`mermaid
graph TB
    subgraph Frontend["Frontend - CreditRoot"]
        React["React 19 + Vite + Bootstrap 5"]
        Features["src/features/ (dashboard, simulator, withdrawal)"]
        Screens["src/screens/ (Landing, Auth, Home, Dashboard)"]
        Lib["src/lib/ (stellar.js, wallet.js)"]
    end

    subgraph Bot["Telegram Bot"]
        BotPy["bot.py (handlers, AI advisory)"]
        StellarConn["stellar_connection.py"]
    end

    subgraph Serverless["Netlify Functions"]
        Auth["auth-google.js"]
        Rates["cetes-rate.js"]
        Deposit["etherfuse-deposit.js"]
        Onboard["etherfuse-onboarding.js"]
        Ramp["etherfuse-ramp.js"]
        Webhook["etherfuse-webhook.js"]
        FX["exchange-rate.js"]
        Metas["metas.js"]
        Orders["order-status.js"]
    end

    subgraph External["External Services"]
        Google["Google OAuth"]
        Etherfuse["Etherfuse API"]
        Banxico["Banxico SIE API"]
        Supabase["Supabase DB"]
        Stellar["Stellar Testnet"]
    end

    Frontend --> Serverless
    Serverless --> External
    Bot --> Stellar
    Bot --> Serverless
\`\`\`

### SPEI to Stellar Deposit Flow

\`\`\`mermaid
sequenceDiagram
    participant User as User
    participant Frontend as CreditRoot
    participant Deposit as etherfuse-deposit.js
    participant Etherfuse as Etherfuse API
    participant Webhook as etherfuse-webhook.js
    participant Supabase as Supabase

    User->>Frontend: Enter deposit amount (MXN)
    Frontend->>Deposit: POST /api/etherfuse/deposit
    Deposit->>Deposit: Verify KYC approved
    Deposit->>Etherfuse: POST /ramp/quote
    Etherfuse-->>Deposit: Quote (CETES rate + fees)
    Deposit->>Etherfuse: POST /ramp/order
    Etherfuse-->>Deposit: Order + CLABE account
    Deposit->>Supabase: INSERT ordenes
    Deposit-->>Frontend: Return CLABE + amount
    Frontend-->>User: Display bank transfer info

    User->>User: SPEI transfer via bank app
    User->>Etherfuse: Bank transfer to CLABE
    Etherfuse->>Webhook: POST webhook (order_updated)
    Webhook->>Webhook: Verify HMAC-SHA256 signature
    Webhook->>Supabase: UPDATE ordenes SET status
    Supabase-->>Frontend: Order status: completed
    Frontend-->>User: Deposit confirmed!
\`\`\`

### Order State Machine

\`\`\`mermaid
flowchart TD
    A[created] -->|Order generated| B[pending_payment]
    B -->|SPEI detected| C[payment_received]
    C -->|Confirmed| D[completed]
    B -->|Timeout 24h| E[expired]
    C -->|Verification failed| F[failed]
    B -->|User cancels| G[cancelled]
\`\`\`
`;

const newContent = content.substring(0, archStart) + newArch + content.substring(archEnd);
fs.writeFileSync(path, newContent, 'utf8');
console.log('README.md updated with 3 Mermaid diagrams');
console.log('File size: ' + newContent.length + ' bytes (was ' + content.length + ')');
