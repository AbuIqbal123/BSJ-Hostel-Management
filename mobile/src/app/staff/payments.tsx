import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { Image, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { goBackOr } from "@/back";
import { BackButton } from "@/components/back-button";
import { DenseRow } from "@/components/dense-row";
import { HallButton } from "@/components/hall-button";
import { SearchField } from "@/components/search-field";
import { TextField } from "@/components/text-field";
import { EmptyState, ListError, RetryRow } from "@/components/list-state";
import { PagedList } from "@/components/paged-list";
import { SkeletonRows } from "@/components/skeleton";
import { useKeyedButtonFeedback } from "@/button-feedback";
import { useDelayedLoading } from "@/use-delayed-loading";
import { useDebouncedValue } from "@/use-debounced-value";
import { useFilteredPagedList } from "@/use-filtered-paged-list";
import {
  CLOSED_STAY,
  NOTE_REQUIRED,
  PAYMENT_LOCKED,
  UNSUPPORTED_FILE,
  evidenceKind,
  lockCopy,
  paymentLabel,
  paymentsListPath,
  readPaymentPage,
  readPaymentStay,
  type PaymentCard,
  type PaymentStay,
} from "@/payment-file";
import { prepareUpload, type PreparedReceipt, type SourceFile } from "@/prepare-upload";
import { useSession, type StaffReply } from "@/session";
import { formatHallDate } from "@/format-when";
import { readsRegister, shortDay, trimStop } from "@/staff";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

function refusal(reply: StaffReply): string {
  if (!reply.ok && reply.code === "payment_locked") {
    return PAYMENT_LOCKED;
  }
  return trimStop(reply.ok ? "" : reply.message);
}

function PaymentsFrame({
  title,
  afterTitle,
  children,
}: {
  title: string;
  afterTitle?: ReactNode;
  children: ReactNode;
}) {
  const colors = useHallColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  return (
    <View style={[styles.screen, { backgroundColor: colors.paper, paddingTop: insets.top + 28 }]}>
      <View style={styles.pad}>
        <BackButton onPress={() => goBackOr(navigation, "/staff")} />
        <Text style={[text.hallName, styles.title, { color: colors.ink }]}>{title}</Text>
        {afterTitle}
      </View>
      {children}
    </View>
  );
}

function PaymentList() {
  const colors = useHallColors();
  const insets = useSafeAreaInsets();
  const { staffRequest } = useSession();
  const [query, setQuery] = useState("");
  const q = useDebouncedValue(query);
  const needle = q.trim().slice(0, 80);
  const filters = useMemo(() => ({ q: needle }), [needle]);
  const list = useFilteredPagedList<PaymentCard, { q: string }>({
    idOf: (stay) => stay.id,
    filters,
    filterKey: needle,
    loadPage: useCallback(async (current, offset) => {
      const reply = await staffRequest(paymentsListPath(offset, current.q));
      const page = reply.ok ? readPaymentPage(reply.data) : null;
      if (page) {
        return { items: page.items, total: page.total };
      }
      return { error: !reply.ok ? trimStop(reply.message) : "The guest list could not be read" };
    }, [staffRequest]),
  });

  const rows = list.rows ?? [];

  return (
    <PaymentsFrame
      title="Guest payments"
      afterTitle={
        <>
          <SearchField value={query} placeholder="Guest, host, or room" onChange={setQuery} />
          {list.error && rows.length > 0 ? <ListError message={list.error} onRetry={list.refresh} /> : null}
        </>
      }
    >
      <PagedList
        kind="flat"
        style={styles.list}
        rows={list.rows}
        data={rows}
        error={rows.length > 0 ? null : list.error}
        pageError={list.pageError}
        showListSkeleton={list.showListSkeleton}
        showPageSkeleton={list.showPageSkeleton}
        onRetry={list.retry}
        onRetryPage={() => list.loadNext(true)}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 28, paddingHorizontal: 28, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} tintColor={colors.inkFaint} />}
        onEndReached={() => list.loadNext()}
        empty={<EmptyState message={q.trim() ? `Nothing matches ${q.trim()}` : "No guest stays"} />}
        renderItem={({ item, index }) => (
          <DenseRow
            title={item.guestName}
            detail={`${item.hostRoom} · ${item.hostName} · ${shortDay(formatHallDate(item.start))} to ${shortDay(formatHallDate(item.end))}`}
            time={paymentLabel(item.paymentStatus)}
            first={index === 0}
            last={index === rows.length - 1}
            onPress={() => router.push({ pathname: "/staff/payments", params: { id: item.id } })}
          />
        )}
      />
    </PaymentsFrame>
  );
}

