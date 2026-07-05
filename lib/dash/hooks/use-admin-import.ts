"use client";

import { useCallback, useEffect, useState } from "react";
import type { DataSource } from "@/lib/dash/api/config";
import { isApiEnabled } from "@/lib/dash/api/config";
import {
  getMockAdminImportLogs,
  importLogToAdminRow,
  type AdminImportLogRow,
} from "@/lib/dash/api/adapters";
import { fetchImportLogs, runOrderImport } from "@/lib/dash/api/client";
import type { MockImportSource } from "@/lib/import/mock-fixtures";
import { MOCK_IMPORT_FIXTURES } from "@/lib/import/mock-fixtures";

export function useAdminImportLogs() {
  const [logs, setLogs] = useState<AdminImportLogRow[]>(getMockAdminImportLogs);
  const [source, setSource] = useState<DataSource>("mock");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isApiEnabled()) {
      setLogs(getMockAdminImportLogs());
      setSource("mock");
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { logs: apiLogs } = await fetchImportLogs({ limit: 10 });
      setLogs(apiLogs.map(importLogToAdminRow));
      setSource("api");
    } catch (err) {
      setLogs(getMockAdminImportLogs());
      setSource("mock");
      setError(err instanceof Error ? err.message : "Failed to load import logs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const runMockImport = useCallback(
    async (importSource: MockImportSource) => {
      if (!isApiEnabled()) {
        return {
          ok: false as const,
          message: "Enable NEXT_PUBLIC_USE_API=true to run imports against the API",
        };
      }

      setLoading(true);
      setError(null);
      try {
        const result = await runOrderImport({
          source: importSource,
          payload: MOCK_IMPORT_FIXTURES[importSource],
        });
        await load();
        const msg =
          result.errors && result.errors.length > 0
            ? `Imported ${result.imported} order(s) with ${result.errors.length} error(s)`
            : `Imported ${result.imported} order(s) successfully`;
        return { ok: true as const, message: msg, imported: result.imported };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Import failed";
        setError(message);
        return { ok: false as const, message };
      } finally {
        setLoading(false);
      }
    },
    [load],
  );

  return { logs, source, loading, error, refresh: load, runMockImport };
}
