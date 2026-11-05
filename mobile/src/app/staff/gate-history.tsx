import { useCallback, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { goBackOr } from "@/back";
import { BackMark } from "@/components/back-mark";
import { DenseRow } from "@/components/dense-row";
import { FilterChip } from "@/components/filter-chip";
import { FilterChipRow } from "@/components/filter-chip-row";
import { HallButton } from "@/components/hall-button";
import { OfficeError, replyError } from "@/components/office-frame";
import { PagedList } from "@/components/paged-list";
import { SearchField } from "@/components/search-field";
import { hallNow } from "@/format-when";
import { pageQuery } from "@/list-page";
import { hallDay } from "@/outing-when";
import { shareLocalFile, writeCacheText } from "@/share-file";
import { useSession } from "@/session";
import {
  gateActivityCsv,
  gateActivityExportFileName,
  gateActivityExportQuery,
  readActivity,
  readTotal,
  trimStop,
  type GateEvent,
} from "@/staff";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";
import { useDebouncedValue } from "@/use-debounced-value";
import { useFilteredPagedList } from "@/use-filtered-paged-list";

type EventFilter = "exit" | "return" | "guest_arrival" | "guest_departure" | null;

type HistoryFilters = {
  event: EventFilter;
  q: string;
};

const EVENTS: { value: EventFilter; label: string }[] = [
  { value: null, label: "All" },
  { value: "exit", label: "Exit" },
  { value: "return", label: "Return" },
  { value: "guest_arrival", label: "Guest in" },
  { value: "guest_departure", label: "Guest out" },
];

function historyKey(filters: HistoryFilters): string {
  return `${filters.event ?? ""}|${filters.q}`;
}

function historyPath(filters: HistoryFilters, offset: number): string {
  const search = new URLSearchParams(pageQuery(offset));
  if (filters.event) {
    search.set("event", filters.event);
  }
  if (filters.q.trim()) {
    search.set("q", filters.q.trim());
  }
  return `/gate/activity?${search.toString()}`;
}

export default function GateHistoryScreen() {
  const colors = useHallColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { staffRequest, staffText } = useSession();
  const [query, setQuery] = useState("");
  const q = useDebouncedValue(query);
  const [event, setEvent] = useState<EventFilter>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const filters = useMemo<HistoryFilters>(() => ({ event, q }), [event, q]);

  const list = useFilteredPagedList<GateEvent, HistoryFilters>({
    idOf: (item) => item.key,
    filters,
    filterKey: historyKey(filters),
    cacheScope: "gate-history",
    loadPage: useCallback(async (current, offset) => {
      const reply = await staffRequest(historyPath(current, offset));
      if (!reply.ok) {
        return { error: trimStop(reply.message) };
      }
      return { items: readActivity(reply.data, offset), total: readTotal(reply.data) };
    }, [staffRequest]),
  });

  const back = () => goBackOr(navigation, "/staff/settings");

  const exportActivity = async () => {
    if (exportBusy) {
      return;
    }
    setExportBusy(true);
    setExportError(null);
    const reply = await staffText(`/gate/activity/export${gateActivityExportQuery(filters)}`);
    const refused = replyError(reply);
    if (refused || !reply.ok || typeof reply.data !== "string") {
      setExportError(refused ?? "The gate export was not a CSV");
      setExportBusy(false);
      return;
    }
    const csv = gateActivityCsv(reply.data);
    if (!csv) {
      setExportError("The gate export was not a CSV");
      setExportBusy(false);
      return;
    }
    try {
      const uri = await writeCacheText(gateActivityExportFileName(hallDay(hallNow())), csv);
      const result = await shareLocalFile(uri, {
        mimeType: "text/csv",
        uti: "public.comma-separated-values-text",
        dialogTitle: "Export gate history",
      });
      if (result === "unavailable") {
        setExportError("Sharing is not available on this device");
      } else if (result === "failed") {
        setExportError("Gate history could not be shared");
      }
    } catch {
      setExportError("Gate history could not be shared");
    }
    setExportBusy(false);
  };

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.paper }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 28 },
      ]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} tintColor={colors.inkFaint} />
      }
      onMomentumScrollEnd={({ nativeEvent }) => {
        const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
        if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 120) {
          list.loadNext();
        }
      }}
    >
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={back} style={styles.back}>
        <BackMark color={colors.inkSoft} />
      </Pressable>
      <Text style={[text.hallName, styles.title, { color: colors.ink }]}>Gate history</Text>
      <Text style={[text.body, { color: colors.inkSoft }]}>Everyone recorded at the gate, newest first</Text>
      <SearchField value={query} placeholder="Name or room" onChange={setQuery} />
      <FilterChipRow>
        {EVENTS.map((item) => (
          <FilterChip
            key={item.label}
            label={item.label}
            on={event === item.value}
            onPress={() => setEvent(item.value)}
          />
        ))}
      </FilterChipRow>
      <View style={styles.list}>
        <PagedList
          rows={list.rows}
          error={list.error}
          pageError={list.pageError}
          showListSkeleton={list.showListSkeleton}
          showPageSkeleton={list.showPageSkeleton}
          filling={list.filling}
          onRetry={list.rows && list.rows.length > 0 ? list.refresh : list.retry}
          onRetryPage={() => list.loadNext(true)}
          empty={<Text style={[text.body, { color: colors.inkFaint }]}>No matching gate lines</Text>}
        >
          <View>
            {(list.rows ?? []).map((item, index, all) => (
              <DenseRow
                key={item.key}
                title={item.title}
                detail={item.detail}
                time={item.at}
                first={index === 0}
                last={index === all.length - 1}
              />
            ))}
          </View>
        </PagedList>
      </View>
      <HallButton label="Export" busy={exportBusy} onPress={() => void exportActivity()} />
      <Text style={[text.error, { color: colors.inkSoft }]}>
        Export includes up to 10,000 newest lines for the search and event type above
      </Text>
      <OfficeError message={exportError} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 28, gap: 16 },
  back: { flexDirection: "row", alignItems: "center", gap: 2, alignSelf: "flex-start", marginLeft: -6 },
  title: { textAlign: "left" },
  list: { marginTop: 4 },
});