function PaymentDetail({ id }: { id: string }) {
  const colors = useHallColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { staffRequest, staffFile, staffPreview } = useSession();
  const [stay, setStay] = useState<PaymentStay | null>(null);
  const [note, setNote] = useState("");
  const [draft, setDraft] = useState<PreparedReceipt | null>(null);
  const [storedPreview, setStoredPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const cue = useKeyedButtonFeedback<"paid" | "unpaid" | "upload" | "remove">();
  const [preparing, setPreparing] = useState(false);
  const [preparingPhoto, setPreparingPhoto] = useState(false);
  const [prepareError, setPrepareError] = useState<string | null>(null);
  const lastSource = useRef<SourceFile | null>(null);
  const [loaded, setLoaded] = useState(false);
  const showStaySkeleton = useDelayedLoading(!loaded && stay === null && loadError === null) && loadError === null;

  const apply = (reply: StaffReply) => {
    if (!reply.ok) {
      setError(refusal(reply));
      return;
    }
    const next = readPaymentStay(reply.data);
    if (!next) {
      setError("The guest stay could not be read");
      return;
    }
    setStay(next);
    setNote(next.note);
    setError(null);
  };

  const load = useCallback(async () => {
    const reply = await staffRequest(`/guest-stays/${encodeURIComponent(id)}`);
    if (!reply.ok) {
      setLoadError(refusal(reply));
      setLoaded(true);
      return;
    }
    const next = readPaymentStay(reply.data);
    if (!next) {
      setLoadError("The guest stay could not be read");
      setLoaded(true);
      return;
    }
    setStay(next);
    setNote(next.note);
    setLoadError(null);
    setError(null);
    setLoaded(true);
  }, [id, staffRequest]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!stay?.evidenceType?.startsWith("image/")) {
      setStoredPreview(null);
      return;
    }
    let active = true;
    void staffPreview(`/guest-stays/${encodeURIComponent(id)}/payment/evidence`).then((reply) => {
      if (!active) {
        return;
      }
      setStoredPreview(reply.ok ? reply.uri : null);
    });
    return () => {
      active = false;
    };
  }, [id, staffPreview, stay?.evidenceName, stay?.evidenceType]);

  const accept = async (source: SourceFile) => {
    lastSource.current = source;
    const kind = evidenceKind(source.mime, source.name);
    setPreparing(true);
    setPreparingPhoto(kind !== "pdf");
    setPrepareError(null);
    setError(null);
    const prepared = await prepareUpload(source);
    setPreparing(false);
    setPreparingPhoto(false);
    if (!prepared.ok) {
      setDraft(null);
      setPrepareError(prepared.message);
      return;
    }
    setDraft(prepared.file);
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError("Allow the camera in Settings to photograph a receipt");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], exif: false });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset || (asset.type && asset.type !== "image")) {
      if (asset) {
        setError(UNSUPPORTED_FILE);
      }
      return;
    }
    await accept({
      uri: asset.uri,
      name: asset.fileName ?? "photo.jpg",
      mime: asset.mimeType ?? null,
      width: asset.width,
      height: asset.height,
    });
  };

  const choosePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Allow photos in Settings to choose a receipt");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], exif: false });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset || (asset.type && asset.type !== "image")) {
      if (asset) {
        setError(UNSUPPORTED_FILE);
      }
      return;
    }
    await accept({
      uri: asset.uri,
      name: asset.fileName ?? "photo.jpg",
      mime: asset.mimeType ?? null,
      width: asset.width,
      height: asset.height,
    });
  };

  const choosePdf = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      copyToCacheDirectory: true,
      multiple: false,
    });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) {
      return;
    }
    await accept({
      uri: asset.uri,
      name: asset.name,
      mime: asset.mimeType ?? "application/pdf",
      width: null,
      height: null,
    });
  };

  const savePayment = async (status: "paid" | "unpaid") => {
    if (cue.held) {
      return;
    }
    if (status === "paid" && note.trim().length === 0) {
      setError(NOTE_REQUIRED);
      return;
    }
    cue.markBusy(status);
    const reply = await staffRequest(`/guest-stays/${encodeURIComponent(id)}/payment`, {
      payment_status: status,
      ...(status === "paid" ? { payment_note: note.trim() } : {}),
    });
    if (!reply.ok) {
      apply(reply);
      cue.markFailure();
      return;
    }
    apply(reply);
    if (status === "unpaid") {
      setDraft(null);
    }
    cue.markSuccess(status);
  };

  const upload = async () => {
    if (!draft || cue.held) {
      return;
    }
    cue.markBusy("upload");
    const reply = await staffFile(`/guest-stays/${encodeURIComponent(id)}/payment/evidence`, {
      uri: draft.uri,
      name: draft.name,
      type: draft.type,
    });
    if (!reply.ok) {
      apply(reply);
      cue.markFailure();
      return;
    }
    setDraft(null);
    apply(reply);
    cue.markSuccess("upload");
  };

  const removeEvidence = async () => {
    if (cue.held) {
      return;
    }
    cue.markBusy("remove");
    const reply = await staffRequest(`/guest-stays/${encodeURIComponent(id)}/payment/evidence`, undefined, "DELETE");
    if (!reply.ok) {
      apply(reply);
      cue.markFailure();
      return;
    }
    setDraft(null);
    setStoredPreview(null);
    apply(reply);
    cue.markSuccess("remove");
  };

  const locked = stay ? lockCopy(stay) : null;
  const busy = cue.held || preparing;
  const previewUri = draft?.preview ? draft.uri : storedPreview;
  const evidenceLabel = draft?.name ?? stay?.evidenceName;

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.paper }]}
      contentContainerStyle={[styles.detail, { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 28 }]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
    >
      <BackButton onPress={() => goBackOr(navigation, "/staff/payments")} />
      {showStaySkeleton ? <SkeletonRows count={3} kind="card" /> : null}
      {loaded && !stay && loadError ? <ListError message={loadError} onRetry={() => void load()} /> : null}
      {stay ? (
        <>
          <Text style={[text.hallName, styles.title, { color: colors.ink }]}>{stay.guestName}</Text>
          <Text style={[text.body, { color: colors.inkSoft }]}>
            {`${stay.hostName}, ${stay.hostRoom}`}
          </Text>
          <Text style={[text.body, { color: colors.ink }]}>{paymentLabel(stay.paymentStatus)}</Text>
          {locked ? (
            <Text style={[text.body, { color: colors.ink }]}>{locked === CLOSED_STAY ? CLOSED_STAY : PAYMENT_LOCKED}</Text>
          ) : (
            <>
              <TextField
                label="Note"
                placeholder="Note, such as who took the payment"
                value={note}
                onChangeText={setNote}
                maxLength={500}
                autoCapitalize="sentences"
              />
              <HallButton
                label="Mark paid"
                busy={cue.busy("paid")}
                succeeded={cue.succeeded("paid")}
                disabled={busy}
                onPress={() => void savePayment("paid")}
              />
              <HallButton
                kind="text"
                label="Mark unpaid"
                busy={cue.busy("unpaid")}
                disabled={busy}
                onPress={() => void savePayment("unpaid")}
              />
              {stay.evidenceName ? (
                <Text style={[text.body, { color: colors.inkSoft }]}>Marking unpaid removes the receipt</Text>
              ) : null}
            </>
          )}
          <Text style={[text.button, { color: colors.ink }]}>Receipt</Text>
          {previewUri ? (
            <Image source={{ uri: previewUri }} style={styles.preview} resizeMode="contain" accessibilityLabel="Receipt preview" />
          ) : null}
          {evidenceLabel && !draft?.preview ? (
            <Text selectable style={[text.body, { color: colors.ink }]}>
              {evidenceLabel}
            </Text>
          ) : null}
          {draft ? (
            <Text selectable style={[text.body, { color: colors.ink }]}>
              {draft.preview ? draft.name : `${draft.name}, PDF`}
            </Text>
          ) : null}
          {preparing && preparingPhoto ? (
            <Text accessibilityLiveRegion="polite" style={[text.body, { color: colors.inkSoft }]}>
              Preparing photo
            </Text>
          ) : null}
          {prepareError ? (
            <RetryRow
              message={prepareError}
              onRetry={() => {
                const source = lastSource.current;
                if (source) {
                  void accept(source);
                }
              }}
            />
          ) : null}
          {locked ? null : (
            <>
              <HallButton kind="text" label="Take a photo" disabled={busy} onPress={() => void takePhoto()} />
              <HallButton kind="text" label="Choose a photo" disabled={busy} onPress={() => void choosePhoto()} />
              <HallButton kind="text" label="Choose a PDF" disabled={busy} onPress={() => void choosePdf()} />
              {draft ? (
                <HallButton
                  kind="secondary"
                  label="Upload receipt"
                  busy={cue.busy("upload")}
                  succeeded={cue.succeeded("upload")}
                  disabled={busy}
                  onPress={() => void upload()}
                />
              ) : null}
              {stay.evidenceName ? (
                <HallButton
                  kind="danger"
                  label="Remove receipt"
                  busy={cue.busy("remove")}
                  disabled={busy}
                  onPress={() => void removeEvidence()}
                />
              ) : null}
            </>
          )}
        </>
      ) : null}
      {error ? (
        <Text accessibilityLiveRegion="polite" selectable style={[text.error, { color: colors.danger }]}>
          {error}
        </Text>
      ) : null}
    </ScrollView>
  );
}

export default function PaymentsScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = typeof params.id === "string" ? params.id : "";
  const { user } = useSession();
  const colors = useHallColors();

  if (!user || !readsRegister(user.role)) {
    return (
      <View style={[styles.screen, styles.denied, { backgroundColor: colors.paper }]}>
        <Text style={[text.body, { color: colors.ink }]}>This account cannot mark a payment</Text>
      </View>
    );
  }
  if (id.length > 0) {
    return <PaymentDetail id={id} />;
  }
  return <PaymentList />;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { flex: 1 },
  pad: { paddingHorizontal: 28, gap: 16 },
  detail: { flexGrow: 1, paddingHorizontal: 28, gap: 16 },

  title: { textAlign: "left" },
  preview: { width: "100%", height: 220, borderRadius: 12, borderCurve: "continuous" },
  denied: { alignItems: "center", justifyContent: "center", padding: 28 },
});
