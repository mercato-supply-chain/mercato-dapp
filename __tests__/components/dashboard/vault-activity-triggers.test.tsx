import { test, expect, mock, beforeEach, spyOn, afterEach, beforeAll, afterAll } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

beforeAll(() => {
  GlobalRegistrator.register();
});

import React from "react";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VaultDashboard } from "@/components/dashboard/vault-dashboard";
import { VaultMyPositions, vaultActivityRequest } from "@/components/dashboard/vault-my-positions";

// Mock hooks
const mockRefreshBalances = mock();
const mockDepositToVault = mock();
const mockWithdrawFromVault = mock();

mock.module("@/hooks/use-wallet", () => ({
  useWallet: () => ({
    isConnected: true,
    canSignTransactions: true,
    publicKey: "G123",
    walletInfo: { address: "G123" }
  })
}));

mock.module("@/hooks/useDefindex", () => ({
  useDefindex: () => ({
    walletBalance: 100,
    walletRawBalance: 1000000000,
    vaultBalance: 50,
    vaultRawBalance: 500000000,
    dfTokens: 50,
    isLoadingBalances: false,
    vaultMeta: {
      name: "Test Vault",
      vaultAddress: "C1234567890123456789",
      assets: [{ address: "C123", symbol: "USDC" }],
      totals: { tvlDisplay: 1000, idleDisplay: 100, investedDisplay: 900 }
    },
    refreshBalances: mockRefreshBalances,
    depositToVault: mockDepositToVault,
    withdrawFromVault: mockWithdrawFromVault
  })
}));

mock.module("next/link", () => ({
  default: ({ children }: any) => <a>{children}</a>
}));

mock.module("next/image", () => ({
  default: (props: any) => <img {...props} />
}));

mock.module("@/components/ui/tabs", () => ({
  Tabs: ({ children }: any) => <div>{children}</div>,
  TabsList: ({ children }: any) => <div>{children}</div>,
  TabsTrigger: ({ children }: any) => <button type="button">{children}</button>,
  TabsContent: ({ children }: any) => <div>{children}</div>
}));

mock.module("@/components/dashboard/vault-detail-view", () => ({
  VaultDetailView: ({ depositToVault, withdrawFromVault }: any) => (
    <div>
      <button onClick={() => depositToVault("10")}>Mock Deposit</button>
      <button onClick={() => withdrawFromVault("10")}>Mock Withdraw</button>
    </div>
  )
}));

beforeEach(() => {
  mockRefreshBalances.mockClear();
  mockDepositToVault.mockClear();
  mockWithdrawFromVault.mockClear();
  
  spyOn(vaultActivityRequest, "fetch").mockResolvedValue({
    activity: [],
    activitySummary: { depositCount: 0, withdrawCount: 0, totalDepositedDisplay: 0, totalWithdrawnDisplay: 0 }
  });
  spyOn(vaultActivityRequest, "invalidate").mockImplementation(() => {});
  
  vaultActivityRequest.fetch.mockClear();
  vaultActivityRequest.invalidate.mockClear();
});

afterEach(() => {
  mock.restore();
  cleanup();
});

test("Global Refresh control triggers a balance refresh and does NOT trigger a vault activity request", async () => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const { getByRole } = render(<VaultDashboard />, { container });
  
  // Wait for initial render and history fetch
  await waitFor(() => expect(vaultActivityRequest.fetch).toHaveBeenCalledTimes(1));
  vaultActivityRequest.fetch.mockClear();
  
  const refreshBtn = getByRole("button", { name: /Refresh/i });
  await userEvent.click(refreshBtn);
  
  expect(mockRefreshBalances).toHaveBeenCalledTimes(1);
  
  // Wait a bit to ensure no history fetch is triggered
  await new Promise(r => setTimeout(r, 50));
  expect(vaultActivityRequest.fetch).not.toHaveBeenCalled();
});

test("A successful deposit triggers both a balance refresh and a history/activity refresh", async () => {
  mockDepositToVault.mockResolvedValue({ success: true, txHash: "123" });
  
  const container = document.createElement("div");
  document.body.appendChild(container);
  const { getAllByRole, getByText } = render(<VaultDashboard />, { container });
  
  await waitFor(() => expect(vaultActivityRequest.fetch).toHaveBeenCalledTimes(1));
  vaultActivityRequest.fetch.mockClear();
  vaultActivityRequest.invalidate.mockClear();
  
  const depositBtns = getAllByRole("button", { name: /Deposit/i });
  await userEvent.click(depositBtns[0]);
  
  const submitBtn = getByText("Mock Deposit");
  await userEvent.click(submitBtn);
  
  await waitFor(() => expect(mockDepositToVault).toHaveBeenCalled());
  
  await waitFor(() => {
    expect(vaultActivityRequest.fetch).toHaveBeenCalledTimes(1);
  });
});

test("A successful withdrawal triggers both a balance refresh and a history/activity refresh", async () => {
  mockWithdrawFromVault.mockResolvedValue({ success: true, txHash: "456" });
  
  const container = document.createElement("div");
  document.body.appendChild(container);
  const { getAllByRole, getByText } = render(<VaultDashboard />, { container });
  
  await waitFor(() => expect(vaultActivityRequest.fetch).toHaveBeenCalledTimes(1));
  vaultActivityRequest.fetch.mockClear();
  vaultActivityRequest.invalidate.mockClear();
  
  const depositBtns = getAllByRole("button", { name: /Deposit/i });
  await userEvent.click(depositBtns[0]); // Opens the detail view
  
  const submitBtn = getByText("Mock Withdraw");
  await userEvent.click(submitBtn);
  
  await waitFor(() => expect(mockWithdrawFromVault).toHaveBeenCalled());
  
  await waitFor(() => {
    expect(vaultActivityRequest.fetch).toHaveBeenCalledTimes(1);
  });
});

test("The Retry control, after an error state, forces a fresh activity request even within the 15s cache window", async () => {
  vaultActivityRequest.fetch.mockRejectedValueOnce(new Error("Network error"));
  
  const container = document.createElement("div");
  document.body.appendChild(container);
  const { findByRole } = render(<VaultMyPositions
    walletAddress="G123"
    walletBalance={100}
    vaultBalance={50}
    dfTokens={50}
    vaultMeta={null}
    isLoadingBalances={false}
    historyRefreshNonce={0}
    onDeposit={() => {}}
    onWithdraw={() => {}}
  />, { container });
  
  await waitFor(() => expect(vaultActivityRequest.fetch).toHaveBeenCalledTimes(1));
  vaultActivityRequest.fetch.mockClear();
  vaultActivityRequest.invalidate.mockClear();
  
  const retryBtn = await findByRole("button", { name: /Retry/i });
  
  vaultActivityRequest.fetch.mockResolvedValue({
    activity: [],
    activitySummary: null
  });
  
  await userEvent.click(retryBtn);
  
  await waitFor(() => {
    expect(vaultActivityRequest.invalidate).toHaveBeenCalledWith("G123");
    expect(vaultActivityRequest.fetch).toHaveBeenCalledTimes(1);
  });
});
