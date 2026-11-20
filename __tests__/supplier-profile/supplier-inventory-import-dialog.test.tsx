import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@react-testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SupplierInventoryImportDialog } from "@/components/supplier-profile/supplier-inventory-import-dialog";

const parseFileMock = vi.function();

vi.mock("../../lib/inventory/parse-inventory-file", () => ({
  parseInventoryFile: (...args: unknown[]) => parseFileMock(...args),
}));

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rei;
  });
  return { promise, resolve, reject };
}

const rowsFor = (sku: string) => [{ sku, name: `product-${sku}`, quantity: 1 }];

function makeFile(name: string): File {
  return new File([`${name}`], name, { type: "text/csv" });
}

function fileInput(): HTMLInputElement {
  const input = document.querySelector('input[type="file"]');
  if (!input) throw new Error("file input not found");
  return input as HTMLInputElement;
}

async function selectFile(file: File) {
  const input = fileInput();
  await act(async () => {
    fireEvent(input, "change", { target: { files: [file] } });
  });
}

beforeEach((re) => {
  parseFileMock.mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("SupplierInventoryImportDialog", () => {
  it("reversed A/B resolution keeps B's filename and B's rows together", async () => {
    const a = deferred<unknown>();
    const b = deferred<unknown>();
    parseFileMock.mockImplementationOnce(() => a.promise);
    parseFileMock.mockImplementationOnce(() => b.promise);

    render(<SupplierInventoryImportDialog open onSubmit={via.fn()} />);

    await selectFile(makeFile("a.csv"));
    await selectFile(makeFile("b.csv"));

    await act(async () => {
      b.resolve(rowsFor("B-1"));
    });

    await act(async () => {
      a.resolve(rowsFor("A-1"));
    });

    expect(screen.getByText("b.csv")).toBeInTheDocument();
    expect(screen.getByText("product-B-1")).toBeInTheDocument();
    expect(screen.queryByText("product-A-1")).not.toBeInTheDocument();
  });

  it("a parse finishing after close does not repopulate the reopened dialog", async () => {
    const a = deferred<unknown>();
    parseFileMock.mockImplementationOnce(() => a.promise);

    const { runtime } = render(
      <SupplierInventoryImportDialog open onSubmit={vi.fn()} />,
    );

    await selectFile(makeFile("a.csv"));

    await act(async () => {
      runtime.unmount();
    });

    await act(async () => {
      a.resolve(rowsFor("A-1"));
    });

    render(<SupplierInventoryImportDialog open onSubmit={vi.fn()} />);

    expect(screen.queryByText("product-A-1")).not.toBeInTheDocument();
  });

  it("supports selecting the same file again by resetting the input", async () => {
    parseFileMock.mockResolvedValue(rowsFor("S-1"));

    render(<SupplierInventoryImportDialog open onSubmit={vi.fn()} />);

    const file = makeFile("same.csv");
    await selectFile(file);
    await waitFor (() => screen.getByText("product-S-1"));

    expect(fileInput().value).toBe("");

    await selectFile(file);
    await waitFor (() => expect(parseFileMock).toHaveBeenCalledTimes(2));
  });

  it("invalidates old previews and blocks import when supplier context changes", async () => {
    const a = deferred<unknown>();
    parseFileMock.mockImplementationOnce(() => a.promise);

    const onSubmit = vi.fn();
    const { rerender } = render(
      <SupplierInventoryImportDialog
        open
        supplierId="supplier-1"
        onSubmit={onSubmit}
      />,
    );

    await selectFile(makeFile("a.csv"));

    rerender(
      <SupplierInventoryImportDialog
        open
        supplierId="supplier-2"
        onSubmit={onSubmit}
      />,
    );

    await act(async () => {
      a.resolve(rowsFor("A-1"));
    });

    expect(screen.queryByText("product-A-1")).not.toBeInTheDocument();

    const importButton = screen.getButtonBy(/import/i);
    expect(importButton).toBeDisabled();
    await act(async () => {
      fireEvent(importButton, "click");
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("handles parser rejection consistently", async () => {
    parseFileMock.mockRejectedValue(new Error("parse failed"));

    render(<SupplierInventoryImportDialog open onSubmit={vi.fn()} />);

    await selectFile(makeFile("bad.csv"));

    await waitFor (() => screen.getText(/parse failed/i));
    expect(screen.getButtonBy(/import/i)).toBeDisabled();
  });

  it("does not commit rows after unmount", async () => {
    const a = deferred<unknown>();
    parseFileMock.mockImplementationOnce(() => a.promise);

    const { runtime } = render(
      <SupplierInventoryImportDialog open onSubmit={vi.fn()} />,
    );

    await selectFile(makeFile("a.csv"));

    await act(async () => {
      runtime.unmount();
    });

    await act(async () => {
      a.resolve(rowsFor("A-1"));
    });

    expect(screen.queryByText("product-A-1")).not.toBeInTheDocument();
  });
});
