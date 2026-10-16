import { useCallback, useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";

import { DenseRow } from "@/components/dense-row";
import { HallButton } from "@/components/hall-button";
import { ListError } from "@/components/list-state";
import { ChoiceLine, OfficeError, OfficeFrame, replyError } from "@/components/office-frame";
import { SearchField } from "@/components/search-field";
import { TextField } from "@/components/text-field";
import {
  REISSUE_CONFIRM,
  RESET_CONFIRM,
  passwordBody,
  readCreatedResident,
  readPass,
  readResident,
  readRooms,
  residentCreate,
  residentPatch,
  type IssuedPass,
  type OfficeResident,
  type OfficeRoom,
  type ResidentDraft,
} from "@/office";
import { PASSWORD_RULES } from "@/password-rules";
import { useSession } from "@/session";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

const BLANK: ResidentDraft = {
  fullName: "",
  enrolmentNumber: "",
  course: "",
  roomId: "",
  phone: "",
  guardianName: "",
  guardianPhone: "",
  status: "active",
  temporaryPassword: "",
};

function fromAccount(account: OfficeResident): ResidentDraft {
  return {
    fullName: account.fullName,
    enrolmentNumber: account.enrolmentNumber,
    course: account.course ?? "",
    roomId: account.roomId,
    phone: account.phone ?? "",
    guardianName: account.guardianName,
    guardianPhone: account.guardianPhone,
    status: account.status,
    temporaryPassword: "",
  };
}

export default function OfficeResident() {
  const colors = useHallColors();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { staffRequest } = useSession();
  const [account, setAccount] = useState<OfficeResident | null>(null);
  const [draft, setDraft] = useState<ResidentDraft>(BLANK);
  const [rooms, setRooms] = useState<OfficeRoom[]>([]);
  const [roomQuery, setRoomQuery] = useState("");
  const [pass, setPass] = useState<IssuedPass | null>(null);
  const [reset, setReset] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [roomsError, setRoomsError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "reissue" | "reset" | null>(null);

  const fill = (key: keyof ResidentDraft) => (value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setError(null);
    setNote(null);
  };

  const loadRooms = useCallback(() => {
    void staffRequest("/admin/rooms").then((reply) => {
      const next = reply.ok ? readRooms(reply.data) : null;
      if (!next) {
        setRoomsError(replyError(reply) ?? "Rooms didn't load");
        return;
      }
      setRooms(next);
      setRoomsError(null);
    });
  }, [staffRequest]);

  const loadAccount = useCallback(
    (residentId: string) => {
      void staffRequest(`/admin/residents/${encodeURIComponent(residentId)}`).then((reply) => {
        const next = reply.ok ? readResident(reply.data) : null;
        if (!next) {
          setError(replyError(reply) ?? "This resident didn't load");
          return;
        }
        setAccount(next);
        setDraft(fromAccount(next));
      });
    },
    [staffRequest],
  );

  useEffect(() => {
    loadRooms();
    if (id) {
      loadAccount(id);
    }
  }, [id, loadAccount, loadRooms]);

  const choices = rooms.filter((room) => {
    const selected = room.id === draft.roomId;
    const active = room.status === "active" || selected;
    const needle = roomQuery.trim().toLowerCase();
    return active && (needle.length === 0 || room.label.toLowerCase().includes(needle) || room.number.includes(needle));
  });
  const chosen = choices.find((room) => room.id === draft.roomId) ?? null;
  const roomChoices = chosen ? [chosen, ...choices.filter((room) => room.id !== chosen.id)].slice(0, 8) : choices.slice(0, 8);

  const write = async (nextStatus: ResidentDraft["status"]) => {
    if (busy) {
      return;
    }
    const next = { ...draft, status: nextStatus, temporaryPassword: account ? "" : draft.temporaryPassword };
    const body = account ? residentPatch(account, next) : residentCreate(next);
    if (typeof body === "string") {
      setError(body);
      return;
    }
    if (account && Object.keys(body).length === 0) {
      return;
    }
    setBusy("save");
    const reply = account
      ? await staffRequest(`/admin/residents/${encodeURIComponent(account.id)}`, body, "PATCH")
      : await staffRequest("/admin/residents", body);
    setBusy(null);
    if (!reply.ok) {
      setError(replyError(reply) ?? "The resident didn't save");
      return;
    }
    if (account) {
      const updated = readResident(reply.data);
      if (!updated) {
        setError("The resident didn't save");
        return;
      }
      setAccount(updated);
      setDraft(fromAccount(updated));
    } else {
      const created = readCreatedResident(reply.data);
      if (!created) {
        setError("The resident didn't save");
        return;
      }
      setAccount(created.account);
      setDraft(fromAccount(created.account));
      setPass(created.pass);
      setNote("Shown once");
    }
    setError(null);
  };

  const save = () => {
    if (account && draft.status === "suspended" && account.status !== "suspended") {
      Alert.alert("Suspend account", "Sign-in stops until you reinstate this account", [
        { text: "Back", style: "cancel" },
        { text: "Suspend", style: "destructive", onPress: () => void write("suspended") },
      ]);
      return;
    }
    void write(draft.status);
  };

  const reissue = () => {
    if (!account || busy) {
      return;
    }
    Alert.alert(REISSUE_CONFIRM.title, REISSUE_CONFIRM.message, [
      { text: "Back", style: "cancel" },
      {
        text: REISSUE_CONFIRM.action,
        style: "destructive",
        onPress: () => {
          void (async () => {
            setBusy("reissue");
            const reply = await staffRequest(
              `/admin/residents/${encodeURIComponent(account.id)}/hall-pass/reissue`,
              undefined,
              "POST",
            );
            setBusy(null);
            const issued = reply.ok ? readPass(reply.data) : null;
            if (!issued) {
              setError(replyError(reply) ?? "The hall pass didn't reissue");
              return;
            }
            setPass(issued);
            setNote("Shown once, and the previous QR no longer works");
            setError(null);
          })();
        },
      },
    ]);
  };

  const resetPassword = () => {
    if (!account || busy) {
      return;
    }
    const body = passwordBody(reset);
    if (typeof body === "string") {
      setError(body);
      return;
    }
    Alert.alert(RESET_CONFIRM.title, RESET_CONFIRM.message, [
      { text: "Back", style: "cancel" },
      {
        text: RESET_CONFIRM.action,
        style: "destructive",
        onPress: () => {
          void (async () => {
            setBusy("reset");
            const reply = await staffRequest(`/admin/users/${encodeURIComponent(account.id)}/password`, body, "POST");
            setBusy(null);
            setReset("");
            if (!reply.ok) {
              setError(replyError(reply) ?? "The password didn't reset");
              return;
            }
            setNote("Password set, and sessions have ended");
            setError(null);
          })();
        },
      },
    ]);
  };

  return (
    <OfficeFrame title={account?.fullName ?? "New resident"}>
      <TextField label="Name" value={draft.fullName} onChangeText={fill("fullName")} autoCapitalize="sentences" maxLength={120} />
      <TextField label="Enrolment number" value={draft.enrolmentNumber} onChangeText={fill("enrolmentNumber")} maxLength={40} />
      <TextField label="Course" value={draft.course} onChangeText={fill("course")} autoCapitalize="sentences" maxLength={120} />
      <TextField label="Phone" value={draft.phone} onChangeText={fill("phone")} keyboardType="default" maxLength={16} />
      <TextField label="Guardian" value={draft.guardianName} onChangeText={fill("guardianName")} autoCapitalize="sentences" maxLength={120} />
      <TextField label="Guardian phone" value={draft.guardianPhone} onChangeText={fill("guardianPhone")} maxLength={16} />
      <SearchField value={roomQuery} placeholder="Room" onChange={setRoomQuery} />
      {roomsError ? <ListError message={roomsError} onRetry={loadRooms} /> : null}
      <View>
        {roomChoices.map((room, index, all) => (
          <DenseRow
            key={room.id}
            title={room.label}
            detail={room.status === "active" ? "Active" : "Inactive"}
            time={room.id === draft.roomId ? "Chosen" : "Choose"}
            first={index === 0}
            last={index === all.length - 1}
            onPress={() => fill("roomId")(room.id)}
          />
        ))}
      </View>
      {account ? (
        <Text style={[text.body, { color: colors.inkSoft }]}>
          {account.presence === "outside" ? "Outside" : "Inside"}
        </Text>
      ) : null}
      {account ? (
        <ChoiceLine
          label="Account"
          value={draft.status}
          options={[
            { value: "active", label: "Active" },
            { value: "suspended", label: "Suspended" },
          ]}
          onChange={(value) => fill("status")(value === "suspended" ? "suspended" : "active")}
        />
      ) : null}
      {account ? null : (
        <View style={styles.password}>
          <TextField label="Temporary password" value={draft.temporaryPassword} onChangeText={fill("temporaryPassword")} secureTextEntry maxLength={200} />
          {draft.temporaryPassword.length > 0 && PASSWORD_RULES.some((rule) => !rule.test(draft.temporaryPassword)) ? (
            <View>
              {PASSWORD_RULES.filter((rule) => !rule.test(draft.temporaryPassword)).map((rule) => (
                <Text key={rule.label} style={[text.error, { color: colors.inkSoft }]}>
                  {rule.label}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      )}
      <HallButton label={account ? "Save resident" : "Add resident"} busy={busy === "save"} disabled={busy !== null} onPress={save} />
      {account ? (
        <View style={styles.password}>
          <HallButton label="Reissue hall pass" busy={busy === "reissue"} disabled={busy !== null} onPress={reissue} />
          <TextField label="New temporary password" value={reset} onChangeText={(value) => { setReset(value); setError(null); }} secureTextEntry maxLength={200} />
          <HallButton label="Reset password" busy={busy === "reset"} disabled={busy !== null} onPress={resetPassword} />
        </View>
      ) : null}
      {pass ? (
        <View style={styles.pass}>
          <Text selectable style={[text.mono, { color: colors.ink }]}>
            {pass.qrPayload}
          </Text>
          <Text style={[text.error, { color: colors.inkSoft }]}>{`${pass.fullName} · ${pass.roomLabel}`}</Text>
        </View>
      ) : null}
      {note ? <Text style={[text.body, { color: colors.inkSoft }]}>{note}</Text> : null}
      <OfficeError message={error} />
    </OfficeFrame>
  );
}

const styles = StyleSheet.create({
  password: { gap: 12 },
  pass: { gap: 6 },
});
