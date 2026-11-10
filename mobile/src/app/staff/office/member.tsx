import { useCallback, useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";

import { HallButton } from "@/components/hall-button";
import { ListError } from "@/components/list-state";
import { ChoiceLine, OfficeError, OfficeFrame, replyError } from "@/components/office-frame";
import { SkeletonRows } from "@/components/skeleton";
import { useDelayedLoading } from "@/use-delayed-loading";
import { TextField } from "@/components/text-field";
import { useKeyedButtonFeedback } from "@/button-feedback";
import { pageQuery } from "@/list-page";
import {
  RESET_CONFIRM,
  canCreateStaffRole,
  canResetPassword,
  canSuspendAccounts,
  passwordBody,
  readPage,
  readStaffAccount,
  staffCreate,
  staffPatch,
  type OfficeStaff,
  type StaffDraft,
} from "@/office";
import { PASSWORD_RULES } from "@/password-rules";
import { roleLabel, useSession } from "@/session";
import { collectPages } from "@/use-list-page";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

const BLANK: StaffDraft = {
  fullName: "",
  username: "",
  role: "gate",
  jobTitle: "",
  status: "active",
  temporaryPassword: "",
};

function fromAccount(account: OfficeStaff): StaffDraft {
  return {
    fullName: account.fullName,
    username: account.username,
    role: account.role,
    jobTitle: account.jobTitle,
    status: account.status,
    temporaryPassword: "",
  };
}

export default function OfficeMember() {
  const colors = useHallColors();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { user, staffRequest } = useSession();
  const actorRole = user?.role ?? "";
  const [account, setAccount] = useState<OfficeStaff | null>(null);
  const [draft, setDraft] = useState<StaffDraft>(BLANK);
  const [reset, setReset] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const cue = useKeyedButtonFeedback<"save" | "reset">();
  const showSuspend = canSuspendAccounts(actorRole);
  const showReset = account !== null && canResetPassword(actorRole, account.role);
  const roleOptions = (
    [
      { value: "gate" as const, label: "Gate" },
      { value: "warden" as const, label: "Warden" },
      { value: "provost" as const, label: "Provost" },
    ] as const
  ).filter((option) => canCreateStaffRole(actorRole, option.value));

  const fill = (key: "fullName" | "username" | "jobTitle" | "temporaryPassword") => (value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setError(null);
  };

  const load = useCallback(() => {
    if (!id) {
      return;
    }
    setLoadError(null);
    void collectPages(async (offset) => {
      const reply = await staffRequest(`/admin/staff?${pageQuery(offset)}`);
      const page = reply.ok ? readPage(reply.data, readStaffAccount) : null;
      return page
        ? { items: page.items, total: page.total }
        : { error: replyError(reply) ?? "This account didn't load" };
    }).then((result) => {
      if (typeof result === "string") {
        setLoadError(result);
        return;
      }
      const found = result.find((item) => item.id === id) ?? null;
      if (!found) {
        setLoadError("This account didn't load");
        return;
      }
      setLoadError(null);
      setAccount(found);
      setDraft(fromAccount(found));
    });
  }, [id, staffRequest]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (cue.held) {
      return;
    }
    const body = account ? staffPatch(account, draft) : staffCreate(draft);
    if (typeof body === "string") {
      setError(body);
      return;
    }
    if (account && Object.keys(body).length === 0) {
      return;
    }
    const send = async () => {
      cue.markBusy("save");
      const reply = account
        ? await staffRequest(`/admin/staff/${encodeURIComponent(account.id)}`, body, "PATCH")
        : await staffRequest("/admin/staff", body);
      const saved = reply.ok ? readStaffAccount(reply.data) : null;
      if (!saved) {
        setError(replyError(reply) ?? "The account didn't save");
        cue.markFailure();
        return;
      }
      setAccount(saved);
      setDraft(fromAccount(saved));
      setError(null);
      cue.markSuccess("save");
    };
    if (account && draft.status === "suspended" && account.status !== "suspended") {
      Alert.alert("Suspend account", "Sign-in stops until you reinstate this account", [
        { text: "Back", style: "cancel" },
        { text: "Suspend", style: "destructive", onPress: () => void send() },
      ]);
      return;
    }
    await send();
  };

  const resetPassword = () => {
    if (!account || cue.held) {
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
            cue.markBusy("reset");
            const reply = await staffRequest(`/admin/users/${encodeURIComponent(account.id)}/password`, body, "POST");
            setReset("");
            if (!reply.ok) {
              setError(replyError(reply) ?? "The password didn't reset");
              cue.markFailure();
              return;
            }
            setNote("Password set, and sessions have ended");
            setError(null);
            cue.markSuccess("reset");
          })();
        },
      },
    ]);
  };

  const showAccountSkeleton = useDelayedLoading(Boolean(id) && account === null && loadError === null) && loadError === null;

  if (id && !account) {
    return (
      <OfficeFrame title="Staff">
        {loadError ? <ListError message={loadError} onRetry={load} /> : showAccountSkeleton ? <SkeletonRows count={4} kind="row" /> : null}
      </OfficeFrame>
    );
  }

  return (
    <OfficeFrame title={account?.fullName ?? "New staff"}>
      <TextField label="Name" value={draft.fullName} onChangeText={fill("fullName")} autoCapitalize="sentences" maxLength={120} />
      {account ? (
        <Text style={[text.body, { color: colors.inkSoft }]}>{`${account.username} · ${roleLabel(account.role)}`}</Text>
      ) : (
        <TextField label="Username" value={draft.username} onChangeText={fill("username")} maxLength={80} />
      )}
      <TextField label="Post" value={draft.jobTitle} onChangeText={fill("jobTitle")} autoCapitalize="sentences" maxLength={80} />
      {account ? null : (
        <ChoiceLine
          label="Role"
          value={draft.role}
          options={[...roleOptions]}
          onChange={(value) => {
            if (value === "gate" || value === "warden" || value === "provost") {
              setDraft((current) => ({ ...current, role: value }));
            }
          }}
        />
      )}
      {account && showSuspend ? (
        <ChoiceLine
          label="Account"
          value={draft.status}
          options={[
            { value: "active", label: "Active" },
            { value: "suspended", label: "Suspended" },
          ]}
          onChange={(value) => setDraft((current) => ({ ...current, status: value === "suspended" ? "suspended" : "active" }))}
        />
      ) : null}
      {account ? null : (
        <View style={styles.block}>
          <TextField
            label="Temporary password"
            value={draft.temporaryPassword}
            onChangeText={fill("temporaryPassword")}
            secureTextEntry
            maxLength={200}
          />
          {draft.temporaryPassword.length > 0 && PASSWORD_RULES.some((rule) => !rule.test(draft.temporaryPassword)) ? (
            PASSWORD_RULES.filter((rule) => !rule.test(draft.temporaryPassword)).map((rule) => (
              <Text key={rule.label} style={[text.error, { color: colors.inkSoft }]}>
                {rule.label}
              </Text>
            ))
          ) : null}
        </View>
      )}
      <HallButton
        label={account ? "Save staff" : "Add staff"}
        busy={cue.busy("save")}
        succeeded={cue.succeeded("save")}
        disabled={cue.held}
        onPress={() => void save()}
      />
      {showReset ? (
        <View style={styles.block}>
          <TextField
            label="New temporary password"
            value={reset}
            onChangeText={(value) => {
              setReset(value);
              setError(null);
            }}
            secureTextEntry
            maxLength={200}
          />
          <HallButton
            label="Reset password"
            busy={cue.busy("reset")}
            succeeded={cue.succeeded("reset")}
            disabled={cue.held}
            onPress={resetPassword}
          />
        </View>
      ) : null}
      {note ? <Text style={[text.body, { color: colors.inkSoft }]}>{note}</Text> : null}
      <OfficeError message={error} />
    </OfficeFrame>
  );
}

const styles = StyleSheet.create({
  block: { gap: 12 },
});
