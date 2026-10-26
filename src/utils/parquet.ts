import { parquetReadObjects } from "hyparquet";

/**
 * Downloads a parquet file and decodes all its rows in the browser with hyparquet (pure JS,
 * bundled with the app: no CDN, no WebAssembly). It replaced DuckDB-WASM, whose engine came from
 * jsDelivr and its parquet extension from extensions.duckdb.org, only to run a SELECT *.
 *
 * INT64 columns come back as BigInt and are converted to plain numbers. The risk files are
 * SNAPPY-compressed, which hyparquet reads on its own (ZSTD etc. would need hyparquet-compressors).
 */
export async function loadParquetData(parquetUrl: string): Promise<Record<string, unknown>[]> {
  const resp = await fetch(parquetUrl);
  if (!resp.ok) throw new Error(`Failed to fetch parquet (${resp.status}): ${parquetUrl}`);
  const rows = await parquetReadObjects({ file: await resp.arrayBuffer() });
  for (const row of rows) {
    for (const key in row) {
      if (typeof row[key] === "bigint") row[key] = Number(row[key]);
    }
  }
  return rows;
}
