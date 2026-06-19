/**
 * Test Anchor Client
 *
 * A unified client for testanchor.stellar.org that composes all supported SEP modules.
 * This serves as a reference implementation for building SEP-compatible anchor integrations.
 */

import {
    fetchStellarToml,
    getSep10Endpoint,
    getSep6Endpoint,
    getSep12Endpoint,
    getSep24Endpoint,
    getSep31Endpoint,
    getSep38Endpoint,
    getSigningKey,
    type StellarTomlRecord,
} from '../sep/sep1';

import {
    authenticate,
    isTokenExpired,
    decodeToken,
    type Sep10SignerFn,
} from '../sep/sep10';

import { sep6, sep12, sep24, sep31, sep38 } from '../sep';
import { BaseAnchorClient } from '../base-anchor-client';

import type {
    Sep6Info,
    Sep6DepositRequest,
    Sep6DepositResponse,
    Sep6WithdrawRequest,
    Sep6WithdrawResponse,
    Sep6Transaction,
    Sep12CustomerResponse,
    Sep12PutCustomerRequest,
    Sep24Info,
    Sep24DepositRequest,
    Sep24WithdrawRequest,
    Sep24InteractiveResponse,
    Sep24Transaction,
    Sep31Info,
    Sep31PostTransactionRequest,
    Sep31PostTransactionResponse,
    Sep31Transaction,
    Sep38Info,
    Sep38PriceRequest,
    Sep38PriceResponse,
    Sep38QuoteRequest,
    Sep38QuoteResponse,
} from '../sep/types';

export interface TestAnchorConfig {
    domain?: string;
    networkPassphrase?: string;
}

const DEFAULT_DOMAIN = 'testanchor.stellar.org';
const TESTNET_PASSPHRASE = 'Test SDF Network ; September 2015';

/**
 * Test Anchor Client
 *
 * Provides a unified interface for interacting with the Stellar test anchor.
 * Handles authentication, token management, and all supported SEP operations.
 */
export class TestAnchorClient extends BaseAnchorClient {
    private domain: string;
    private networkPassphrase: string;
    private toml: StellarTomlRecord | null = null;
    private token: string | null = null;
    private account: string | null = null;
    private sepFetchFn: typeof fetch;

    readonly name = 'testanchor';

    constructor(config: TestAnchorConfig = {}, fetchFn: typeof fetch = fetch) {
        super({ baseUrl: `https://${config.domain || DEFAULT_DOMAIN}`, fetchFn });
        this.domain = config.domain || DEFAULT_DOMAIN;
        this.networkPassphrase = config.networkPassphrase || TESTNET_PASSPHRASE;
        this.sepFetchFn = this.createRetryingFetch();
    }

    // ===========================================================================
    // Initialization & Discovery (SEP-1)
    // ===========================================================================

    /**
     * Initialize the client by fetching the stellar.toml file.
     * This must be called before using other methods.
     */
    async initialize(): Promise<StellarTomlRecord> {
        this.toml = await fetchStellarToml(this.domain);
        return this.toml;
    }

    /**
     * Get the cached stellar.toml or fetch it if not available.
     */
    async getToml(): Promise<StellarTomlRecord> {
        if (!this.toml) {
            await this.initialize();
        }
        return this.toml!;
    }

    /**
     * Check if a specific SEP is supported by this anchor.
     */
    async supportsSep(sep: 6 | 10 | 12 | 24 | 31 | 38): Promise<boolean> {
        const toml = await this.getToml();
        switch (sep) {
            case 6:
                return !!getSep6Endpoint(toml);
            case 10:
                return !!getSep10Endpoint(toml);
            case 12:
                return !!getSep12Endpoint(toml);
            case 24:
                return !!getSep24Endpoint(toml);
            case 31:
                return !!getSep31Endpoint(toml);
            case 38:
                return !!getSep38Endpoint(toml);
            default:
                return false;
        }
    }

    // ===========================================================================
    // Authentication (SEP-10)
    // ===========================================================================

