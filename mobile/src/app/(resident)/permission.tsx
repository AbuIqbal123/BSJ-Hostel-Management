import { useCallback, useEffect, useRef, useState } from "react";
import { Redirect, router, useFocusEffect, useLocalSearchParams, useNavigation } from "expo-router";
import { Alert, InteractionManager, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TextField } from "@/components/text-field";
import { formatWhen, utcInstant } from "@/format-when";
import { WhenField } from "@/outing-when";
import {
  useSession,
  type HallPermission,
  type PermissionKind,
  type PermissionStatus,
} from "@/session";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

function paramText(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
  return raw.trim();
}

function kindParam(value: string): PermissionKind | null {
  if (value === "late_night" || value === "home_going") {
    return value;
  }
  return null;
}

function kindLabel(kind: PermissionKind): string {
  return kind === "late_night" ? "Late-night" : "Home going";
}

function statusSentence(status: PermissionStatus): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "cancelled":
      return "Cancelled";
    case "in_use":
      return "You are out on this";
    case "completed":
      return "Completed";
    case "expired":
      return "Expired";
  }
}

function departureNote(leaveAt: Date | null): string | null {
  if (!leaveAt) {
    return null;
  }
  if (leaveAt.getTime() < Date.now()) {
    return "Departure must not be in the past.";
  }
  return null;
}

function returnAfterNote(leaveAt: Date | null, backBy: Date | null): string | null {
  if (!leaveAt || !backBy) {
    return null;
  }
  if (backBy.getTime() <= leaveAt.getTime()) {
    return "Expected return must be after departure.";
  }
  return null;
}

function usePermissionBack() {
  const navigation = useNavigation();
  const leaving = useRef(false);
  return useCallback(() => {
    if (leaving.current) {
      return;
    }
    leaving.current = true;
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    router.navigate("/permissions");
  }, [navigation]);
}

function BackButton({ onPress }: { onPress: () => void }) {
  const colors = useHallColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      onPress={onPress}
      style={styles.back}
    >
      <Text style={[text.button, { color: colors.inkSoft }]}>Back</Text>
    </Pressable>
  );
}

