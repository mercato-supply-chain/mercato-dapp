# MERCATO

**Supply chain finance, transparently secured.**

MERCATO connects **PyMEs** (small and medium businesses), **investors**, and **suppliers** through blockchain-secured escrow on the [Stellar](https://stellar.org) network. Deals are funded in **USDC**, and suppliers get paid in **milestones** (e.g. 50% upfront, 50% on delivery)—all with non-custodial, on-chain transparency.

---

## Goal

- **PyMEs** get working capital to purchase inventory without traditional debt; investors fund the deal via escrow, and the PyME repays after their sales cycle (30–90 days).
- **Investors** earn yield (e.g. 8–15% APR) by funding short-term supply chain deals; funds sit in a smart contract until milestones are met.
- **Suppliers** get paid in stages (e.g. 50% on shipment, 50% on delivery proof) without waiting for buyer payment terms; payments are released from escrow when the PyME approves each milestone.

The platform does not custody funds: escrow is deployed and managed on Stellar via [Trustless Work](https://docs.trustlesswork.com/), so every transaction and milestone is verifiable on-chain.

---

## How It Works

1. **PyME creates a deal** — Product details, quantity, price, supplier, term (30–90 days), and payment milestones (e.g. 50/50). A Stellar escrow contract is deployed via Trustless Work; the PyME signs the deployment with their connected Stellar wallet.
2. **Investors fund the deal** — From the marketplace, investors fund the escrow in USDC. Funds are locked in the smart contract.
3. **Supplier delivers** — The supplier ships and submits delivery proof. The PyME (or platform) approves milestones; the contract releases payments to the supplier’s Stellar address.
4. **PyME repays** — After the term, the PyME repays investors (principal + yield) according to the deal terms.

User roles are **pyme**, **investor**, and **supplier**. Auth and profile data live in **Supabase**; deal and milestone data are stored there as well, with escrow state and payments on **Stellar**.

---

## Tech Stack

| Layer        | Technology |
|-------------|------------|
| Frontend    | [Next.js](https://nextjs.org) 16, [React](https://react.dev) 19, [Tailwind CSS](https://tailwindcss.com), [shadcn/ui](https://ui.shadcn.com) |
| Auth & DB   | [Supabase](https://supabase.com) (Auth, Postgres) |
| Escrow      | [Trustless Work](https://docs.trustlesswork.com/) API + Stellar |
| Wallets     | [Stellar Wallets Kit](https://stellarwalletskit.dev/) (e.g. Freighter, Albedo) |
| Styling     | Tailwind, next-themes (light/dark) |

---

## Project Structure

```
app/
  page.tsx              # Landing (hero, stakeholders, trust, CTA)
  how-it-works/         # Flow explanation
  marketplace/          # Browse and filter deals
  create-deal/          # PyME flow: deal basics → supplier & terms → milestones → deploy escrow
  auth/login, sign-up/  # Supabase auth
  dashboard/            # User dashboard (role-based)
  deals/[id]/           # Deal detail
  suppliers/            # Supplier directory
  settings/             # Profile (e.g. Stellar address)
components/
  navigation.tsx        # Header: nav links, connect wallet, user menu
  navigation/           # NavLinks, WalletNav, UserNav (composition)
  deal-card.tsx         # Marketplace deal card
lib/
  trustless/            # Trustless Work config, wallet kit, trustlines (USDC)
  supabase/             # Supabase client
  format.ts             # Currency / number formatting
providers/
  wallet-provider.tsx   # Global Stellar wallet state (connect/disconnect)
hooks/
  use-wallet.ts         # Connect wallet, disconnect, truncated address
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/) (or npm / yarn)
- [Supabase](https://supabase.com) project
- [Trustless Work](https://docs.trustlesswork.com/) API key and Stellar addresses (platform + trustline) for escrow

### 1. Clone and install

```bash
git clone <your-repo-url>
cd mercato
pnpm install
```

### 2. Environment variables

Copy the sample env and fill in your values:

```bash
cp env.sample .env.local
```

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (public) key |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key (if used) |
| `NEXT_PUBLIC_TRUSTLESS_WORK_API_KEY` | Trustless Work API key |
| `NEXT_PUBLIC_TRUSTLESS_NETWORK` | `testnet` or `mainnet` |
| `NEXT_PUBLIC_MERCATO_PLATFORM_ADDRESS` | Stellar address for the platform (escrow roles) |
| `NEXT_PUBLIC_TRUSTLESSLINE_ADDRESS` | USDC trustline contract address for escrow |

### 3. Run the app

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Use **auth**: `/auth/login`, `/auth/sign-up`. Connect a Stellar wallet (e.g. Freighter on testnet) to create deals or interact with escrow.

### 4. Build for production

```bash
pnpm build
pnpm start
```

---

## Main Features

- **Role-based flows**: PyME (create deal, approve milestones), Investor (browse/fund deals), Supplier (profile, delivery proof).
- **Connect Stellar wallet** in the header (Freighter, Albedo); required to create a deal and sign escrow deployment.
- **Create deal & deploy escrow**: Multi-step form (deal basics → supplier & terms → milestones); then deploy multi-release escrow via Trustless Work and sign with the connected wallet.
- **Non-custodial escrow**: Funds in USDC; milestone-based release to supplier; platform as release signer and dispute resolver.
- **Marketplace**: Browse deals (search, status, category); currently backed by mock data; can be wired to Supabase deals.
- **Dashboard**: Role-specific links (e.g. Create Deal, My Investments, Active Deals, Delivery Proof).
- **Settings**: Profile and Stellar address for PyMEs/suppliers so escrow can use the correct addresses.

---

## License

Private / unlicensed unless otherwise specified.