    /**
     * Authenticate with the anchor using SEP-10.
     *
     * @param account - The user's Stellar public key
     * @param signer - Function to sign the challenge transaction (e.g., from Freighter)
     */
    async authenticate(account: string, signer: Sep10SignerFn): Promise<string> {
        const toml = await this.getToml();
        const authEndpoint = getSep10Endpoint(toml);
        const signingKey = getSigningKey(toml);

        if (!authEndpoint) {
            throw new Error('Anchor does not support SEP-10 authentication');
        }

        this.token = await authenticate(
            {
                authEndpoint,
                serverSigningKey: signingKey || '',
                networkPassphrase: this.networkPassphrase,
                homeDomain: this.domain,
            },
            account,
            signer,
            { validateChallenge: !!signingKey },
            this.sepFetchFn,
        );

        this.account = account;
        return this.token;
    }

    /**
     * Check if the client is authenticated.
     */
    isAuthenticated(): boolean {
        return !!this.token && !isTokenExpired(this.token);
    }

    /**
     * Get the current JWT token.
     */
    getToken(): string | null {
        return this.token;
    }

    /**
     * Get the authenticated account.
     */
    getAccount(): string | null {
        return this.account;
    }

    /**
     * Decode the current JWT token to get the payload.
     */
    getTokenPayload() {
        if (!this.token) return null;
        return decodeToken(this.token);
    }

    /**
     * Clear the authentication state.
     */
    logout(): void {
        this.token = null;
        this.account = null;
    }

    private requireAuth(): string {
        if (!this.token || isTokenExpired(this.token)) {
            throw new Error('Not authenticated or token expired. Call authenticate() first.');
        }
        return this.token;
    }

    // ===========================================================================
    // KYC (SEP-12)
    // ===========================================================================

    /**
     * Get customer KYC status and required fields.
     */
    async getCustomer(type?: string): Promise<Sep12CustomerResponse> {
        const toml = await this.getToml();
        const kycServer = getSep12Endpoint(toml);
        if (!kycServer) throw new Error('Anchor does not support SEP-12');

        return sep12.getCustomer(kycServer, this.requireAuth(), { type }, this.sepFetchFn);
    }

    /**
     * Submit customer KYC information.
     */
    async putCustomer(data: Sep12PutCustomerRequest): Promise<{ id: string }> {
        const toml = await this.getToml();
        const kycServer = getSep12Endpoint(toml);
        if (!kycServer) throw new Error('Anchor does not support SEP-12');

        return sep12.putCustomer(kycServer, this.requireAuth(), data, this.sepFetchFn);
    }

    /**
     * Delete customer data.
     */
    async deleteCustomer(): Promise<void> {
        const toml = await this.getToml();
        const kycServer = getSep12Endpoint(toml);
        if (!kycServer) throw new Error('Anchor does not support SEP-12');

        return sep12.deleteCustomer(kycServer, this.requireAuth(), {}, this.sepFetchFn);
    }

    // ===========================================================================
    // Quotes (SEP-38)
    // ===========================================================================

    /**
     * Get SEP-38 info (supported assets and delivery methods).
     */
    async getQuoteInfo(): Promise<Sep38Info> {
        const toml = await this.getToml();
        const quoteServer = getSep38Endpoint(toml);
        if (!quoteServer) throw new Error('Anchor does not support SEP-38');

        return sep38.getInfo(quoteServer, this.sepFetchFn);
    }

    /**
     * Get an indicative price for an asset pair.
     */
    async getPrice(request: Sep38PriceRequest): Promise<Sep38PriceResponse> {
        const toml = await this.getToml();
        const quoteServer = getSep38Endpoint(toml);
        if (!quoteServer) throw new Error('Anchor does not support SEP-38');

        return sep38.getPrice(quoteServer, request, this.sepFetchFn);
    }

    /**
     * Request a firm quote with guaranteed rate.
     */
    async createQuote(request: Sep38QuoteRequest): Promise<Sep38QuoteResponse> {
        const toml = await this.getToml();
        const quoteServer = getSep38Endpoint(toml);
        if (!quoteServer) throw new Error('Anchor does not support SEP-38');

        return sep38.postQuote(quoteServer, this.requireAuth(), request, this.sepFetchFn);
    }

