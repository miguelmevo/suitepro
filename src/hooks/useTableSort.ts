import { useState, useMemo } from "react";

export type SortDirection = "asc" | "desc" | null;

export interface SortConfig {
  key: string;
  direction: SortDirection;
}

/**
 * Generic hook for sortable tables.
 * 
 * Usage:
 *   const { sortedData, sortConfig, requestSort, getSortIcon } = useTableSort(data, { key: "apellido", direction: "asc" });
 * 
 * @param data - The array of items to sort
 * @param defaultSort - Optional default sort configuration
 * @param customAccessors - Optional map of column keys to custom accessor functions
 */
export function useTableSort<T>(
  data: T[],
  defaultSort?: SortConfig,
  customAccessors?: Record<string, (item: T) => string | number | boolean | null | undefined>
) {
  const [sortConfig, setSortConfig] = useState<SortConfig>(
    defaultSort || { key: "", direction: null }
  );

  const requestSort = (key: string) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        // Cycle: asc → desc → null
        if (prev.direction === "asc") return { key, direction: "desc" };
        if (prev.direction === "desc") return { key: "", direction: null };
      }
      return { key, direction: "asc" };
    });
  };

  const sortedData = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) return data;

    return [...data].sort((a, b) => {
      const accessor = customAccessors?.[sortConfig.key];
      
      let valA: any;
      let valB: any;
      
      if (accessor) {
        valA = accessor(a);
        valB = accessor(b);
      } else {
        valA = (a as any)[sortConfig.key];
        valB = (b as any)[sortConfig.key];
      }

      // Handle nulls
      if (valA == null && valB == null) return 0;
      if (valA == null) return 1;
      if (valB == null) return -1;

      // Boolean
      if (typeof valA === "boolean") {
        const cmp = valA === valB ? 0 : valA ? -1 : 1;
        return sortConfig.direction === "asc" ? cmp : -cmp;
      }

      // Number
      if (typeof valA === "number" && typeof valB === "number") {
        return sortConfig.direction === "asc" ? valA - valB : valB - valA;
      }

      // Try numeric parse for strings like territory numbers
      const numA = Number(valA);
      const numB = Number(valB);
      if (!isNaN(numA) && !isNaN(numB)) {
        return sortConfig.direction === "asc" ? numA - numB : numB - numA;
      }

      // String comparison
      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      const cmp = strA.localeCompare(strB);
      return sortConfig.direction === "asc" ? cmp : -cmp;
    });
  }, [data, sortConfig, customAccessors]);

  return { sortedData, sortConfig, requestSort };
}
