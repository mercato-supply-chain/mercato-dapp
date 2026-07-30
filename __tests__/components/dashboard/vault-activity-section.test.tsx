import { test, expect, mock, afterEach } from "bun:test";

import React from "react";
import { render, screen, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VaultActivitySection } from "@/components/dashboard/vault-my-positions/vault-activity-section";
import type { VaultActivityEntry } from "@/lib/stellar/vault-activity";

mock.module("next/link", () => ({
  default: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

afterEach(() => {
  mock.restore();
  cleanup();
});

let nextId = 1;
function createEntry(overrides?: Partial<VaultActivityEntry>): VaultActivityEntry {
  const id = nextId++;
  const kind = id % 2 === 0 ? "withdraw" : "deposit";
  return {
    id: `entry-${id}`,
    kind,
    amountRaw: id * 100_000_000,
    amountDisplay: id * 10,
    createdAt: `2025-01-${String(id).padStart(2, "0")}T12:00:00Z`,
    transactionHash: `hash${id}deadbeefcafebabe`,
    explorerUrl: `https://stellar.expert/explorer/testnet/tx/hash${id}`,
    ...overrides,
  };
}

function buildActivity(count: number): VaultActivityEntry[] {
  nextId = 1;
  return Array.from({ length: count }, () => createEntry());
}

const defaultProps = {
  activity: [] as VaultActivityEntry[],
  isLoading: false,
  activityError: null as string | null,
  supplySymbol: "USDC",
  onRetry: () => {},
};

test("renders loading skeleton when isLoading is true", () => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  render(
    <VaultActivitySection {...defaultProps} isLoading={true} />,
    { container },
  );

  const skeletons = container.querySelectorAll(".animate-pulse");
  expect(skeletons.length).toBeGreaterThanOrEqual(3);
});

test("renders empty state when activity is empty and no error", () => {
  render(
    <VaultActivitySection {...defaultProps} activity={[]} />,
  );

  expect(
    screen.getByText(/No vault deposits or withdrawals found/i),
  ).toBeTruthy();
});

test("renders error state with retry button", () => {
  const onRetry = () => {};
  render(
    <VaultActivitySection
      {...defaultProps}
      activityError="Something went wrong"
      onRetry={onRetry}
    />,
  );

  expect(screen.getByText("Something went wrong")).toBeTruthy();
  expect(screen.getByRole("button", { name: /Retry/i })).toBeTruthy();
});

test("initial render only shows INITIAL_VISIBLE_COUNT rows when activity has more", () => {
  const activity = buildActivity(15);

  render(
    <VaultActivitySection {...defaultProps} activity={activity} />,
  );

  const rows = screen.getAllByRole("listitem");
  expect(rows.length).toBe(10);
});

test("load more shows LOAD_MORE_INCREMENT additional rows and keeps first rows unchanged", async () => {
  const activity = buildActivity(15);

  render(
    <VaultActivitySection {...defaultProps} activity={activity} />,
  );

  const rowsBefore = screen.getAllByRole("listitem");
  expect(rowsBefore.length).toBe(10);

  const firstRowKindBefore = within(rowsBefore[0]).getByText(/deposit|withdraw/i).textContent;

  const loadMoreBtn = screen.getByRole("button", { name: /Cargar más/i });
  await userEvent.click(loadMoreBtn);

  const rowsAfter = screen.getAllByRole("listitem");
  expect(rowsAfter.length).toBe(15);

  const firstRowKindAfter = within(rowsAfter[0]).getByText(/deposit|withdraw/i).textContent;
  expect(firstRowKindAfter).toBe(firstRowKindBefore);
});

test("terminal state shows 'No hay más actividad' and hide button when all entries visible", async () => {
  const activity = buildActivity(12);

  render(
    <VaultActivitySection {...defaultProps} activity={activity} />,
  );

  expect(screen.getAllByRole("listitem").length).toBe(10);

  const loadMoreBtn = screen.getByRole("button", { name: /Cargar más/i });
  await userEvent.click(loadMoreBtn);

  expect(screen.getAllByRole("listitem").length).toBe(12);
  expect(screen.queryByRole("button", { name: /Cargar más/i })).toBeNull();
  expect(screen.getByText(/No hay más actividad/i)).toBeTruthy();
});

test("visibleCount no se resetea si activity cambia de referencia pero no de contenido", async () => {
  const activity = buildActivity(15);

  const { rerender } = render(
    <VaultActivitySection {...defaultProps} activity={activity} />,
  );

  const loadMoreBtn = screen.getByRole("button", { name: /Cargar más/i });
  await userEvent.click(loadMoreBtn);
  expect(screen.getAllByRole("listitem").length).toBe(15);

  const sameDataNewRef = [...activity];
  rerender(<VaultActivitySection {...defaultProps} activity={sameDataNewRef} />);

  expect(screen.getAllByRole("listitem").length).toBe(15);
});
