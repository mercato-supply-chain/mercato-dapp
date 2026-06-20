import type { BlogPost } from './types'

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'what-is-a-defindex-vault',
    publishedAt: '2026-06-04',
    readingTimeMinutes: 6,
    category: 'vault',
    audience: 'investor',
    tags: ['defindex', 'vault', 'usdc', 'yield', 'stellar'],
    en: {
      title: 'What Is a DeFindex Vault? A Plain-Language Guide',
      description:
        'Learn what a DeFindex vault is, how it holds your USDC, and why Mercato uses one — explained without crypto jargon.',
      excerpt:
        'Think of a vault as a shared, rule-based savings pool that puts idle dollars to work while you stay in control of your wallet.',
      sections: [
        {
          type: 'paragraph',
          text: 'If you have ever wondered why Mercato offers a “vault” alongside deal investing, you are not alone. Most people in supply chain finance have never touched crypto — and they should not need to in order to understand where their money sits and what it is doing.',
        },
        {
          type: 'heading',
          level: 2,
          text: 'The simple idea',
        },
        {
          type: 'paragraph',
          text: 'A DeFindex vault is a smart, automated pool that holds stablecoins (in Mercato’s case, USDC — digital dollars pegged to $1) and allocates them across pre-approved lending strategies on the Stellar network. You deposit USDC, receive vault shares (dfTokens) that represent your portion of the pool, and can withdraw when you need liquidity.',
        },
        {
          type: 'callout',
          title: 'No crypto degree required',
          text: 'You do not “trade” inside the vault. You deposit dollars, earn yield while they sit idle, and withdraw when you are ready to fund a deal or move cash back to your wallet.',
        },
        {
          type: 'heading',
          level: 2,
          text: 'How is this different from a bank savings account?',
        },
        {
          type: 'list',
          items: [
            'Transparency — balances and rules live on a public ledger anyone can audit.',
            'Non-custodial — Mercato never holds your private keys; you sign deposits and withdrawals from your own wallet.',
            'Programmable — the vault only moves funds according to its coded rules and approved strategies.',
            'Composable — yield earned in the vault can later flow into Mercato deal escrows when you invest.',
          ],
        },
        {
          type: 'heading',
          level: 2,
          text: 'Why Mercato uses a vault',
        },
        {
          type: 'paragraph',
          text: 'Investors on Mercato often have USDC sitting between deals — capital that is not yet allocated to a PyME purchase order. Instead of leaving that cash idle, the Mercato vault puts it to work in low-risk, on-chain lending markets while preserving quick access when a new deal appears.',
        },
        {
          type: 'heading',
          level: 2,
          text: 'What you actually own',
        },
        {
          type: 'paragraph',
          text: 'When you deposit $1,000 USDC, the vault mints dfTokens to your wallet. Those tokens are your receipt — they track your share of the total pool. If the pool grows from yield, your share is worth more USDC when you withdraw. If other investors also deposit, the pool is larger but your percentage share reflects exactly what you contributed.',
        },
        {
          type: 'faq',
          items: [
            {
              question: 'Is my money locked forever?',
              answer:
                'No. You can withdraw your share from the Mercato vault when liquidity is available. Withdrawals are initiated from your wallet, just like deposits.',
            },
            {
              question: 'Can Mercato take my funds?',
              answer:
                'Mercato cannot move vault funds on your behalf. Only your wallet signature authorizes deposits and withdrawals. The vault contract enforces the rules on-chain.',
            },
            {
              question: 'Is this the same as investing in a deal?',
              answer:
                'No. The vault is for idle USDC earning baseline yield. Deal investing funds a specific PyME escrow with its own term and return. Many investors use both: vault for parking cash, deals for targeted returns.',
            },
          ],
        },
      ],
    },
    es: {
      title: '¿Qué es un vault DeFindex? Guía en lenguaje claro',
      description:
        'Qué es un vault DeFindex, cómo guarda tu USDC y por qué Mercato lo usa — sin jerga crypto.',
      excerpt:
        'Un vault es un fondo compartido con reglas claras que pone dólares ociosos a trabajar mientras tú mantienes el control de tu billetera.',
      sections: [
        {
          type: 'paragraph',
          text: 'Si alguna vez te preguntaste por qué Mercato ofrece un “vault” además de invertir en órdenes, no estás solo. La mayoría de quienes operan en cadena de suministro nunca ha usado crypto — y no deberían necesitarlo para entender dónde está su dinero.',
        },
        {
          type: 'heading',
          level: 2,
          text: 'La idea simple',
        },
        {
          type: 'paragraph',
          text: 'Un vault DeFindex es un fondo automatizado que guarda stablecoins (en Mercato, USDC — dólares digitales anclados a $1) y las asigna a estrategias de préstamo aprobadas en Stellar. Depositas USDC, recibes participaciones del vault (dfTokens) y puedes retirar cuando necesites liquidez.',
        },
        {
          type: 'callout',
          title: 'Sin ser experto en crypto',
          text: 'No “operas” dentro del vault. Depositas dólares, ganas rendimiento mientras esperas, y retiras cuando quieras financiar una orden o volver a tu billetera.',
        },
        {
          type: 'heading',
          level: 2,
          text: '¿En qué se diferencia de una cuenta de ahorro?',
        },
        {
          type: 'list',
          items: [
            'Transparencia — saldos y reglas en un libro público auditable.',
            'No custodial — Mercato no guarda tus claves; tú firmas depósitos y retiros.',
            'Programable — el vault solo mueve fondos según reglas y estrategias aprobadas.',
            'Integrable — el rendimiento del vault puede pasar después a escrows de Mercato.',
          ],
        },
        {
          type: 'heading',
          level: 2,
          text: 'Por qué Mercato usa un vault',
        },
        {
          type: 'paragraph',
          text: 'Los inversionistas suelen tener USDC entre órdenes — capital aún no asignado. En lugar de dejarlo quieto, el vault de Mercato lo coloca en mercados de préstamo on-chain de bajo riesgo, con acceso rápido cuando aparece una nueva oportunidad.',
        },
        {
          type: 'faq',
          items: [
            {
              question: '¿Mi dinero queda bloqueado para siempre?',
              answer:
                'No. Puedes retirar tu participación cuando haya liquidez. Los retiros se inician desde tu billetera, igual que los depósitos.',
            },
            {
              question: '¿Mercato puede tomar mis fondos?',
              answer:
                'Mercato no puede mover fondos del vault por ti. Solo tu firma autoriza depósitos y retiros.',
            },
          ],
        },
      ],
    },
  },
  {
    slug: 'why-vaults-earn-yield',
    publishedAt: '2026-06-04',
    readingTimeMinutes: 7,
    category: 'vault',
    audience: 'investor',
    tags: ['yield', 'apy', 'defindex', 'lending', 'usdc'],
    en: {
      title: 'Why Do You Earn More Money in a Vault?',
      description:
        'Understand where vault yield comes from, why APY changes, and what risks non-crypto investors should know.',
      excerpt:
        'Vault yield is not magic — it is interest paid by borrowers who use the liquidity your USDC provides.',
      sections: [
        {
          type: 'paragraph',
          text: '“Why am I earning more just for parking money in the vault?” That is the right question. The answer is the same economic idea as a money-market fund or savings account — but with blockchain transparency and without a bank sitting in the middle.',
        },
        {
          type: 'heading',
          level: 2,
          text: 'Where the yield comes from',
        },
        {
          type: 'paragraph',
          text: 'When you deposit USDC into the Mercato DeFindex vault, the vault allocates that liquidity to approved DeFi lending strategies on Stellar. Borrowers pay interest to access that liquidity. A portion of that interest flows back to vault depositors — that is your yield.',
        },
        {
          type: 'list',
          ordered: true,
          items: [
            'You deposit USDC and receive dfTokens (your share of the pool).',
            'The vault deploys pooled USDC into lending markets via DeFindex strategies.',
            'Borrowers pay interest; the vault balance grows over time.',
            'Your dfTokens represent a larger USDC value when you withdraw.',
          ],
        },
        {
          type: 'heading',
          level: 2,
          text: 'Why APY goes up and down',
        },
        {
          type: 'paragraph',
          text: 'The displayed APY (Annual Percentage Yield) is an estimate based on recent strategy performance. It is not a guaranteed fixed rate like a CD. When demand to borrow USDC rises, rates tend to rise; when markets are quiet, rates fall. Mercato shows the current vault APY so you can compare idle cash vs. deal investments.',
        },
        {
          type: 'callout',
          title: 'Yield vs. deal returns',
          text: 'Vault yield is steady, pool-based income on idle cash. Deal investing targets higher, deal-specific returns but ties your capital to one PyME transaction for a defined term. They solve different jobs in your portfolio.',
        },
        {
          type: 'heading',
          level: 2,
          text: 'What about risk?',
        },
        {
          type: 'paragraph',
          text: 'No yield product is risk-free. Vault strategies carry smart-contract risk, market liquidity risk, and strategy-specific risk. DeFindex vaults use audited contracts and diversified strategies, but you should treat vault yield as incremental return on cash you already hold in USDC — not as a substitute for due diligence on deal investments.',
        },
        {
          type: 'faq',
          items: [
            {
              question: 'Do I need to claim yield manually?',
              answer:
                'No. Yield accrues inside the vault. Your share value increases; you realize gains when you withdraw USDC.',
            },
            {
              question: 'Why is my balance slightly different from what I deposited?',
              answer:
                'Small differences can reflect accrued yield, rounding, or timing between deposit and the next strategy rebalance. Your My Positions tab shows your current vault value and share of the pool.',
            },
            {
              question: 'Can I lose money?',
              answer:
                'Yes, in extreme scenarios (strategy failure, smart-contract exploit, or illiquidity). Mercato selects established DeFindex infrastructure, but all on-chain finance carries residual risk.',
            },
          ],
        },
      ],
    },
    es: {
      title: '¿Por qué ganas más dinero en un vault?',
      description:
        'De dónde sale el rendimiento del vault, por qué cambia el APY y qué riesgos debe conocer un inversionista sin experiencia crypto.',
      excerpt:
        'El rendimiento no es magia — es interés pagado por quienes piden prestada la liquidez que aporta tu USDC.',
      sections: [
        {
          type: 'paragraph',
          text: '“¿Por qué gano más solo por dejar dinero en el vault?” Es la pregunta correcta. La respuesta es la misma lógica que un fondo de mercado monetario — pero con transparencia blockchain y sin un banco intermediario.',
        },
        {
          type: 'heading',
          level: 2,
          text: 'De dónde sale el rendimiento',
        },
        {
          type: 'paragraph',
          text: 'Al depositar USDC en el vault DeFindex de Mercato, el fondo asigna esa liquidez a estrategias de préstamo aprobadas en Stellar. Los prestatarios pagan interés; parte vuelve a los depositantes — ese es tu rendimiento.',
        },
        {
          type: 'heading',
          level: 2,
          text: 'Por qué el APY sube y baja',
        },
        {
          type: 'paragraph',
          text: 'El APY mostrado es una estimación según el rendimiento reciente de las estrategias. No es una tasa fija garantizada. Cuando aumenta la demanda de préstamos en USDC, las tasas suelen subir; cuando el mercado está quieto, bajan.',
        },
        {
          type: 'faq',
          items: [
            {
              question: '¿Debo reclamar el rendimiento manualmente?',
              answer:
                'No. El rendimiento se acumula dentro del vault. Tu participación vale más en USDC al retirar.',
            },
          ],
        },
      ],
    },
  },
  {
    slug: 'how-mercato-vault-fits-your-investing',
    publishedAt: '2026-06-04',
    readingTimeMinutes: 5,
    category: 'guides',
    audience: 'investor',
    tags: ['mercato', 'investors', 'vault', 'deals', 'portfolio'],
    en: {
      title: 'How the Mercato Vault Fits Your Investing Workflow',
      description:
        'A practical guide for investors: park USDC in the vault between deals, track your share, and move capital into escrows when you are ready.',
      excerpt:
        'Use the vault as your liquid staging area — earn on idle USDC, then deploy into deals without leaving Mercato.',
      sections: [
        {
          type: 'paragraph',
          text: 'Mercato investors typically juggle two questions: “Where should idle USDC sit?” and “Which deal should I fund next?” The vault answers the first. Deal marketplace answers the second.',
        },
        {
          type: 'heading',
          level: 2,
          text: 'A simple workflow',
        },
        {
          type: 'list',
          ordered: true,
          items: [
            'On-ramp or transfer USDC to your Mercato-linked Stellar wallet.',
            'Deposit a portion into the Mercato vault to earn baseline yield.',
            'Monitor My Positions — see your vault value, share of the pool, and deposit history.',
            'When a deal matches your criteria, withdraw from the vault (or use wallet USDC) and fund the escrow.',
            'At repayment, principal and yield return to your wallet — optionally redeposit to the vault.',
          ],
        },
        {
          type: 'heading',
          level: 2,
          text: 'Reading “My Positions”',
        },
        {
          type: 'paragraph',
          text: 'The My Positions tab shows three things non-crypto users care about: how much is yours, how much belongs to other depositors in the same vault, and a ledger of your deposits and withdrawals. You always know what fraction of the pool you own — important when the vault holds capital from many investors.',
        },
        {
          type: 'callout',
          title: 'Shared pool, clear ownership',
          text: 'The vault TVL (total value locked) is the sum of everyone’s USDC. Your contribution and percentage are displayed separately so you never confuse pool size with personal balance.',
        },
        {
          type: 'heading',
          level: 2,
          text: 'When the vault is not enough',
        },
        {
          type: 'paragraph',
          text: 'Vault yield is designed for liquidity and steady incremental return. If you want higher, deal-specific returns tied to a PyME repayment, fund escrows on the marketplace. Mercato is built so both products coexist — vault for waiting, deals for deploying.',
        },
        {
          type: 'paragraph',
          text: 'Ready to try it? Connect your wallet, open Vaults in the dashboard, and start with a small deposit. You can always withdraw and compare your experience against traditional idle cash.',
        },
      ],
    },
    es: {
      title: 'Cómo encaja el vault de Mercato en tu forma de invertir',
      description:
        'Guía práctica: guarda USDC en el vault entre órdenes, sigue tu participación y mueve capital al escrow cuando estés listo.',
      excerpt:
        'Usa el vault como área de espera líquida — gana con USDC ocioso y luego despliega en órdenes sin salir de Mercato.',
      sections: [
        {
          type: 'paragraph',
          text: 'Los inversionistas en Mercato suelen preguntarse: “¿Dónde dejo USDC ocioso?” y “¿Qué orden financio después?”. El vault responde lo primero; el marketplace, lo segundo.',
        },
        {
          type: 'heading',
          level: 2,
          text: 'Flujo simple',
        },
        {
          type: 'list',
          ordered: true,
          items: [
            'Recibe USDC en tu billetera Stellar vinculada a Mercato.',
            'Deposita una parte en el vault de Mercato para rendimiento base.',
            'Revisa My Positions — valor, participación en el fondo e historial.',
            'Cuando una orden encaje, retira del vault y financia el escrow.',
            'Al reembolso, vuelve capital a tu billetera — opcionalmente redeposita.',
          ],
        },
        {
          type: 'paragraph',
          text: '¿Listo? Conecta tu billetera, abre Vaults en el panel y prueba con un depósito pequeño.',
        },
      ],
    },
  },
  {
    slug: 'how-to-create-your-first-deal-on-mercato',
    publishedAt: '2026-06-12',
    readingTimeMinutes: 6,
    category: 'platform',
    audience: 'pyme',
    tags: ['pyme', 'deals', 'create-deal', 'escrow', 'getting-started'],
    en: {
      title: 'How to Create Your First Deal on Mercato',
      description:
        'A step-by-step walkthrough for PyMEs: from opening the deal form to confirming your escrow on Stellar — no crypto background required.',
      excerpt:
        'Creating a deal is how you turn a supplier purchase order into investor-funded working capital. Here is the full flow, screen by screen.',
      sections: [
        {
          type: 'paragraph',
          text: 'A “deal” on Mercato is simply a structured request for working capital: you describe what you need to buy, who your supplier is, and how you will repay. Investors fund it, the money sits in escrow, and your supplier gets paid as delivery milestones are approved. This guide walks you through creating your first one.',
        },
        {
          type: 'callout',
          title: 'Before you start',
          text: 'Have your supplier details, the purchase amount, your repayment term, and a connected Stellar wallet ready. You will sign the escrow deployment with your wallet at the end, so the deal is explicit and on-chain.',
        },
        {
          type: 'heading',
          level: 2,
          text: 'Step 1 — Open the deal form',
        },
        {
          type: 'paragraph',
          text: 'From your dashboard, go to Create Deal (or open /create-deal directly). The form is split into clear stages so you never face a wall of fields: deal basics, supplier and terms, milestones, then review and deploy.',
        },
        {
          type: 'heading',
          level: 2,
          text: 'Step 2 — Deal basics and supplier terms',
        },
        {
          type: 'list',
          ordered: true,
          items: [
            'Describe the product or inventory you are financing and the total purchase price.',
            'Add your supplier’s name and their Stellar address so milestone payments reach them directly.',
            'Set the repayment term (for example 30, 60, or 90 days) and the return you are offering investors.',
          ],
        },
        {
          type: 'heading',
          level: 2,
          text: 'Step 3 — Split payment into milestones',
        },
        {
          type: 'paragraph',
          text: 'Milestones protect everyone. Instead of paying the supplier 100% upfront, you split payment into stages tied to proof of progress — for example 50% on shipment and 50% on delivery. Funds for each milestone only release once the milestone is approved.',
        },
        {
          type: 'heading',
          level: 2,
          text: 'Step 4 — Review, sign, and deploy escrow',
        },
        {
          type: 'paragraph',
          text: 'Review the summary, then connect and sign with your wallet. Signing deploys a Trustless Work escrow contract on Stellar. From that moment your deal is live: investors can fund it, and capital stays locked in the contract until milestones justify release.',
        },
        {
          type: 'faq',
          items: [
            {
              question: 'Do I pay anything to create a deal?',
              answer:
                'Creating a deal does not move your own capital — investors fund the escrow. You will sign a wallet transaction to deploy the contract, which carries only the small Stellar network fee.',
            },
            {
              question: 'What if no investor funds my deal?',
              answer:
                'The escrow simply stays unfunded and no money moves. You can adjust your terms (amount, return, or milestones) to make the deal more attractive and try again.',
            },
            {
              question: 'Can I edit a deal after deploying it?',
              answer:
                'Core terms are locked on-chain once deployed, which is what makes them trustworthy to investors. If terms need to change materially, create a new deal with the updated structure.',
            },
          ],
        },
      ],
    },
    es: {
      title: 'Cómo crear tu primera orden en Mercato',
      description:
        'Guía paso a paso para PyMEs: desde abrir el formulario hasta confirmar tu escrow en Stellar — sin necesidad de experiencia crypto.',
      excerpt:
        'Crear una orden es cómo conviertes una compra a tu proveedor en capital de trabajo financiado por inversionistas. Aquí está el flujo completo, pantalla por pantalla.',
      sections: [
        {
          type: 'paragraph',
          text: 'Una “orden” en Mercato es una solicitud estructurada de capital de trabajo: describes qué necesitas comprar, quién es tu proveedor y cómo vas a pagar. Los inversionistas la financian, el dinero queda en escrow y tu proveedor cobra a medida que se aprueban los hitos de entrega. Esta guía te lleva a crear la primera.',
        },
        {
          type: 'callout',
          title: 'Antes de empezar',
          text: 'Ten a mano los datos de tu proveedor, el monto de compra, tu plazo de pago y una billetera Stellar conectada. Al final firmarás el despliegue del escrow con tu billetera, para que la orden quede explícita y on-chain.',
        },
        {
          type: 'heading',
          level: 2,
          text: 'Paso 1 — Abre el formulario de orden',
        },
        {
          type: 'paragraph',
          text: 'Desde tu panel, entra a Crear Orden (o abre /create-deal directamente). El formulario está dividido en etapas claras para que nunca enfrentes un muro de campos: datos de la orden, proveedor y términos, hitos, y luego revisión y despliegue.',
        },
        {
          type: 'heading',
          level: 2,
          text: 'Paso 2 — Datos de la orden y términos del proveedor',
        },
        {
          type: 'list',
          ordered: true,
          items: [
            'Describe el producto o inventario que financias y el precio total de compra.',
            'Agrega el nombre de tu proveedor y su dirección Stellar para que los pagos por hito le lleguen directamente.',
            'Define el plazo de pago (por ejemplo 30, 60 o 90 días) y el rendimiento que ofreces a los inversionistas.',
          ],
        },
        {
          type: 'heading',
          level: 2,
          text: 'Paso 3 — Divide el pago en hitos',
        },
        {
          type: 'paragraph',
          text: 'Los hitos protegen a todos. En vez de pagar al proveedor el 100% por adelantado, divides el pago en etapas ligadas a prueba de avance — por ejemplo 50% al envío y 50% a la entrega. Los fondos de cada hito solo se liberan cuando ese hito se aprueba.',
        },
        {
          type: 'heading',
          level: 2,
          text: 'Paso 4 — Revisa, firma y despliega el escrow',
        },
        {
          type: 'paragraph',
          text: 'Revisa el resumen, luego conecta y firma con tu billetera. Firmar despliega un contrato de escrow de Trustless Work en Stellar. Desde ese momento tu orden está activa: los inversionistas pueden financiarla y el capital queda bloqueado en el contrato hasta que los hitos justifiquen su liberación.',
        },
        {
          type: 'faq',
          items: [
            {
              question: '¿Pago algo por crear una orden?',
              answer:
                'Crear una orden no mueve tu propio capital — los inversionistas financian el escrow. Firmarás una transacción de billetera para desplegar el contrato, que solo implica la pequeña comisión de la red Stellar.',
            },
            {
              question: '¿Qué pasa si ningún inversionista financia mi orden?',
              answer:
                'El escrow simplemente queda sin financiar y no se mueve dinero. Puedes ajustar tus términos (monto, rendimiento o hitos) para hacerla más atractiva e intentarlo de nuevo.',
            },
            {
              question: '¿Puedo editar una orden después de desplegarla?',
              answer:
                'Los términos centrales quedan bloqueados on-chain al desplegarse, y eso es lo que los hace confiables para los inversionistas. Si los términos deben cambiar de forma importante, crea una nueva orden con la estructura actualizada.',
            },
          ],
        },
      ],
    },
  },
  {
    slug: 'what-is-purchase-order-financing',
    publishedAt: '2026-06-11',
    readingTimeMinutes: 6,
    category: 'platform',
    audience: 'pyme',
    tags: ['pyme', 'po-financing', 'working-capital', 'sme', 'cash-flow'],
    en: {
      title: 'What Is Purchase Order Financing and How Does It Help Your Business?',
      description:
        'A plain-language explainer of purchase order (PO) financing for SME owners — what it is, when to use it, and how it frees up cash flow.',
      excerpt:
        'PO financing lets you accept and fulfill orders you could not otherwise afford to stock — without draining your cash or taking on a traditional loan.',
      sections: [
        {
          type: 'paragraph',
          text: 'Many small and medium businesses lose orders not because demand is missing, but because they cannot front the cash to buy inventory before they get paid by their own customers. Purchase order financing solves exactly that gap.',
        },
        {
          type: 'heading',
          level: 2,
          text: 'The core idea',
        },
        {
          type: 'paragraph',
          text: 'Purchase order financing is short-term working capital tied to a specific purchase you need to make from a supplier. Instead of borrowing against your balance sheet, the funding is attached to one clear transaction: buy this inventory now, sell it, then repay from the proceeds.',
        },
        {
          type: 'heading',
          level: 2,
          text: 'How it helps a PyME',
        },
        {
          type: 'list',
          items: [
            'You can accept larger orders without waiting to save up the full purchase cost.',
            'Your cash stays available for payroll, rent, and day-to-day operations.',
            'Repayment is aligned to your sales cycle — typically 30 to 90 days — instead of an open-ended debt.',
            'Terms are agreed up front, so there are no moving targets.',
          ],
        },
        {
          type: 'heading',
          level: 2,
          text: 'How Mercato does it differently',
        },
        {
          type: 'paragraph',
          text: 'On Mercato, the financing for your purchase order comes from investors who fund a specific, disclosed deal — not from an opaque lender. The capital sits in an on-chain escrow and is released to your supplier in milestones as delivery is proven. You get transparency on where the money is, and your supplier gets the confidence of contract-enforced payment.',
        },
        {
          type: 'callout',
          title: 'Not a traditional loan',
          text: 'There is no balance-sheet lending or hidden fees. Each deal stands on its own terms, the rules are visible on a public ledger, and funds only move according to the contract.',
        },
        {
          type: 'faq',
          items: [
            {
              question: 'Is PO financing the same as a bank loan?',
              answer:
                'No. A bank loan is usually tied to your overall creditworthiness and balance sheet. PO financing is tied to one specific purchase and repaid from the sales it enables.',
            },
            {
              question: 'When should I use it?',
              answer:
                'When you have a confirmed need to buy inventory and a clear path to repay after your sales cycle, but you do not want to drain your cash reserves to do it.',
            },
            {
              question: 'What does it cost me?',
              answer:
                'You agree a return for investors up front as part of the deal terms. Because each deal is disclosed and milestone-based, you know the full cost before you deploy the escrow.',
            },
          ],
        },
      ],
    },
    es: {
      title: '¿Qué es el financiamiento de órdenes de compra y cómo ayuda a tu negocio?',
      description:
        'Explicación en lenguaje claro del financiamiento de órdenes de compra para dueños de PyMEs — qué es, cuándo usarlo y cómo libera tu flujo de caja.',
      excerpt:
        'El financiamiento de órdenes de compra te permite aceptar y surtir pedidos que de otro modo no podrías costear — sin agotar tu efectivo ni pedir un préstamo tradicional.',
      sections: [
        {
          type: 'paragraph',
          text: 'Muchas pequeñas y medianas empresas pierden pedidos no por falta de demanda, sino porque no pueden adelantar el efectivo para comprar inventario antes de que sus propios clientes les paguen. El financiamiento de órdenes de compra resuelve justamente ese hueco.',
        },
        {
          type: 'heading',
          level: 2,
          text: 'La idea central',
        },
        {
          type: 'paragraph',
          text: 'El financiamiento de órdenes de compra es capital de trabajo de corto plazo ligado a una compra específica que necesitas hacer a un proveedor. En lugar de endeudarte contra tu balance, el financiamiento se ata a una transacción clara: compra este inventario ahora, véndelo y paga con lo recaudado.',
        },
        {
          type: 'heading',
          level: 2,
          text: 'Cómo ayuda a una PyME',
        },
        {
          type: 'list',
          items: [
            'Puedes aceptar pedidos más grandes sin esperar a ahorrar todo el costo de compra.',
            'Tu efectivo queda disponible para nómina, renta y operación diaria.',
            'El pago se alinea a tu ciclo de ventas — típicamente de 30 a 90 días — en vez de una deuda abierta.',
            'Los términos se acuerdan por adelantado, así que no hay sorpresas.',
          ],
        },
        {
          type: 'heading',
          level: 2,
          text: 'Cómo lo hace distinto Mercato',
        },
        {
          type: 'paragraph',
          text: 'En Mercato, el financiamiento de tu orden de compra proviene de inversionistas que financian una orden específica y transparente — no de un prestamista opaco. El capital queda en un escrow on-chain y se libera a tu proveedor por hitos a medida que se prueba la entrega. Tú obtienes transparencia sobre dónde está el dinero y tu proveedor la confianza de un pago respaldado por contrato.',
        },
        {
          type: 'callout',
          title: 'No es un préstamo tradicional',
          text: 'No hay préstamo contra balance ni comisiones ocultas. Cada orden se sostiene en sus propios términos, las reglas son visibles en un libro público y los fondos solo se mueven según el contrato.',
        },
        {
          type: 'faq',
          items: [
            {
              question: '¿Es lo mismo que un préstamo bancario?',
              answer:
                'No. Un préstamo bancario suele atarse a tu historial crediticio y tu balance general. El financiamiento de órdenes se ata a una compra específica y se paga con las ventas que habilita.',
            },
            {
              question: '¿Cuándo debo usarlo?',
              answer:
                'Cuando tienes una necesidad confirmada de comprar inventario y un camino claro para pagar tras tu ciclo de ventas, pero no quieres agotar tus reservas de efectivo para lograrlo.',
            },
            {
              question: '¿Cuánto me cuesta?',
              answer:
                'Acuerdas un rendimiento para los inversionistas por adelantado como parte de los términos. Como cada orden es transparente y por hitos, conoces el costo total antes de desplegar el escrow.',
            },
          ],
        },
      ],
    },
  },
  {
    slug: 'what-does-blockchain-escrow-mean-for-your-business',
    publishedAt: '2026-06-10',
    readingTimeMinutes: 5,
    category: 'platform',
    audience: 'pyme',
    tags: ['pyme', 'escrow', 'trustless-work', 'stellar', 'trust'],
    en: {
      title: 'What Does Blockchain Escrow Mean for Your Business?',
      description:
        'Why Mercato uses a smart-contract escrow instead of a traditional bank transfer — and what that means for a PyME in practical terms.',
      excerpt:
        'Blockchain escrow is just a neutral, rule-based holding account that no single party can raid. Here is why that protects your business.',
      sections: [
        {
          type: 'paragraph',
          text: 'The word “blockchain” can sound intimidating, but the escrow behind a Mercato deal does something very familiar: it holds money in the middle until agreed conditions are met. The difference is that the rules are enforced by code on a public ledger, not by a bank’s back office.',
        },
        {
          type: 'heading',
          level: 2,
          text: 'What escrow means here',
        },
        {
          type: 'paragraph',
          text: 'When investors fund your deal, their USDC does not land in Mercato’s bank account or yours. It goes into a Trustless Work escrow contract on Stellar. The contract holds the funds and only releases them to your supplier when a delivery milestone is approved.',
        },
        {
          type: 'heading',
          level: 2,
          text: 'Why this protects everyone',
        },
        {
          type: 'list',
          items: [
            'Non-custodial — Mercato never holds or can divert the deal funds; only the contract rules move money.',
            'Transparent — anyone can verify the balance and the release history on-chain.',
            'Milestone-based — your supplier is paid in stages as work is proven, reducing the risk of paying for undelivered goods.',
            'Predictable — the release conditions are fixed when the escrow is deployed, so no one can quietly change the terms.',
          ],
        },
        {
          type: 'callout',
          title: 'Trust without a middleman taking your money',
          text: 'A traditional transfer asks you to trust whoever holds the cash. An on-chain escrow replaces that trust with verifiable rules — the money is visible and only moves the way the contract says.',
        },
        {
          type: 'heading',
          level: 2,
          text: 'What you actually have to do',
        },
        {
          type: 'paragraph',
          text: 'In practice, you connect a wallet, sign once to deploy the escrow when you create the deal, and later approve milestones as your supplier delivers. You do not need to understand the cryptography — just that the money is held under clear, unchangeable rules until delivery is proven.',
        },
        {
          type: 'faq',
          items: [
            {
              question: 'Can Mercato take the funds in escrow?',
              answer:
                'No. The escrow is non-custodial. Funds move only according to the contract’s milestone rules, authorized by the right signatures — not by Mercato unilaterally.',
            },
            {
              question: 'What is USDC?',
              answer:
                'USDC is a digital dollar pegged to $1. Deals settle in USDC on Stellar so values stay stable and transfers are fast and low-cost.',
            },
          ],
        },
      ],
    },
    es: {
      title: '¿Qué significa el escrow en blockchain para tu negocio?',
      description:
        'Por qué Mercato usa un escrow con contrato inteligente en vez de una transferencia bancaria tradicional — y qué significa para una PyME en términos prácticos.',
      excerpt:
        'El escrow en blockchain es solo una cuenta neutral basada en reglas que ninguna parte puede vaciar. Aquí está por qué eso protege a tu negocio.',
      sections: [
        {
          type: 'paragraph',
          text: 'La palabra “blockchain” puede sonar intimidante, pero el escrow detrás de una orden en Mercato hace algo muy familiar: retiene el dinero en medio hasta que se cumplen las condiciones acordadas. La diferencia es que las reglas las hace cumplir el código en un libro público, no el área administrativa de un banco.',
        },
        {
          type: 'heading',
          level: 2,
          text: 'Qué significa escrow aquí',
        },
        {
          type: 'paragraph',
          text: 'Cuando los inversionistas financian tu orden, su USDC no llega a la cuenta bancaria de Mercato ni a la tuya. Entra a un contrato de escrow de Trustless Work en Stellar. El contrato retiene los fondos y solo los libera a tu proveedor cuando se aprueba un hito de entrega.',
        },
        {
          type: 'heading',
          level: 2,
          text: 'Por qué esto protege a todos',
        },
        {
          type: 'list',
          items: [
            'No custodial — Mercato nunca retiene ni puede desviar los fondos de la orden; solo las reglas del contrato mueven el dinero.',
            'Transparente — cualquiera puede verificar el saldo y el historial de liberaciones on-chain.',
            'Por hitos — tu proveedor cobra en etapas a medida que se prueba el trabajo, reduciendo el riesgo de pagar por bienes no entregados.',
            'Predecible — las condiciones de liberación quedan fijas al desplegar el escrow, así nadie puede cambiar los términos en silencio.',
          ],
        },
        {
          type: 'callout',
          title: 'Confianza sin que un intermediario tome tu dinero',
          text: 'Una transferencia tradicional te pide confiar en quien guarda el efectivo. Un escrow on-chain reemplaza esa confianza con reglas verificables — el dinero es visible y solo se mueve como dice el contrato.',
        },
        {
          type: 'heading',
          level: 2,
          text: 'Qué tienes que hacer en realidad',
        },
        {
          type: 'paragraph',
          text: 'En la práctica, conectas una billetera, firmas una vez para desplegar el escrow al crear la orden, y luego apruebas los hitos a medida que tu proveedor entrega. No necesitas entender la criptografía — solo que el dinero queda retenido bajo reglas claras e inmutables hasta que se prueba la entrega.',
        },
        {
          type: 'faq',
          items: [
            {
              question: '¿Mercato puede tomar los fondos del escrow?',
              answer:
                'No. El escrow es no custodial. Los fondos se mueven solo según las reglas de hitos del contrato, autorizadas por las firmas correctas — no por Mercato de forma unilateral.',
            },
            {
              question: '¿Qué es USDC?',
              answer:
                'USDC es un dólar digital anclado a $1. Las órdenes se liquidan en USDC sobre Stellar para que los valores se mantengan estables y las transferencias sean rápidas y de bajo costo.',
            },
          ],
        },
      ],
    },
  },
  {
    slug: 'how-to-set-up-your-supplier-profile-on-mercato',
    publishedAt: '2026-06-15',
    readingTimeMinutes: 6,
    category: 'platform',
    audience: 'supplier',
    tags: ['supplier', 'proveedor', 'profile', 'catalog', 'verification'],
    en: {
      title: 'How to Set Up Your Supplier Profile on Mercato',
      description:
        'A walkthrough for suppliers: complete your public profile, build a product catalog, upload your logo, and get verified so PyMEs can find and trust you.',
      excerpt:
        'Your supplier profile is your storefront on Mercato. A complete, verified profile is what turns a browsing PyME into a purchase order.',
      sections: [
        {
          type: 'paragraph',
          text: 'Suppliers (proveedores) on Mercato are discovered by PyMEs looking for someone to fulfill an order. Your profile is the first thing they see — and a complete, credible one is what earns their trust before a single message is exchanged.',
        },
        {
          type: 'heading',
          level: 2,
          text: 'Step 1 — Complete your public profile',
        },
        {
          type: 'paragraph',
          text: 'Open your dashboard and go to Supplier Profile. Fill in your company name, a clear description of what you supply, your location, and the categories you serve. Write for a buyer who has never heard of you: what do you make, for whom, and why are you reliable?',
        },
        {
          type: 'heading',
          level: 2,
          text: 'Step 2 — Upload your logo',
        },
        {
          type: 'paragraph',
          text: 'Add your company logo. A recognizable logo makes your profile look established and helps PyMEs remember you when they compare suppliers side by side. Use a square, high-contrast image so it renders cleanly across the app.',
        },
        {
          type: 'heading',
          level: 2,
          text: 'Step 3 — Build your product catalog',
        },
        {
          type: 'list',
          ordered: true,
          items: [
            'Add each product with a clear name and a short, specific description.',
            'Include pricing or pricing ranges so buyers can gauge fit quickly.',
            'Upload product images — clear photos dramatically increase buyer confidence.',
            'Keep the catalog current; remove items you can no longer supply.',
          ],
        },
        {
          type: 'heading',
          level: 2,
          text: 'Step 4 — Get verified',
        },
        {
          type: 'paragraph',
          text: 'Complete the verification step so your profile carries a trust signal. Verified suppliers stand out to PyMEs and to investors evaluating the deals you are part of, because verification reduces the perceived risk of the transaction.',
        },
        {
          type: 'callout',
          title: 'Completeness is credibility',
          text: 'A half-filled profile reads as a half-serious business. Logo, full description, priced catalog with images, and verification together make you the obvious choice.',
        },
        {
          type: 'faq',
          items: [
            {
              question: 'Is my profile public?',
              answer:
                'Yes — that is the point. PyMEs browse supplier profiles to decide who to work with, so make yours clear, accurate, and complete.',
            },
            {
              question: 'How often should I update it?',
              answer:
                'Review your catalog and pricing whenever they change. An up-to-date profile avoids wasted conversations about products you no longer offer.',
            },
          ],
        },
      ],
    },
    es: {
      title: 'Cómo configurar tu perfil de proveedor en Mercato',
      description:
        'Guía para proveedores: completa tu perfil público, arma tu catálogo de productos, sube tu logo y verifícate para que las PyMEs te encuentren y confíen en ti.',
      excerpt:
        'Tu perfil de proveedor es tu escaparate en Mercato. Un perfil completo y verificado es lo que convierte a una PyME que navega en una orden de compra.',
      sections: [
        {
          type: 'paragraph',
          text: 'A los proveedores en Mercato los descubren PyMEs que buscan a alguien para surtir una orden. Tu perfil es lo primero que ven — y uno completo y creíble es lo que gana su confianza antes de intercambiar un solo mensaje.',
        },
        {
          type: 'heading',
          level: 2,
          text: 'Paso 1 — Completa tu perfil público',
        },
        {
          type: 'paragraph',
          text: 'Abre tu panel y entra a Perfil de Proveedor. Llena el nombre de tu empresa, una descripción clara de lo que ofreces, tu ubicación y las categorías que atiendes. Escribe pensando en un comprador que nunca te ha oído: ¿qué fabricas, para quién y por qué eres confiable?',
        },
        {
          type: 'heading',
          level: 2,
          text: 'Paso 2 — Sube tu logo',
        },
        {
          type: 'paragraph',
          text: 'Agrega el logo de tu empresa. Un logo reconocible hace que tu perfil se vea establecido y ayuda a que las PyMEs te recuerden al comparar proveedores. Usa una imagen cuadrada y de alto contraste para que se vea limpia en toda la app.',
        },
        {
          type: 'heading',
          level: 2,
          text: 'Paso 3 — Arma tu catálogo de productos',
        },
        {
          type: 'list',
          ordered: true,
          items: [
            'Agrega cada producto con un nombre claro y una descripción breve y específica.',
            'Incluye precios o rangos de precio para que los compradores evalúen rápido si encajas.',
            'Sube imágenes de producto — las fotos claras aumentan mucho la confianza del comprador.',
            'Mantén el catálogo al día; quita los productos que ya no puedas surtir.',
          ],
        },
        {
          type: 'heading',
          level: 2,
          text: 'Paso 4 — Verifícate',
        },
        {
          type: 'paragraph',
          text: 'Completa el paso de verificación para que tu perfil lleve una señal de confianza. Los proveedores verificados destacan ante las PyMEs y ante los inversionistas que evalúan las órdenes en las que participas, porque la verificación reduce el riesgo percibido de la transacción.',
        },
        {
          type: 'callout',
          title: 'Lo completo es credibilidad',
          text: 'Un perfil a medio llenar se lee como un negocio a medias. Logo, descripción completa, catálogo con precios e imágenes, y verificación: juntos te vuelven la opción obvia.',
        },
        {
          type: 'faq',
          items: [
            {
              question: '¿Mi perfil es público?',
              answer:
                'Sí — ese es el punto. Las PyMEs navegan perfiles de proveedores para decidir con quién trabajar, así que haz el tuyo claro, preciso y completo.',
            },
            {
              question: '¿Cada cuánto debo actualizarlo?',
              answer:
                'Revisa tu catálogo y precios cada vez que cambien. Un perfil al día evita conversaciones perdidas sobre productos que ya no ofreces.',
            },
          ],
        },
      ],
    },
  },
  {
    slug: 'how-to-showcase-your-products-to-attract-pyme-buyers',
    publishedAt: '2026-06-14',
    readingTimeMinutes: 5,
    category: 'platform',
    audience: 'supplier',
    tags: ['supplier', 'proveedor', 'products', 'catalog', 'best-practices'],
    en: {
      title: 'How to Showcase Your Products to Attract PyME Buyers',
      description:
        'Best practices for product descriptions, images, and pricing that help suppliers win purchase order deals on Mercato.',
      excerpt:
        'PyMEs choose suppliers they can evaluate quickly and trust. Clear descriptions, honest pricing, and good photos do most of the selling for you.',
      sections: [
        {
          type: 'paragraph',
          text: 'On Mercato, a PyME deciding who to source from is often comparing several suppliers at once. The ones who present their products clearly win the deal — not necessarily the cheapest. Here is how to make your catalog do the work.',
        },
        {
          type: 'heading',
          level: 2,
          text: 'Write descriptions a buyer can act on',
        },
        {
          type: 'list',
          items: [
            'Lead with what the product is and who it is for, in one sentence.',
            'Include the specifics that matter: materials, dimensions, capacity, certifications, minimum order quantity.',
            'Avoid vague claims like “best quality” — state facts a buyer can verify.',
            'Note lead times and whether you can scale volume, since that shapes a PyME’s deal.',
          ],
        },
        {
          type: 'heading',
          level: 2,
          text: 'Use images that build confidence',
        },
        {
          type: 'paragraph',
          text: 'Photos are the fastest trust signal you have. Use well-lit images on a clean background, show the product from more than one angle, and include something for scale where size matters. Real photos of your actual product beat stock imagery every time.',
        },
        {
          type: 'heading',
          level: 2,
          text: 'Price with clarity',
        },
        {
          type: 'paragraph',
          text: 'Show pricing or a clear range. Buyers planning a purchase order need to estimate their total cost up front. Transparent pricing filters in serious buyers and filters out time-wasting back-and-forth.',
        },
        {
          type: 'callout',
          title: 'You are also pitching investors',
          text: 'When a PyME builds a deal around your products, investors evaluate it too. A clear, credible catalog makes the whole deal easier to fund — which means you get paid faster.',
        },
        {
          type: 'faq',
          items: [
            {
              question: 'How many products should I list?',
              answer:
                'List the products you can reliably supply, presented well. A focused, accurate catalog beats a long list of items you cannot consistently deliver.',
            },
            {
              question: 'Should I show my lowest price?',
              answer:
                'Show honest, sustainable pricing. Winning a deal you cannot fulfill profitably hurts your reputation and the milestone-based payments tied to delivery.',
            },
          ],
        },
      ],
    },
    es: {
      title: 'Cómo mostrar tus productos para atraer compradores PyME',
      description:
        'Buenas prácticas de descripciones, imágenes y precios que ayudan a los proveedores a ganar órdenes de compra en Mercato.',
      excerpt:
        'Las PyMEs eligen proveedores que pueden evaluar rápido y en quienes pueden confiar. Descripciones claras, precios honestos y buenas fotos venden por ti.',
      sections: [
        {
          type: 'paragraph',
          text: 'En Mercato, una PyME que decide a quién comprarle suele comparar varios proveedores a la vez. Los que presentan sus productos con claridad ganan la orden — no necesariamente el más barato. Así haces que tu catálogo trabaje por ti.',
        },
        {
          type: 'heading',
          level: 2,
          text: 'Escribe descripciones sobre las que un comprador pueda actuar',
        },
        {
          type: 'list',
          items: [
            'Empieza diciendo qué es el producto y para quién, en una sola frase.',
            'Incluye lo que importa: materiales, dimensiones, capacidad, certificaciones, pedido mínimo.',
            'Evita frases vagas como “la mejor calidad” — da datos que el comprador pueda verificar.',
            'Indica tiempos de entrega y si puedes escalar volumen, porque eso define la orden de una PyME.',
          ],
        },
        {
          type: 'heading',
          level: 2,
          text: 'Usa imágenes que generen confianza',
        },
        {
          type: 'paragraph',
          text: 'Las fotos son la señal de confianza más rápida que tienes. Usa imágenes bien iluminadas con fondo limpio, muestra el producto desde más de un ángulo e incluye una referencia de escala cuando el tamaño importe. Las fotos reales de tu producto siempre superan a las imágenes de banco.',
        },
        {
          type: 'heading',
          level: 2,
          text: 'Pon precios con claridad',
        },
        {
          type: 'paragraph',
          text: 'Muestra el precio o un rango claro. Quien planea una orden de compra necesita estimar su costo total por adelantado. Un precio transparente atrae a los compradores serios y evita el ida y vuelta que hace perder tiempo.',
        },
        {
          type: 'callout',
          title: 'También le presentas a los inversionistas',
          text: 'Cuando una PyME arma una orden con tus productos, los inversionistas también la evalúan. Un catálogo claro y creíble hace más fácil financiar toda la orden — lo que significa que cobras más rápido.',
        },
        {
          type: 'faq',
          items: [
            {
              question: '¿Cuántos productos debo listar?',
              answer:
                'Lista los productos que puedes surtir de forma confiable, bien presentados. Un catálogo enfocado y preciso supera a una lista larga de artículos que no puedes entregar siempre.',
            },
            {
              question: '¿Debo mostrar mi precio más bajo?',
              answer:
                'Muestra precios honestos y sostenibles. Ganar una orden que no puedes cumplir con rentabilidad daña tu reputación y los pagos por hito ligados a la entrega.',
            },
          ],
        },
      ],
    },
  },
  {
    slug: 'how-purchase-order-deals-work-supplier-perspective',
    publishedAt: '2026-06-13',
    readingTimeMinutes: 6,
    category: 'platform',
    audience: 'supplier',
    tags: ['supplier', 'proveedor', 'deals', 'milestones', 'escrow'],
    en: {
      title: 'How Purchase Order Deals Work — A Supplier’s Perspective',
      description:
        'Follow a Mercato deal from the supplier’s point of view: from the PyME creating it to milestone-based payment release via escrow.',
      excerpt:
        'As a supplier, you get partial payment up front and the rest as you deliver — with funds secured in escrow before you ship a thing.',
      sections: [
        {
          type: 'paragraph',
          text: 'The biggest risk for a supplier is financing the buyer’s payment delay — shipping goods and then waiting weeks to get paid. Mercato’s milestone deals are designed to remove that risk. Here is what the flow looks like from your side.',
        },
        {
          type: 'heading',
          level: 2,
          text: 'Step 1 — A PyME creates the deal',
        },
        {
          type: 'paragraph',
          text: 'A PyME builds a deal around a purchase from you: the products, the amount, your Stellar address for payment, and the milestone split (for example 50% on shipment, 50% on delivery). They sign with their wallet to deploy an escrow contract on Stellar.',
        },
        {
          type: 'heading',
          level: 2,
          text: 'Step 2 — Investors fund the escrow',
        },
        {
          type: 'paragraph',
          text: 'Investors commit USDC into the deal’s escrow. This is the key protection for you: the money that will pay you is locked in the contract before you ship, not sitting in the buyer’s account hoping they pay later.',
        },
        {
          type: 'heading',
          level: 2,
          text: 'Step 3 — You deliver against milestones',
        },
        {
          type: 'list',
          ordered: true,
          items: [
            'Fulfill the first milestone (for example, ship the goods) and provide proof.',
            'Once it is approved, the contract releases that milestone’s payment to your Stellar address.',
            'Complete the next milestone (for example, confirmed delivery) and provide proof.',
            'On approval, the remaining payment is released to you.',
          ],
        },
        {
          type: 'callout',
          title: 'Partial pay up front, secured rest',
          text: 'You are not stuck financing the entire delay. You get paid in stages as you prove progress, and the funds were secured in escrow before you committed inventory.',
        },
        {
          type: 'heading',
          level: 2,
          text: 'Why approvals exist',
        },
        {
          type: 'paragraph',
          text: 'Milestone approvals (by the PyME, and where enabled an admin for oversight or disputes) are what make investors comfortable funding the deal. They confirm that delivery actually happened before money moves — which is the same proof that protects you from disputes about whether you performed.',
        },
        {
          type: 'faq',
          items: [
            {
              question: 'When do I actually get paid?',
              answer:
                'As each milestone is approved. The escrow releases that portion to your Stellar address automatically under the contract rules — no manual transfer from the buyer.',
            },
            {
              question: 'What if there is a dispute?',
              answer:
                'Because funds sit in a neutral escrow with milestone proof, disputes are resolved against evidence of delivery rather than against an empty bank account. Where enabled, an admin can help with oversight.',
            },
            {
              question: 'Do I need crypto experience?',
              answer:
                'You need a Stellar address to receive USDC. Beyond that, the escrow and releases are handled by the contract — you focus on delivering and providing proof.',
            },
          ],
        },
      ],
    },
    es: {
      title: 'Cómo funcionan las órdenes de compra — la perspectiva del proveedor',
      description:
        'Sigue una orden de Mercato desde el punto de vista del proveedor: desde que la PyME la crea hasta la liberación de pago por hitos vía escrow.',
      excerpt:
        'Como proveedor, recibes pago parcial por adelantado y el resto a medida que entregas — con los fondos asegurados en escrow antes de enviar nada.',
      sections: [
        {
          type: 'paragraph',
          text: 'El mayor riesgo para un proveedor es financiar el retraso de pago del comprador — enviar la mercancía y luego esperar semanas para cobrar. Las órdenes por hitos de Mercato están diseñadas para quitar ese riesgo. Así se ve el flujo desde tu lado.',
        },
        {
          type: 'heading',
          level: 2,
          text: 'Paso 1 — Una PyME crea la orden',
        },
        {
          type: 'paragraph',
          text: 'Una PyME arma una orden en torno a una compra contigo: los productos, el monto, tu dirección Stellar para el pago y la división por hitos (por ejemplo 50% al envío, 50% a la entrega). Firma con su billetera para desplegar un contrato de escrow en Stellar.',
        },
        {
          type: 'heading',
          level: 2,
          text: 'Paso 2 — Los inversionistas financian el escrow',
        },
        {
          type: 'paragraph',
          text: 'Los inversionistas aportan USDC al escrow de la orden. Esta es tu protección clave: el dinero que te pagará queda bloqueado en el contrato antes de que envíes, no en la cuenta del comprador esperando que pague después.',
        },
        {
          type: 'heading',
          level: 2,
          text: 'Paso 3 — Entregas contra hitos',
        },
        {
          type: 'list',
          ordered: true,
          items: [
            'Cumple el primer hito (por ejemplo, envía la mercancía) y aporta la prueba.',
            'Una vez aprobado, el contrato libera el pago de ese hito a tu dirección Stellar.',
            'Completa el siguiente hito (por ejemplo, entrega confirmada) y aporta la prueba.',
            'Al aprobarse, se te libera el pago restante.',
          ],
        },
        {
          type: 'callout',
          title: 'Pago parcial por adelantado, resto asegurado',
          text: 'No te quedas financiando todo el retraso. Cobras por etapas a medida que pruebas avance, y los fondos quedaron asegurados en escrow antes de que comprometieras inventario.',
        },
        {
          type: 'heading',
          level: 2,
          text: 'Por qué existen las aprobaciones',
        },
        {
          type: 'paragraph',
          text: 'Las aprobaciones de hitos (por la PyME, y donde se habilita un admin para supervisión o disputas) son lo que hace que los inversionistas se sientan cómodos financiando la orden. Confirman que la entrega realmente ocurrió antes de mover dinero — la misma prueba que te protege de disputas sobre si cumpliste.',
        },
        {
          type: 'faq',
          items: [
            {
              question: '¿Cuándo cobro realmente?',
              answer:
                'A medida que se aprueba cada hito. El escrow libera esa porción a tu dirección Stellar automáticamente bajo las reglas del contrato — sin transferencia manual del comprador.',
            },
            {
              question: '¿Qué pasa si hay una disputa?',
              answer:
                'Como los fondos están en un escrow neutral con prueba de hitos, las disputas se resuelven contra la evidencia de entrega y no contra una cuenta bancaria vacía. Donde se habilita, un admin puede ayudar con la supervisión.',
            },
            {
              question: '¿Necesito experiencia en crypto?',
              answer:
                'Necesitas una dirección Stellar para recibir USDC. Más allá de eso, el escrow y las liberaciones los maneja el contrato — tú te enfocas en entregar y aportar pruebas.',
            },
          ],
        },
      ],
    },
  },
]

export function getBlogPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((post) => post.slug === slug)
}

export function getAllBlogPosts(): BlogPost[] {
  return [...BLOG_POSTS].sort(
    (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt),
  )
}

export function getBlogPostSlugs(): string[] {
  return BLOG_POSTS.map((post) => post.slug)
}