    /**
     * Get an existing quote by ID.
     */
    async getQuote(quoteId: string): Promise<Sep38QuoteResponse> {
        const toml = await this.getToml();
        const quoteServer = getSep38Endpoint(toml);
        if (!quoteServer) throw new Error('Anchor does not support SEP-38');

        return sep38.getQuote(quoteServer, this.requireAuth(), quoteId, this.sepFetchFn);
    }

    // ===========================================================================
    // Programmatic Deposit/Withdrawal (SEP-6)
    // ===========================================================================

    /**
     * Get SEP-6 info (supported assets and capabilities).
     */
    async getSep6Info(): Promise<Sep6Info> {
        const toml = await this.getToml();
        const transferServer = getSep6Endpoint(toml);
        if (!transferServer) throw new Error('Anchor does not support SEP-6');

        return sep6.getInfo(transferServer, this.sepFetchFn);
    }

    /**
     * Initiate a SEP-6 deposit (fiat to crypto).
     */
    async sep6Deposit(request: Sep6DepositRequest): Promise<Sep6DepositResponse> {
        const toml = await this.getToml();
        const transferServer = getSep6Endpoint(toml);
        if (!transferServer) throw new Error('Anchor does not support SEP-6');

        return sep6.deposit(transferServer, this.requireAuth(), request, this.sepFetchFn);
    }

    /**
     * Initiate a SEP-6 withdrawal (crypto to fiat).
     */
    async sep6Withdraw(request: Sep6WithdrawRequest): Promise<Sep6WithdrawResponse> {
        const toml = await this.getToml();
        const transferServer = getSep6Endpoint(toml);
        if (!transferServer) throw new Error('Anchor does not support SEP-6');

        return sep6.withdraw(transferServer, this.requireAuth(), request, this.sepFetchFn);
    }

    /**
     * Get a SEP-6 transaction by ID.
     */
    async getSep6Transaction(transactionId: string): Promise<Sep6Transaction> {
        const toml = await this.getToml();
        const transferServer = getSep6Endpoint(toml);
        if (!transferServer) throw new Error('Anchor does not support SEP-6');

        return sep6.getTransaction(transferServer, this.requireAuth(), transactionId, this.sepFetchFn);
    }

    /**
     * Get SEP-6 transaction history.
     */
    async getSep6Transactions(assetCode: string, limit?: number): Promise<Sep6Transaction[]> {
        const toml = await this.getToml();
        const transferServer = getSep6Endpoint(toml);
        if (!transferServer) throw new Error('Anchor does not support SEP-6');

        return sep6.getTransactions(
            transferServer,
            this.requireAuth(),
            { asset_code: assetCode, limit },
            this.sepFetchFn,
        );
    }

    // ===========================================================================
    // Interactive Deposit/Withdrawal (SEP-24)
    // ===========================================================================

    /**
     * Get SEP-24 info (supported assets and capabilities).
     */
    async getSep24Info(): Promise<Sep24Info> {
        const toml = await this.getToml();
        const transferServer = getSep24Endpoint(toml);
        if (!transferServer) throw new Error('Anchor does not support SEP-24');

        return sep24.getInfo(transferServer, this.sepFetchFn);
    }

    /**
     * Initiate an interactive SEP-24 deposit.
     * Returns a URL to the anchor's hosted deposit UI.
     */
    async sep24Deposit(request: Sep24DepositRequest): Promise<Sep24InteractiveResponse> {
        const toml = await this.getToml();
        const transferServer = getSep24Endpoint(toml);
        if (!transferServer) throw new Error('Anchor does not support SEP-24');

        return sep24.deposit(transferServer, this.requireAuth(), request, this.sepFetchFn);
    }

    /**
     * Initiate an interactive SEP-24 withdrawal.
     * Returns a URL to the anchor's hosted withdrawal UI.
     */
    async sep24Withdraw(request: Sep24WithdrawRequest): Promise<Sep24InteractiveResponse> {
        const toml = await this.getToml();
        const transferServer = getSep24Endpoint(toml);
        if (!transferServer) throw new Error('Anchor does not support SEP-24');

        return sep24.withdraw(transferServer, this.requireAuth(), request, this.sepFetchFn);
    }

