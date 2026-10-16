import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
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
  const [items, setItems] = useState<PaymentCard[]>([]);
  const [total, setTotal] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loading = useRef(false);
  const generation = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setQ(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const loadPage = useCallback(
    async (offset: number) => {
      if (loading.current) {
        return;
      }
      loading.current = true;
      const run = generation.current;
      const search = q.trim() ? `&q=${encodeURIComponent(q.trim())}` : "";
      const reply = await staffRequest(`/guest-stays?limit=50&offset=${offset}${search}`);
      loading.current = false;
      if (run !== generation.current) {
        return;
      }
      if (!reply.ok) {
        setError(trimStop(reply.message));
        setLoaded(true);
        return;
      }
      const page = readPaymentPage(reply.data);
      if (!page) {
        setError("The guest list could not be read");
        setLoaded(true);
        return;
      }
      setError(null);
      setTotal(page.total);
      setItems((current) => (offset === 0 ? page.items : [...current, ...page.items]));
      setLoaded(true);
    },
    [q, staffRequest],
  );

  useEffect(() => {
    generation.current += 1;
    loading.current = false;
    setItems([]);
    setLoaded(false);
    void loadPage(0);
  }, [loadPage]);

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
        {error ? (
          <Text accessibilityLiveRegion="polite" style={[text.error, { color: colors.danger }]}>
            {error}
          </Text>
        ) : null}
      </View>
      <FlatList
        style={styles.list}
        data={items}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 28, paddingHorizontal: 28, flexGrow: 1 }}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (items.length < total) {
            void loadPage(items.length);
          }
        }}
        ListEmptyComponent={
          loaded && !error ? (
            <Text style={[text.body, styles.empty, { color: colors.inkSoft }]}>
              {q.trim() ? `Nothing matches ${q.trim()}` : "No guest stays"}
            </Text>
          ) : null
        }
        renderItem={({ item, index }) => (
          <DenseRow
            title={item.guestName}
            detail={`${item.hostRoom} · ${item.hostName} · ${shortDay(formatHallDate(item.start))} to ${shortDay(formatHallDate(item.end))}`}
            time={paymentLabel(item.paymentStatus)}
            first={index === 0}
            last={index === items.length - 1}
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
  const [busy, setBusy] = useState(false);
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
    apply(reply);
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
    setBusy(true);
    setError(null);
    const prepared = await prepareReceipt(source);
    setBusy(false);
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
    setBusy(true);
    const reply = await staffRequest(`/guest-stays/${encodeURIComponent(id)}/payment`, {
      payment_status: status,
      ...(status === "paid" ? { payment_note: note.trim() } : {}),
    });
    setBusy(false);
    apply(reply);
    if (reply.ok && status === "unpaid") {
      setDraft(null);
    }
  };

  const upload = async () => {
    if (!draft) {
      return;
    }
    setBusy(true);
    const reply = await staffFile(`/guest-stays/${encodeURIComponent(id)}/payment/evidence`, {
      uri: draft.uri,
      name: draft.name,
      type: draft.type,
    });
    setBusy(false);
    if (reply.ok) {
      setDraft(null);
    }
    apply(reply);
  };

  const removeEvidence = async () => {
    setBusy(true);
    const reply = await staffRequest(`/guest-stays/${encodeURIComponent(id)}/payment/evidence`, undefined, "DELETE");
    setBusy(false);
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
      {!loaded ? <ActivityIndicator color={colors.forest} /> : null}
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
              <HallButton label="Mark paid" disabled={busy} onPress={() => void savePayment("paid")} />
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => void savePayment("unpaid")} style={styles.textButton}>
                <Text style={[text.button, { color: colors.ink }]}>Mark unpaid</Text>
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
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => void takePhoto()} style={styles.textButton}>
                <Text style={[text.button, { color: colors.forest }]}>Take a photo</Text>
              </Pressable>
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => void choosePhoto()} style={styles.textButton}>
                <Text style={[text.button, { color: colors.forest }]}>Choose a photo</Text>
              </Pressable>
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => void choosePdf()} style={styles.textButton}>
                <Text style={[text.button, { color: colors.forest }]}>Choose a PDF</Text>
              </Pressable>
              {draft ? <HallButton label="Upload receipt" disabled={busy} onPress={() => void upload()} /> : null}
              {stay.evidenceName ? (
                <Pressable accessibilityRole="button" disabled={busy} onPress={() => void removeEvidence()} style={styles.textButton}>
                  <Text style={[text.button, { color: colors.danger }]}>Remove receipt</Text>
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