function PermissionForm({ kind }: { kind: PermissionKind }) {
  const colors = useHallColors();
  const insets = useSafeAreaInsets();
  const { submitPermission } = useSession();
  const back = usePermissionBack();
  const [place, setPlace] = useState("");
  const [detail, setDetail] = useState("");
  const [address, setAddress] = useState("");
  const [reason, setReason] = useState("");
  const [leaveAt, setLeaveAt] = useState<Date | null>(null);
  const [backBy, setBackBy] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const holdSubmit = useRef(0);

  const leaveProblem = departureNote(leaveAt);
  const backProblem = returnAfterNote(leaveAt, backBy);
  const ready =
    place.trim().length > 0 &&
    reason.trim().length > 0 &&
    (kind === "late_night" || address.trim().length > 0) &&
    leaveAt !== null &&
    backBy !== null &&
    leaveProblem === null &&
    backProblem === null;

  const hold = useCallback(() => {
    holdSubmit.current = Date.now() + 700;
  }, []);

  const submit = useCallback(async () => {
    if (Date.now() < holdSubmit.current || pending.current) {
      return;
    }
    if (!ready || !leaveAt || !backBy) {
      return;
    }
    pending.current = true;
    setError(null);
    const shortPlace = place.trim();
    const reasonText = reason.trim();
    const departureAt = utcInstant(leaveAt);
    const expectedReturnAt = utcInstant(backBy);
    const destination = detail.trim();
    const message =
      kind === "late_night"
        ? await submitPermission(
            destination.length > 0
              ? {
                  permission_type: "late_night",
                  short_place: shortPlace,
                  reason: reasonText,
                  departure_at: departureAt,
                  expected_return_at: expectedReturnAt,
                  destination_detail: destination,
                }
              : {
                  permission_type: "late_night",
                  short_place: shortPlace,
                  reason: reasonText,
                  departure_at: departureAt,
                  expected_return_at: expectedReturnAt,
                },
          )
        : await submitPermission({
            permission_type: "home_going",
            short_place: shortPlace,
            address: address.trim(),
            reason: reasonText,
            departure_at: departureAt,
            expected_return_at: expectedReturnAt,
          });
    pending.current = false;
    if (message) {
      setError(message);
      return;
    }
    back();
  }, [address, back, backBy, detail, kind, leaveAt, place, ready, reason, submitPermission]);

  const frame = {
    paddingTop: insets.top + 28,
    paddingBottom: insets.bottom + 28,
  };

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.paper }]}
      contentContainerStyle={[styles.content, frame]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      showsVerticalScrollIndicator={false}
    >
      <BackButton onPress={back} />
      <Text style={[text.hallName, styles.title, { color: colors.ink }]}>{kindLabel(kind)}</Text>
      <View style={styles.fields}>
        <TextField
          label="Place"
          value={place}
          onChangeText={(value) => {
            setPlace(value);
            setError(null);
          }}
          autoCapitalize="sentences"
          autoComplete="off"
          maxLength={120}
        />
        {kind === "late_night" ? (
          <TextField
            label="Detail"
            value={detail}
            onChangeText={(value) => {
              setDetail(value);
              setError(null);
            }}
            autoCapitalize="sentences"
            autoComplete="off"
            maxLength={120}
          />
        ) : (
          <TextField
            label="Address"
            value={address}
            onChangeText={(value) => {
              setAddress(value);
              setError(null);
            }}
            autoCapitalize="sentences"
            autoComplete="off"
            maxLength={300}
          />
        )}
        <TextField
          label="Reason"
          value={reason}
          onChangeText={(value) => {
            setReason(value);
            setError(null);
          }}
          autoCapitalize="sentences"
          autoComplete="off"
          maxLength={500}
        />
        <WhenField
          label="Leave at"
          value={leaveAt}
          note={leaveProblem}
          onAdjust={hold}
          onChange={(date) => {
            setLeaveAt(date);
            setError(null);
          }}
        />
        <WhenField
          label="Back by"
          value={backBy}
          note={backProblem}
          onAdjust={hold}
          onChange={(date) => {
            setBackBy(date);
            setError(null);
          }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Submit"
          accessibilityState={{ disabled: !ready }}
          disabled={!ready}
          hitSlop={12}
          onPress={() => {
            setTimeout(() => {
              void submit();
            }, 50);
          }}
          style={styles.submit}
        >
          <Text style={[text.button, { color: ready ? colors.forest : colors.inkFaint }]}>Submit</Text>
        </Pressable>
        {error ? (
          <Text selectable style={[text.error, { color: colors.danger }]}>
            {error}
          </Text>
        ) : null}
      </View>
    </ScrollView>
  );
}