    /**
     * Get a SEP-24 transaction by ID.
     */
    async getSep24Transaction(transactionId: string): Promise<Sep24Transaction> {
        const toml = await this.getToml();
        const transferServer = getSep24Endpoint(toml);
        if (!transferServer) throw new Error('Anchor does not support SEP-24');

        return sep24.getTransaction(
            transferServer,
            this.requireAuth(),
            transactionId,
            this.sepFetchFn,
        );
    }

    /**
     * Get SEP-24 transaction history.
     */
    async getSep24Transactions(assetCode: string, limit?: number): Promise<Sep24Transaction[]> {
        const toml = await this.getToml();
        const transferServer = getSep24Endpoint(toml);
        if (!transferServer) throw new Error('Anchor does not support SEP-24');

        return sep24.getTransactions(
            transferServer,
            this.requireAuth(),
            { asset_code: assetCode, limit },
            this.sepFetchFn,
        );
    }

    /**
     * Poll a SEP-24 transaction until it reaches a terminal state.
     */
    async pollSep24Transaction(
        transactionId: string,
        onStatusChange?: (tx: Sep24Transaction) => void,
    ): Promise<Sep24Transaction> {
        const toml = await this.getToml();
        const transferServer = getSep24Endpoint(toml);
        if (!transferServer) throw new Error('Anchor does not support SEP-24');

        return sep24.pollTransaction(
            transferServer,
            this.requireAuth(),
            transactionId,
            { onStatusChange },
            this.sepFetchFn,
        );
    }

    // ===========================================================================
    // Cross-Border Payments (SEP-31)
    // ===========================================================================

    /**
     * Get SEP-31 info (supported receiving assets).
     */
    async getSep31Info(): Promise<Sep31Info> {
        const toml = await this.getToml();
        const directPaymentServer = getSep31Endpoint(toml);
        if (!directPaymentServer) throw new Error('Anchor does not support SEP-31');

        return sep31.getInfo(directPaymentServer, this.sepFetchFn);
    }

    /**
     * Create a SEP-31 cross-border payment transaction.
     */
    async createSep31Transaction(
        request: Sep31PostTransactionRequest,
    ): Promise<Sep31PostTransactionResponse> {
        const toml = await this.getToml();
        const directPaymentServer = getSep31Endpoint(toml);
        if (!directPaymentServer) throw new Error('Anchor does not support SEP-31');

        return sep31.postTransaction(
            directPaymentServer,
            this.requireAuth(),
            request,
            this.sepFetchFn,
        );
    }

    /**
     * Get a SEP-31 transaction by ID.
     */
    async getSep31Transaction(transactionId: string): Promise<Sep31Transaction> {
        const toml = await this.getToml();
        const directPaymentServer = getSep31Endpoint(toml);
        if (!directPaymentServer) throw new Error('Anchor does not support SEP-31');

        return sep31.getTransaction(
            directPaymentServer,
            this.requireAuth(),
            transactionId,
            this.sepFetchFn,
        );
    }

    /**
     * Update a SEP-31 transaction with additional info.
     */
    async updateSep31Transaction(
        transactionId: string,
        fields: Record<string, string>,
    ): Promise<Sep31Transaction> {
        const toml = await this.getToml();
        const directPaymentServer = getSep31Endpoint(toml);
        if (!directPaymentServer) throw new Error('Anchor does not support SEP-31');

        return sep31.patchTransaction(
            directPaymentServer,
            this.requireAuth(),
            transactionId,
            fields,
            this.sepFetchFn,
        );
    }

    /**
     * Poll a SEP-31 transaction until it reaches a terminal state.
     */
    async pollSep31Transaction(
        transactionId: string,
        onStatusChange?: (tx: Sep31Transaction) => void,
    ): Promise<Sep31Transaction> {
        const toml = await this.getToml();
        const directPaymentServer = getSep31Endpoint(toml);
        if (!directPaymentServer) throw new Error('Anchor does not support SEP-31');

        return sep31.pollTransaction(
            directPaymentServer,
            this.requireAuth(),
            transactionId,
            { onStatusChange },
            this.sepFetchFn,
        );
    }
}

/**
 * Create a new TestAnchorClient instance.
 */
export function createTestAnchorClient(
    config?: TestAnchorConfig,
    fetchFn?: typeof fetch,
): TestAnchorClient {
    return new TestAnchorClient(config, fetchFn);
}
