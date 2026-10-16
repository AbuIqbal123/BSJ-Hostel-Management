import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { goBackOr } from "@/back";
import { BackMark } from "@/components/back-mark";
import { DenseRow } from "@/components/dense-row";
import { HallButton } from "@/components/hall-button";
import { EmptyState, ListError, RetryRow } from "@/components/list-state";
import { SkeletonRows } from "@/components/skeleton";
import { acceptFailure, acceptPage, shouldRequestNext, type Listed } from "@/list-page";
import {
  CLOSED_STAY,
  NOTE_REQUIRED,
  PAYMENT_LOCKED,
  UNSUPPORTED_FILE,
  lockCopy,
  paymentLabel,
  readPaymentPage,
  readPaymentStay,
  type PaymentCard,
  type PaymentStay,
} from "@/payment-file";
import { prepareReceipt, type PreparedReceipt, type SourceFile } from "@/prepare-receipt";
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

function PaymentsFrame({ title, children }: { title: string; children: ReactNode }) {
  const colors = useHallColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  return (
    <View style={[styles.screen, { backgroundColor: colors.paper, paddingTop: insets.top + 28 }]}>
      <View style={styles.pad}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => goBackOr(navigation, "/staff")}
          style={styles.back}
        >
          <BackMark color={colors.inkSoft} />
        </Pressable>
        <Text style={[text.hallName, styles.title, { color: colors.ink }]}>{title}</Text>
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
  const [q, setQ] = useState("");
  const [list, setList] = useState<Listed<PaymentCard>>({ rows: null, total: 0, error: null, pageError: null });
  const [refreshing, setRefreshing] = useState(false);
  const [pagingUi, setPagingUi] = useState(false);
  const paging = useRef(false);
  const generation = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setQ(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const loadPage = useCallback(
    async (offset: number, fromPull = false) => {
      if (offset > 0) {
        if (paging.current) {
          return;
        }
        paging.current = true;
        setPagingUi(true);
      }
      if (fromPull) {
        setRefreshing(true);
      }
      const run = generation.current;
      const search = q.trim() ? `&q=${encodeURIComponent(q.trim())}` : "";
      const reply = await staffRequest(`/guest-stays?limit=50&offset=${offset}${search}`);
      if (offset > 0) {
        paging.current = false;
        setPagingUi(false);
      }
      if (fromPull) {
        setRefreshing(false);
      }
      if (run !== generation.current) {
        return;
      }
      const page = reply.ok ? readPaymentPage(reply.data) : null;
      const message = !reply.ok ? trimStop(reply.message) : "The guest list could not be read";
      setList((state) =>
        page ? acceptPage(state, offset, page.items, page.total, (item) => item.id) : acceptFailure(state, offset, message),
      );
    },
    [q, staffRequest],
  );

  useEffect(() => {
    generation.current += 1;
    paging.current = false;
    setPagingUi(false);
    setList({ rows: null, total: 0, error: null, pageError: null });
    void loadPage(0);
  }, [loadPage]);

  const rows = list.rows ?? [];

  return (
    <PaymentsFrame title="Guest payments">
      <View style={styles.pad}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Guest, host, or room"
          placeholderTextColor={colors.inkFaint}
          autoCapitalize="none"
          autoCorrect={false}
          style={[text.field, styles.search, { backgroundColor: colors.surface, borderColor: colors.line, color: colors.ink }]}
        />
        {list.error && rows.length > 0 ? <ListError message={list.error} onRetry={() => void loadPage(0, true)} /> : null}
      </View>
      <FlatList
        style={styles.list}
        data={rows}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 28, paddingHorizontal: 28, flexGrow: 1 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void loadPage(0, true)} tintColor={colors.inkFaint} />
        }
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (shouldRequestNext(rows.length, list.total, paging.current, list.pageError !== null)) {
            void loadPage(rows.length);
          }
        }}
        ListEmptyComponent={
          list.rows === null && !list.error ? (
            <SkeletonRows count={4} kind="row" />
          ) : list.error && rows.length === 0 ? (
            <ListError message={list.error} onRetry={() => void loadPage(0)} />
          ) : list.rows && rows.length === 0 ? (
            <EmptyState message={q.trim() ? `Nothing matches ${q.trim()}` : "No guest stays"} />
          ) : null
        }
        ListFooterComponent={
          pagingUi ? (
            <SkeletonRows count={1} kind="row" />
          ) : list.pageError ? (
            <RetryRow message={list.pageError} onRetry={() => void loadPage(rows.length)} />
          ) : null
        }
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
  const [action, setAction] = useState<"paid" | "unpaid" | "upload" | "remove" | null>(null);
  const [loaded, setLoaded] = useState(false);

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
    setAction("upload");
    setError(null);
    const prepared = await prepareReceipt(source);
    setAction(null);
    if (!prepared.ok) {
      setDraft(null);
      setError(prepared.message);
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
    if (status === "paid" && note.trim().length === 0) {
      setError(NOTE_REQUIRED);
      return;
    }
    setAction(status);
    const reply = await staffRequest(`/guest-stays/${encodeURIComponent(id)}/payment`, {
      payment_status: status,
      ...(status === "paid" ? { payment_note: note.trim() } : {}),
    });
    setAction(null);
    apply(reply);
    if (reply.ok && status === "unpaid") {
      setDraft(null);
    }
  };

  const upload = async () => {
    if (!draft) {
      return;
    }
    setAction("upload");
    const reply = await staffFile(`/guest-stays/${encodeURIComponent(id)}/payment/evidence`, {
      uri: draft.uri,
      name: draft.name,
      type: draft.type,
    });
    setAction(null);
    if (reply.ok) {
      setDraft(null);
    }
    apply(reply);
  };

  const removeEvidence = async () => {
    setAction("remove");
    const reply = await staffRequest(`/guest-stays/${encodeURIComponent(id)}/payment/evidence`, undefined, "DELETE");
    setAction(null);
    if (reply.ok) {
      setDraft(null);
      setStoredPreview(null);
    }
    apply(reply);
  };

  const locked = stay ? lockCopy(stay) : null;
  const previewUri = draft?.preview ? draft.uri : storedPreview;
  const evidenceLabel = draft?.name ?? stay?.evidenceName;

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.paper }]}
      contentContainerStyle={[styles.detail, { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 28 }]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={() => goBackOr(navigation, "/staff/payments")}
        style={styles.back}
      >
        <BackMark color={colors.inkSoft} />
      </Pressable>
      {!loaded && !stay ? <SkeletonRows count={3} kind="card" /> : null}
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
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Note, such as who took the payment"
                placeholderTextColor={colors.inkFaint}
                maxLength={500}
                style={[text.field, styles.note, { backgroundColor: colors.surface, borderColor: colors.line, color: colors.ink }]}
              />
              <HallButton label="Mark paid" busy={action === "paid"} disabled={action !== null} onPress={() => void savePayment("paid")} />
              <Pressable accessibilityRole="button" disabled={action !== null} onPress={() => void savePayment("unpaid")} style={styles.textButton}>
                {action === "unpaid" ? (
                  <ActivityIndicator color={colors.ink} />
                ) : (
                  <Text style={[text.button, { color: colors.ink }]}>Mark unpaid</Text>
                )}
              </Pressable>
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
          {locked ? null : (
            <>
              <Pressable accessibilityRole="button" disabled={action !== null} onPress={() => void takePhoto()} style={styles.textButton}>
                <Text style={[text.button, { color: colors.forest }]}>Take a photo</Text>
              </Pressable>
              <Pressable accessibilityRole="button" disabled={action !== null} onPress={() => void choosePhoto()} style={styles.textButton}>
                <Text style={[text.button, { color: colors.forest }]}>Choose a photo</Text>
              </Pressable>
              <Pressable accessibilityRole="button" disabled={action !== null} onPress={() => void choosePdf()} style={styles.textButton}>
                <Text style={[text.button, { color: colors.forest }]}>Choose a PDF</Text>
              </Pressable>
              {draft ? <HallButton label="Upload receipt" busy={action === "upload"} disabled={action !== null} onPress={() => void upload()} /> : null}
              {stay.evidenceName ? (
                <Pressable accessibilityRole="button" disabled={action !== null} onPress={() => void removeEvidence()} style={styles.textButton}>
                  {action === "remove" ? (
                    <ActivityIndicator color={colors.danger} />
                  ) : (
                    <Text style={[text.button, { color: colors.danger }]}>Remove receipt</Text>
                  )}
                </Pressable>
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
  back: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center", marginLeft: -6 },
  title: { textAlign: "left" },
  search: { height: 48, borderWidth: 1, borderRadius: 12, borderCurve: "continuous", paddingHorizontal: 14 },
  note: { minHeight: 52, borderWidth: 1, borderRadius: 12, borderCurve: "continuous", paddingHorizontal: 14 },
  empty: { textAlign: "center", paddingTop: 96 },
  textButton: { minHeight: 44, justifyContent: "center" },
  preview: { width: "100%", height: 220, borderRadius: 12, borderCurve: "continuous" },
  denied: { alignItems: "center", justifyContent: "center", padding: 28 },
});