function PermissionDetail({ id }: { id: string }) {
  const colors = useHallColors();
  const insets = useSafeAreaInsets();
  const { loadPermission, cancelPermission } = useSession();
  const back = usePermissionBack();
  const [permission, setPermission] = useState<HallPermission | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const alertAt = useRef(0);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadPermissionRef = useRef(loadPermission);
  loadPermissionRef.current = loadPermission;

  const load = useCallback(() => {
    let active = true;
    void loadPermissionRef.current(id).then((result) => {
      if (!active) {
        return;
      }
      if (result.error !== null) {
        setError(result.error);
        return;
      }
      setError(null);
      setPermission(result.permission);
    });
    return () => {
      active = false;
    };
  }, [id]);

  useFocusEffect(load);

  // The alert is still closing when cancel returns. Navigating then drops the pop.
  const leaveWhenStill = useCallback(() => {
    const wait = Math.max(0, 250 - (Date.now() - alertAt.current));
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
    }
    leaveTimer.current = setTimeout(() => {
      InteractionManager.runAfterInteractions(back);
    }, wait);
  }, [back]);

  useEffect(() => {
    return () => {
      if (leaveTimer.current) {
        clearTimeout(leaveTimer.current);
      }
    };
  }, []);

  const confirmCancel = useCallback(async () => {
    if (pending.current) {
      return;
    }
    pending.current = true;
    setError(null);
    const failure = await cancelPermission(id);
    pending.current = false;
    if (failure) {
      setError(failure.message);
      const again = await loadPermission(id);
      if (again.error === null) {
        setPermission(again.permission);
      }
      return;
    }
    leaveWhenStill();
  }, [cancelPermission, id, leaveWhenStill, loadPermission]);

  const askCancel = useCallback(() => {
    Alert.alert("Cancel permission", undefined, [
      { text: "Back", style: "cancel" },
      {
        text: "Cancel permission",
        style: "destructive",
        onPress: () => {
          alertAt.current = Date.now();
          void confirmCancel();
        },
      },
    ]);
  }, [confirmCancel]);

  const frame = {
    paddingTop: insets.top + 28,
    paddingBottom: insets.bottom + 28,
  };
  const detail = permission?.destinationDetail?.trim() ?? "";
  const address = permission?.address?.trim() ?? "";
  const note = permission?.decisionNote?.trim() ?? "";
  const facts: { label: string; value: string }[] = [];
  if (permission) {
    if (detail.length > 0) {
      facts.push({ label: "Detail", value: detail });
    }
    if (address.length > 0) {
      facts.push({ label: "Address", value: address });
    }
    facts.push({ label: "Reason", value: permission.reason });
    facts.push({ label: "Leave at", value: formatWhen(permission.departureAt) });
    facts.push({ label: "Back by", value: formatWhen(permission.expectedReturnAt) });
    if (note.length > 0) {
      facts.push({ label: "Note", value: note });
    }
  }
  const canCancel = permission?.status === "pending" || permission?.status === "approved";

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.paper }]}
      contentContainerStyle={[styles.content, frame]}
      showsVerticalScrollIndicator={false}
    >
      <BackButton onPress={back} />
      {permission ? (
        <View style={styles.block}>
          <View style={styles.heading}>
            <Text style={[text.hallName, styles.title, { color: colors.ink }]}>{permission.shortPlace}</Text>
            <Text style={[text.body, { color: colors.inkSoft }]}>{kindLabel(permission.permissionType)}</Text>
            <Text style={[text.body, { color: colors.ink }]}>{statusSentence(permission.status)}</Text>
          </View>
          <View>
            {facts.map((fact, index) => (
              <View
                key={fact.label}
                style={[
                  styles.fact,
                  index > 0
                    ? { borderTopColor: colors.line, borderTopWidth: StyleSheet.hairlineWidth }
                    : null,
                ]}
              >
                <Text style={[text.label, { color: colors.inkSoft }]}>{fact.label}</Text>
                <Text selectable style={[text.body, { color: colors.ink }]}>
                  {fact.value}
                </Text>
              </View>
            ))}
          </View>
          {permission.status === "approved" ? (
            <Text style={[text.body, { color: colors.ink }]}>
              The gate can use this from the lead time before you leave until you are due back.
            </Text>
          ) : null}
          {canCancel ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel permission"
              onPress={askCancel}
              style={styles.cancel}
            >
              <Text style={[text.button, { color: colors.danger }]}>Cancel permission</Text>
            </Pressable>
          ) : null}
          {error ? (
            <Text selectable style={[text.error, { color: colors.danger }]}>
              {error}
            </Text>
          ) : null}
        </View>
      ) : error ? (
        <Text selectable style={[text.error, { color: colors.danger }]}>
          {error}
        </Text>
      ) : null}
    </ScrollView>
  );
}

export default function PermissionScreen() {
  const params = useLocalSearchParams<{
    id?: string | string[];
    kind?: string | string[];
  }>();
  const id = paramText(params.id);
  const kind = kindParam(paramText(params.kind));
  if (id.length > 0) {
    return <PermissionDetail key={id} id={id} />;
  }
  if (kind === null) {
    return <Redirect href="/permissions" />;
  }
  return <PermissionForm key={kind} kind={kind} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: 28,
    gap: 16,
  },
  title: { textAlign: "left" },
  back: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center" },
  fields: { gap: 16 },
  submit: { alignSelf: "flex-start" },
  block: { gap: 16 },
  heading: { gap: 8 },
  fact: { paddingVertical: 12, gap: 4 },
  cancel: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center" },
});
