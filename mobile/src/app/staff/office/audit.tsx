import { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { DayRange, type DayRangeValue } from "@/components/day-range";
import { DenseRow } from "@/components/dense-row";
import { FilterChip } from "@/components/filter-chip";
import { FilterChipRow } from "@/components/filter-chip-row";
import { HallButton } from "@/components/hall-button";
import { OfficeError, OfficeFrame, replyError } from "@/components/office-frame";
import { useButtonFeedback } from "@/button-feedback";
import { PagedList } from "@/components/paged-list";
import { SearchField } from "@/components/search-field";
import { formatWhenParts, hallNow } from "@/format-when";
import { PAGE_SIZE, pageQuery } from "@/list-page";
import {
  auditCsv,
  auditExportFileName,
  auditExportQuery,
  readAudit,
  readPage,
  type AuditRow,
} from "@/office";
import { hallDay } from "@/outing-when";
import { shareLocalFile, writeCacheText } from "@/share-file";
import { useSession } from "@/session";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";
import { useDebouncedValue } from "@/use-debounced-value";
import { useFilteredPagedList } from "@/use-filtered-paged-list";

const ENTITY_TYPES: { value: string | null; label: string }[] = [
  { value: null, label: "All" },
  { value: "resident", label: "Resident" },
  { value: "staff", label: "Staff" },
  { value: "room", label: "Room" },
  { value: "block", label: "Block" },
  { value: "guest_stay", label: "Guest stay" },
  { value: "permission", label: "Permission" },
  { value: "outing", label: "Outing" },
  { value: "settings", label: "Settings" },
  { value: "destination", label: "Destination" },
];

type AuditFilters = {
  entityType: string | null;
  q: string;
  range: DayRangeValue;
};

function auditKey(filters: AuditFilters): string {
  return `${filters.entityType ?? ""}|${filters.q}|${filters.range.from ?? ""}|${filters.range.to ?? ""}`;
}

function auditPath(filters: AuditFilters, offset: number): string {
  const search = new URLSearchParams(pageQuery(offset));
  if (filters.entityType) {
    search.set("entity_type", filters.entityType);
  }
  if (filters.q.trim()) {
    search.set("q", filters.q.trim());
  }
  if (filters.range.from) {
    search.set("from", filters.range.from);
  }
  if (filters.range.to) {
    search.set("to", filters.range.to);
  }
  return `/admin/audit?${search.toString()}`;
}

export default function OfficeAudit() {
  const colors = useHallColors();
  const { staffRequest, staffText } = useSession();
  const [open, setOpen] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const q = useDebouncedValue(query);
  const [entityType, setEntityType] = useState<string | null>(null);
  const [range, setRange] = useState<DayRangeValue>({ from: null, to: null });
  const [exportError, setExportError] = useState<string | null>(null);
  const exportCue = useButtonFeedback();
  const filters = useMemo<AuditFilters>(() => ({ entityType, q, range }), [entityType, q, range]);

  const list = useFilteredPagedList<AuditRow, AuditFilters>({
    idOf: (row) => row.id,
    filters,
    filterKey: auditKey(filters),
    cacheScope: "office-audit",
    loadPage: useCallback(async (current, offset) => {
      const reply = await staffRequest(auditPath(current, offset));
      const page = reply.ok ? readPage(reply.data, readAudit) : null;
      if (!page) {
        return { error: replyError(reply) ?? "The audit log didn't load" };
      }
      return { items: page.items, total: page.total };
    }, [staffRequest]),
  });

  const rows = list.rows ?? [];
  const selected = rows.find((row) => row.id === open) ?? null;
  const total = list.total ?? rows.length;
  const moreOffline = total > rows.length;

  const exportAudit = async () => {
    if (exportCue.held) {
      return;
    }
    exportCue.markBusy();
    setExportError(null);
    const reply = await staffText(`/admin/audit/export${auditExportQuery(filters)}`);
    const refused = replyError(reply);
    if (refused || !reply.ok || typeof reply.data !== "string") {
      setExportError(refused ?? "The audit export was not a CSV");
      exportCue.markFailure();
      return;
    }
    const csv = auditCsv(reply.data);
    if (!csv) {
      setExportError("The audit export was not a CSV");
      exportCue.markFailure();
      return;
    }
    try {
      const uri = await writeCacheText(auditExportFileName(hallDay(hallNow())), csv);
      const result = await shareLocalFile(uri, {
        mimeType: "text/csv",
        uti: "public.comma-separated-values-text",
        dialogTitle: "Export audit",
      });
      if (result === "unavailable") {
        setExportError("Sharing is not available on this device");
        exportCue.markFailure();
        return;
      }
      if (result === "failed") {
        setExportError("The audit log could not be shared");
        exportCue.markFailure();
        return;
      }
      exportCue.markSuccess();
    } catch {
      setExportError("The audit log could not be shared");
      exportCue.markFailure();
    }
  };

  return (
    <OfficeFrame title="Audit" refreshing={list.refreshing} onRefresh={list.refresh}>
      <SearchField value={query} placeholder="Summary, action, or actor" onChange={setQuery} />
      <FilterChipRow>
        {ENTITY_TYPES.map((item) => (
          <FilterChip
            key={item.label}
            label={item.label}
            on={entityType === item.value}
            onPress={() => setEntityType(item.value)}
          />
        ))}
      </FilterChipRow>
      <DayRange value={range} onChange={setRange} />
      <HallButton
        label="Export audit"
        busy={exportCue.busy}
        succeeded={exportCue.succeeded}
        onPress={() => void exportAudit()}
      />
      <OfficeError message={exportError} />
      <PagedList
        rows={list.rows}
        error={list.error}
        pageError={null}
        showListSkeleton={list.showListSkeleton}
        showPageSkeleton={false}
        filling={list.filling}
        onRetry={list.retry}
        onRetryPage={() => undefined}
        empty="No matching audit lines"
      >
        {!list.showListSkeleton && selected ? (
          <Text selectable style={[text.body, { color: colors.ink }]}>
            {selected.summary}
          </Text>
        ) : null}
        <View>
          {rows.map((row, index, all) => {
            const when = formatWhenParts(row.at);
            return (
              <DenseRow
                key={row.id}
                title={row.summary}
                detail={`${row.actor ?? "Hall"}${when ? ` · ${when.day}` : ""}`}
                time={when?.clock ?? ""}
                first={index === 0}
                last={index === all.length - 1}
                onPress={() => setOpen(row.id === open ? null : row.id)}
              />
            );
          })}
        </View>
        {!list.showListSkeleton && rows.length > 0 ? (
          <Text style={[text.error, styles.footer, { color: colors.inkSoft }]}>
            {moreOffline
              ? total > 10_000
                ? `Showing the newest ${PAGE_SIZE} of ${total}. Export includes up to 10,000 newest matching lines.`
                : `Showing the newest ${PAGE_SIZE}. Export for the full filtered log (${total}).`
              : `Showing ${rows.length} ${rows.length === 1 ? "line" : "lines"}.`}
          </Text>
        ) : null}
      </PagedList>
    </OfficeFrame>
  );
}

const styles = StyleSheet.create({
  footer: { marginTop: 12 },
});
